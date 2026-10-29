/**
 * Vercel serverless function: POST /api/scan
 * Контракт тот же, что у локального Vite-эндпоинта: { image: dataURL } → { ingredients: [] }
 *
 * ⚠️ Файл самодостаточный: никаких относительных импортов (../server/…).
 * Vercel собирает api/*.ts как ESM, а Node-ESM не разрешает импорты без
 * расширения — из-за этого функция падает с FUNCTION_INVOCATION_FAILED.
 * Логика продублирована из server/scan-core.ts — при изменении синхронизируй.
 *
 * На Vercel распознавание работает ТОЛЬКО через Gemini (бесплатный тариф
 * Google AI Studio): env GEMINI_API_KEY, опционально GEMINI_MODEL.
 * Путь z-ai-web-dev-sdk остался только в dev-плагине scan-api.ts.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

export const config = {
  api: {
    // Фото после сжатия на клиенте весит ~100–300 КБ, но даём запас
    bodyParser: { sizeLimit: '5mb' },
  },
};

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const SCAN_PROMPT =
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

/** Google AI Studio (Gemini Flash) — бесплатный тариф */
async function scanWithGemini(imageDataUrl: string): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'GEMINI_API_KEY не задан — добавь его в Vercel: Settings → Environment Variables',
    );
  }

  // gemini-2.0-flash выключен Google 01.06.2026 — дефолт только на живых моделях.
  // 2.5-flash-lite: без thinking по умолчанию и исторически самая щедрая
  // бесплатная квота (RPD). Свежее (gemini-3.8-flash и т.п.) задаётся через
  // GEMINI_MODEL, квоты плавают — сверяйся с AI Studio → Rate limits.
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash-lite';
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
    const ingredients = await scanWithGemini(image);
    if (ingredients.length === 0) {
      sendJson(502, { error: 'no_ingredients' });
      return;
    }
    sendJson(200, { ingredients });
  } catch (err) {
    sendJson(502, { error: 'scan_failed', detail: errMsg(err) });
  }
}
