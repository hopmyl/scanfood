/**
 * Scan API — серверные эндпоинты внутри Vite (dev + preview).
 *
 *  POST /api/scan        — распознавание продуктов на фото (z-ai или Gemini)
 *  GET  /api/barcode?code=… — информация о товаре по штрих-коду (OpenFoodFacts)
 *
 * Вся логика живёт в server/scan-core.ts — тот же код используется
 * serverless-функциями Vercel (api/scan.ts, api/barcode.ts) при деплое.
 */
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { errMsg, isValidBarcode, lookupBarcode, scanIngredients } from './server/scan-core';

type Next = () => void;
type Handler = (req: IncomingMessage, res: ServerResponse, next: Next) => void;

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
    const ingredients = await scanIngredients(image);
    if (ingredients.length === 0) {
      sendJson(res, 502, { error: 'no_ingredients' });
      return;
    }
    sendJson(res, 200, { ingredients });
  } catch (err) {
    sendJson(res, 502, { error: 'scan_failed', detail: errMsg(err) });
  }
}

async function handleBarcode(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://local');
  const code = (url.searchParams.get('code') ?? '').trim();

  if (!isValidBarcode(code)) {
    sendJson(res, 400, { error: 'bad_code' });
    return;
  }

  try {
    const product = await lookupBarcode(code);
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
