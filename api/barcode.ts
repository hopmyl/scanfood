/**
 * Vercel serverless function: GET /api/barcode?code=…
 * Информация о товаре по штрих-коду через Open Food Facts (бесплатно).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { errMsg, isValidBarcode, lookupBarcode } from '../server/scan-core';

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
