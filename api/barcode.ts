/**
 * Vercel Serverless Function: GET /api/barcode?code=…
 * Информация о товаре по штрих-коду через открытую базу Open Food Facts.
 * Ключи не нужны — работает на Vercel «из коробки».
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

export const config = {
  runtime: 'nodejs',
  maxDuration: 15,
};

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

const OFF_FIELDS =
  'product_name,product_name_ru,brands,image_front_small_url,image_url,' +
  'nutriments,ingredients_text,ingredients_text_ru';

const barcodeCache = new Map<string, BarcodeProduct | null>();

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const payload = JSON.stringify(data);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(payload);
}

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
    if (kj !== null) kcal = Math.round((kj / 4.184) * 10) / 10;
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

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
        headers: {
          'User-Agent': 'SkanRecept/1.0 (PWA; https://vercel.com) contact: dev@skanrecept.app',
        },
      },
    );
    clearTimeout(timer);
    const data = await response.json();

    const product = data?.status === 1 ? normalizeProduct(code, data) : null;
    if (barcodeCache.size > 500) barcodeCache.clear(); // простая защита от разрастания
    barcodeCache.set(code, product);
    sendJson(res, 200, product ? { found: true, product } : { found: false });
  } catch (err) {
    console.error('[api/barcode] error:', errMsg(err));
    sendJson(res, 502, { error: 'lookup_failed', detail: errMsg(err) });
  }
}
