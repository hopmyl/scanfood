/**
 * Vercel Serverless Function: POST /api/scan
 * Распознавание продуктов на фото через vision-модель (OpenAI-совместимый шлюз).
 *
 * Провайдер настраивается переменными окружения в Vercel (Settings → Environment Variables):
 *   VISION_BASE_URL  — например https://api.z.ai/v1 или https://api.openai.com/v1
 *   VISION_API_KEY   — ключ этого шлюза
 *   VISION_MODEL     — например glm-4.5v / gpt-4o-mini (по умолчанию glm-4.5v)
 *
 * Дополнительно понимаем алиасы ZAI_* и OPENAI_* — что привычнее.
 * Если переменные не заданы — возвращаем 501 { error: 'no_provider' },
 * клиент честно показывает «распознавание недоступно» и предлагает демо-скан.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 МБ — потолок для фото с камеры

const SCAN_PROMPT =
  'Ты — модуль распознавания продуктов в приложении для готовки. ' +
  'Посмотри на фото и перечисли ВСЕ съедобные продукты, которые видишь ' +
  '(содержимое холодильника, продукты на столе, готовое блюдо разложи на компоненты). ' +
  'Правила: от 3 до 12 наименований; по-русски; именительный падеж; ' +
  'множественное число, где уместно (помидоры, яйца, огурцы); ' +
  'без упаковок, посуды, приборов и непродуктов; без пояснений и комментариев. ' +
  'Ответ — СТРОГО валидный JSON без markdown-обёрток: {"ingredients": ["...", "..."]}';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

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

function extractIngredients(raw: string): string[] {
  if (!raw) return [];
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
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

interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function providerFromEnv(): ProviderConfig | null {
  const baseUrl = process.env.VISION_BASE_URL ?? process.env.ZAI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? '';
  const apiKey = process.env.VISION_API_KEY ?? process.env.ZAI_API_KEY ?? process.env.OPENAI_API_KEY ?? '';
  const model = process.env.VISION_MODEL ?? process.env.ZAI_MODEL ?? process.env.OPENAI_MODEL ?? 'glm-4.5v';
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey, model };
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const provider = providerFromEnv();
  if (!provider) {
    sendJson(res, 501, { error: 'no_provider' });
    return;
  }

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
    const isZai = provider.baseUrl.includes('z.ai');
    const completion = await Promise.race([
      fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: SCAN_PROMPT },
                { type: 'image_url', image_url: { url: image } },
              ],
            },
          ],
          // GLM-vision на шлюзах z.ai требует явно выключенного «мышления»
          ...(isZai ? { thinking: { type: 'disabled' } } : {}),
        }),
      }),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('scan timeout')), 55_000),
      ),
    ]);

    const payload = (await (completion as Response).json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content: string = payload?.choices?.[0]?.message?.content ?? '';
    const ingredients = extractIngredients(content);

    if (ingredients.length === 0) {
      sendJson(res, 502, { error: 'no_ingredients', raw: content.slice(0, 200) });
      return;
    }

    sendJson(res, 200, { ingredients });
  } catch (err) {
    console.error('[api/scan] error:', errMsg(err));
    sendJson(res, 502, { error: 'scan_failed', detail: errMsg(err) });
  }
}
