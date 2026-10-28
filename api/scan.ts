/**
 * Vercel serverless function: POST /api/scan
 * Тот же контракт, что и локальный Vite-эндпоинт: { image: dataURL } → { ingredients: [] }
 *
 * Env: SCAN_PROVIDER=zai|gemini, GEMINI_API_KEY (бесплатный ключ Google AI Studio),
 *      GEMINI_MODEL (опционально, по умолчанию gemini-2.0-flash).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { errMsg, scanIngredients } from '../server/scan-core';

export const config = {
  api: {
    // Фото после сжатия на клиенте весит ~100–300 КБ, но даём запас
    bodyParser: { sizeLimit: '5mb' },
  },
};

type Req = IncomingMessage & { method?: string; body?: unknown };

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  const sendJson = (status: number, data: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(data));
  };

  if (req.method !== 'POST') {
    sendJson(405, { error: 'method_not_allowed' });
    return;
  }

  let body: { image?: unknown };
  try {
    body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : ((req.body ?? {}) as { image?: unknown });
  } catch {
    sendJson(400, { error: 'bad_json' });
    return;
  }

  const image = body?.image;
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    sendJson(400, { error: 'bad_image' });
    return;
  }

  try {
    const ingredients = await scanIngredients(image);
    if (ingredients.length === 0) {
      sendJson(502, { error: 'no_ingredients' });
      return;
    }
    sendJson(200, { ingredients });
  } catch (err) {
    sendJson(502, { error: 'scan_failed', detail: errMsg(err) });
  }
}
