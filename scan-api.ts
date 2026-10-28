/**
 * Scan API — серверные эндпоинты внутри Vite (dev + preview).
 *
 *  POST /api/scan        — распознавание продуктов на фото через VLM (z-ai-web-dev-sdk)
 *  GET  /api/barcode?code=… — информация о товаре по штрих-коду через OpenFoodFacts
 *
 * SDK работает только на бэкенде, поэтому вызовы инкапсулированы здесь,
 * а клиент общается с локальными эндпоинтами по HTTP.
 */
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

type Next = () => void;
type Handler = (req: IncomingMessage, res: ServerResponse, next: Next) => void;

/** Сообщение об ошибке без зависимости от строгих типов catch */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 МБ — потолок для фото с камеры

/** Читает тело запроса с лимитом размера */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const payload = JSON.stringify(data);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(payload);
}

// ---------------------------------------------------------------------------
// POST /api/scan — распознавание продуктов на фото
// ---------------------------------------------------------------------------

const SCAN_PROMPT =
  'Ты — модуль распознавания продуктов в приложении для готовки. ' +
  'Посмотри на фото и перечисли ВСЕ съедобные продукты, которые видишь ' +
  '(содержимое холодильника, продукты на столе, готовое блюдо разложи на компоненты). ' +
  'Правила: от 3 до 12 наименований; по-русски; именительный падеж; ' +
  'множественное число, где уместно (помидоры, яйца, огурцы); ' +
  'без упаковок, посуды, приборов и непродуктов; без пояснений и комментариев. ' +
  'Ответ — СТРОГО валидный JSON без markdown-обёрток: {"ingredients": ["...", "..."]}';

function extractIngredients(raw: string): string[] {
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

async function handleScan(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: { image?: unknown };
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: 'bad_json' });
    return;
  }

  const image = body?.image;
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    sendJson(res, 400, { error: 'bad_image' });
    return;
  }

  try {
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    const zai = await ZAI.create();

    const completion = await Promise.race([
      zai.chat.completions.createVision({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SCAN_PROMPT },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        thinking: { type: 'disabled' },
      } as never),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('scan timeout')), 55_000),
      ),
    ]);

    const content: string =
      completion?.choices?.[0]?.message?.content ?? '';
    const ingredients = extractIngredients(content);

    if (ingredients.length === 0) {
      sendJson(res, 502, { error: 'no_ingredients', raw: content.slice(0, 200) });
      return;
    }

    sendJson(res, 200, { ingredients });
  } catch (err) {
    console.error('[scan-api] scan error:', errMsg(err));
    sendJson(res, 502, { error: 'scan_failed', detail: errMsg(err) });
  }
}

// ---------------------------------------------------------------------------
// GET /api/barcode?code=… — товар по штрих-коду (OpenFoodFacts, с кэшем)
// ---------------------------------------------------------------------------

interface BarcodeProduct {
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

function normalizeProduct(barcode: string, data: any): BarcodeProduct | null {
  const p = data?.product;
  if (!p) return null;
  const name: string = (p.product_name_ru || p.product_name || '').trim();
  if (!name) return null;

  const n = p.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null && n['energy_100g'] !== undefined) {
    const kj = num(n['energy_100g']);
    if (kj !== null) kcal = Math.round(kj / 4.184 * 10) / 10;
  }

  return {
    barcode,
    name,
    brands: (p.brands || '').split(',').map((s: string) => s.trim()).filter(Boolean)[0] ?? '',
    image: p.image_front_small_url || p.image_url || null,
    kcal,
    protein: num(n.proteins_100g),
    fat: num(n.fat_100g),
    carbs: num(n.carbohydrates_100g),
    ingredientsText: (p.ingredients_text_ru || p.ingredients_text || '').trim(),
  };
}

const OFF_FIELDS =
  'product_name,product_name_ru,brands,image_front_small_url,image_url,' +
  'nutriments,ingredients_text,ingredients_text_ru';

async function handleBarcode(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://local');
  const code = (url.searchParams.get('code') ?? '').trim();

  // Штрих-коды продуктов: EAN-13/EAN-8/UPC — 8–14 цифр
  if (!/^\d{8,14}$/.test(code)) {
    sendJson(res, 400, { error: 'bad_code' });
    return;
  }

  if (barcodeCache.has(code)) {
    const cached = barcodeCache.get(code);
    sendJson(res, 200, cached ? { found: true, product: cached } : { found: false });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'SkanRecept/0.3 (sandbox PWA; contact: dev@skanrecept.local)' },
      },
    );
    clearTimeout(timer);
    const data = await response.json();

    const product = data?.status === 1 ? normalizeProduct(code, data) : null;
    barcodeCache.set(code, product);
    sendJson(res, 200, product ? { found: true, product } : { found: false });
  } catch (err) {
    console.error('[scan-api] barcode error:', errMsg(err));
    sendJson(res, 502, { error: 'lookup_failed', detail: errMsg(err) });
  }
}

// ---------------------------------------------------------------------------
// Роутер-плагин
// ---------------------------------------------------------------------------

function attach(middlewares: {
  use: (route: string, fn: Handler) => void;
}): void {
  middlewares.use('/api/scan', (req, res) => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return;
    }
    handleScan(req, res).catch((e) => {
      console.error('[scan-api] fatal:', e);
      sendJson(res, 500, { error: 'internal' });
    });
  });

  middlewares.use('/api/barcode', (req, res) => {
    handleBarcode(req, res).catch((e) => {
      console.error('[scan-api] fatal:', e);
      sendJson(res, 500, { error: 'internal' });
    });
  });
}

export function scanApiPlugin(): Plugin {
  return {
    name: 'skanrecept-scan-api',
    configureServer(server) {
      attach(server.middlewares);
    },
    // Работает и в `vite preview` — после сборки PWA эндпоинты тоже живы
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}
