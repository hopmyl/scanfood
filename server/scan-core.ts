/**
 * Общее ядро сканов — единый источник логики для:
 *  - Vite-плагина (scan-api.ts, локальная разработка/превью);
 *  - serverless-функций Vercel (api/scan.ts, api/barcode.ts).
 *
 * Провайдеры распознавания фото (SCAN_PROVIDER):
 *  - 'zai'    — z-ai-web-dev-sdk (дефолт в песочнице);
 *  - 'gemini' — Google AI Studio (бесплатный тариф Gemini Flash).
 * Дефолт выбирается автоматически: если задан GEMINI_API_KEY и SCAN_PROVIDER
 * не указан — используется gemini (нулевая стоимость сканов).
 */

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ---------------------------------------------------------------------------
// POST /api/scan — распознавание продуктов на фото
// ---------------------------------------------------------------------------

export const SCAN_PROMPT =
  'Ты — модуль распознавания продуктов в приложении для готовки. ' +
  'Посмотри на фото и перечисли ВСЕ съедобные продукты, которые видишь ' +
  '(содержимое холодильника, продукты на столе, готовое блюдо разложи на компоненты). ' +
  'Правила: от 3 до 12 наименований; по-русски; именительный падеж; ' +
  'множественное число, где уместно (помидоры, яйца, огурцы); ' +
  'без упаковок, посуды, приборов и непродуктов; без пояснений и комментариев. ' +
  'Ответ — СТРОГО валидный JSON без markdown-обёрток: {"ingredients": ["...", "..."]}';

export function extractIngredients(raw: string): string[] {
  if (!raw) return [];
  // Убираем возможные markdown-обёртки ```json ... ```
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Фолбэк: вытаскиваем первый JSON-объект по регулярке
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
  const list = (parsed as { ingredients?: unknown })?.ingredients;
  if (!Array.isArray(list)) return [];
  return list
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim().replace(/^[«"'\-–—\s]+|[«"'\s]+$/g, ''))
    .filter((s) => s.length >= 2 && s.length <= 40)
    .slice(0, 15);
}

export type ScanProvider = 'zai' | 'gemini';

export function resolveScanProvider(): ScanProvider {
  const forced = process.env.SCAN_PROVIDER?.trim().toLowerCase();
  if (forced === 'gemini') return 'gemini';
  if (forced === 'zai') return 'zai';
  return process.env.GEMINI_API_KEY ? 'gemini' : 'zai';
}

/** z-ai-web-dev-sdk — vision через createVision.
 *  Спецификатор в переменной, чтобы бандлер Vercel (esbuild) не пытался
 *  инлайнить SDK в serverless-функции: вне песочницы путь zai не используется
 *  (там работает gemini), а сломанный бандл может валить функцию на старте. */
type ZaiClient = {
  chat: {
    completions: {
      createVision: (args: unknown) => Promise<unknown>;
    };
  };
};

async function scanWithZai(imageDataUrl: string): Promise<string[]> {
  const specifier = 'z-ai-web-dev-sdk';
  const mod = await import(specifier);
  const ZAI = (mod as { default?: { create: () => Promise<ZaiClient> } }).default;
  if (!ZAI) throw new Error('z-ai-web-dev-sdk is unavailable');
  const zai = await ZAI.create();

  const completion = await Promise.race([
    zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: SCAN_PROMPT },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    }),
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error('scan timeout')), 55_000),
    ),
  ]);

  const content: string =
    (completion as { choices?: Array<{ message?: { content?: string } }> })
      ?.choices?.[0]?.message?.content ?? '';
  return extractIngredients(content);
}

/** Google AI Studio (Gemini Flash) — бесплатный тариф */
async function scanWithGemini(imageDataUrl: string): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is not set');

  // gemini-2.0-flash выключен 01.06.2026, а gemini-2.5-flash-lite Google закрыл
  // для новых пользователей (404 «no longer available to new users») — дефолт
  // 3.5-flash-lite. Свежее/другое задаётся через GEMINI_MODEL, квоты плавают —
  // сверяйся с AI Studio → Rate limits.
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
  const match = imageDataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!match) throw new Error('bad image data url');
  const [, mime, base64] = match;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: SCAN_PROMPT }, { inline_data: { mime_type: mime, data: base64 } }],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        }),
      },
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      throw new Error(`gemini ${res.status}: ${detail}`);
    }
    const data: unknown = await res.json();
    const parts = (
      data as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      }
    )?.candidates?.[0]?.content?.parts;
    const text = (parts ?? []).map((p) => p.text ?? '').join('');
    return extractIngredients(text);
  } finally {
    clearTimeout(timer);
  }
}

/** Точка входа: распознать продукты на фото (data:image/...;base64,…) */
export async function scanIngredients(imageDataUrl: string): Promise<string[]> {
  const provider = resolveScanProvider();
  try {
    return provider === 'gemini'
      ? await scanWithGemini(imageDataUrl)
      : await scanWithZai(imageDataUrl);
  } catch (err) {
    console.error(`[scan-core] provider=${provider} error:`, errMsg(err));
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GET /api/barcode?code=… — товар по штрих-коду (OpenFoodFacts, с кэшем)
// ---------------------------------------------------------------------------

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brands: string;
  image: string | null;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  ingredientsText: string;
}

const barcodeCache = new Map<string, BarcodeProduct | null>();

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number.parseFloat(v) : (v as number);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function normalizeProduct(barcode: string, data: unknown): BarcodeProduct | null {
  const p = (data as { product?: Record<string, unknown> })?.product;
  if (!p) return null;
  const name = String(p.product_name_ru || p.product_name || '').trim();
  if (!name) return null;

  const n = (p.nutriments ?? {}) as Record<string, unknown>;
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null && n['energy_100g'] !== undefined) {
    const kj = num(n['energy_100g']);
    if (kj !== null) kcal = Math.round((kj / 4.184) * 10) / 10;
  }

  return {
    barcode,
    name,
    brands:
      String(p.brands || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)[0] ?? '',
    image: (p.image_front_small_url as string) || (p.image_url as string) || null,
    kcal,
    protein: num(n.proteins_100g),
    fat: num(n.fat_100g),
    carbs: num(n.carbohydrates_100g),
    ingredientsText: String(p.ingredients_text_ru || p.ingredients_text || '').trim(),
  };
}

const OFF_FIELDS =
  'product_name,product_name_ru,brands,image_front_small_url,image_url,' +
  'nutriments,ingredients_text,ingredients_text_ru';

/** Штрих-коды продуктов: EAN-13/EAN-8/UPC — 8–14 цифр */
export function isValidBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code);
}

export async function lookupBarcode(code: string): Promise<BarcodeProduct | null> {
  if (barcodeCache.has(code)) return barcodeCache.get(code) ?? null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'SkanRecept/0.4 (PWA; contact: dev@skanrecept.local)',
        },
      },
    );
    const data: unknown = await response.json();
    const product =
      (data as { status?: number })?.status === 1 ? normalizeProduct(code, data) : null;
    barcodeCache.set(code, product);
    return product;
  } finally {
    clearTimeout(timer);
  }
}
