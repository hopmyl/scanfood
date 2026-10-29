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
  'Для каждого продукта оцени уверенность: "high" — уверен, что определил верно; ' +
  '"medium" — продукт только похож на указанный, возможна ошибка. ' +
  'Ответ — СТРОГО валидный JSON без markdown-обёрток: ' +
  '{"ingredients": [{"name": "сыр", "confidence": "high"}, {"name": "сметана", "confidence": "medium"}]}';

/** Распознанный продукт с уверенностью модели */
export interface DetectedProduct {
  name: string;
  confidence: 'high' | 'medium';
}

/**
 * Парсит ответ модели. Терпим к формату: принимает и новые объекты
 * {name, confidence}, и старые строки — так ответ старой модели не уронит API.
 */
export function extractProducts(raw: string): DetectedProduct[] {
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

  const out: DetectedProduct[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    let name = '';
    let confidence: DetectedProduct['confidence'] = 'high';
    if (typeof item === 'string') {
      name = item;
    } else if (item && typeof item === 'object') {
      const o = item as { name?: unknown; confidence?: unknown };
      name = typeof o.name === 'string' ? o.name : '';
      confidence = o.confidence === 'medium' || o.confidence === 'low' ? 'medium' : 'high';
    }
    name = name.trim().replace(/^[«"'\-–—\s]+|[«"'\s]+$/g, '');
    if (name.length < 2 || name.length > 40) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, confidence });
    if (out.length >= 12) break;
  }
  return out;
}

export type ScanProvider = 'zai' | 'gemini';

export function resolveScanProvider(): ScanProvider {
  const forced = process.env.SCAN_PROVIDER?.trim().toLowerCase();
  if (forced === 'gemini') return 'gemini';
  if (forced === 'zai') return 'zai';
  return process.env.GEMINI_API_KEY ? 'gemini' : 'zai';
}

/** z-ai-web-dev-sdk — vision через createVision */
async function scanWithZai(imageDataUrl: string): Promise<DetectedProduct[]> {
  const { default: ZAI } = await import('z-ai-web-dev-sdk');
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
    } as never),
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error('scan timeout')), 55_000),
    ),
  ]);

  const content: string = completion?.choices?.[0]?.message?.content ?? '';
  return extractProducts(content);
}

/** Google AI Studio (Gemini Flash) — бесплатный тариф */
async function scanWithGemini(imageDataUrl: string): Promise<DetectedProduct[]> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY is not set');

  // gemini-2.0-flash выключен Google 01.06.2026, а gemini-2.5-flash-lite закрыт
  // для новых пользователей — дефолт только на живых моделях: 3.5-flash-lite
  // (та же модель, что и в самодостаточном api/scan.ts на Vercel).
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
    return extractProducts(text);
  } finally {
    clearTimeout(timer);
  }
}

/** Точка входа: распознать продукты на фото (data:image/...;base64,…) */
export async function scanIngredients(imageDataUrl: string): Promise<DetectedProduct[]> {
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
