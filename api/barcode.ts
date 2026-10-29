/**
 * Vercel serverless function: GET /api/barcode?code=…
 * Информация о товаре по штрих-коду через Open Food Facts (бесплатно).
 *
 * ⚠️ Файл самодостаточный: никаких относительных импортов (../server/…).
 * Vercel собирает api/*.ts как ESM, а Node-ESM не разрешает импорты без
 * расширения — из-за этого функция падает с FUNCTION_INVOCATION_FAILED.
 * Логика продублирована из server/scan-core.ts — при изменении синхронизируй.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

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

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type Req = IncomingMessage & { method?: string; url?: string };

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  const sendJson = (status: number, data: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(data));
  };

  const url = new URL(req.url ?? '/api/barcode', 'http://local');
  const code = (url.searchParams.get('code') ?? '').trim();

  if (!isValidBarcode(code)) {
    sendJson(400, { error: 'bad_code' });
    return;
  }

  try {
    const product = await lookupBarcode(code);
    sendJson(200, product ? { found: true, product } : { found: false });
  } catch (err) {
    sendJson(502, { error: 'lookup_failed', detail: errMsg(err) });
  }
}
