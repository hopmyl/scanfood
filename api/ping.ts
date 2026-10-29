/**
 * Временный диагностический эндпоинт: GET /api/ping
 * Показывает, что serverless-функции на Vercel вообще живут.
 * Никаких импортов из server/scan-core — чистая проверка рантайма.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(
    JSON.stringify({
      ok: true,
      node: process.version,
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      scanProvider: process.env.SCAN_PROVIDER ?? '(auto)',
    }),
  );
}
