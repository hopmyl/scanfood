/**
 * Netlify function v2: POST /api/scan (маршрутизируется через netlify.toml)
 * Контракт: { image: dataURL } → { ingredients: string[], products: {name, confidence}[] }
 *
 * Самодостаточная копия логики api/scan.ts (Vercel) — синхронизируй при изменении.
 * На Netlify распознавание работает через OpenRouter (env OPENROUTER_API_KEY —
 * OpenAI-совместимый агрегатор, доступен из РФ без VPN, есть бесплатные
 * vision-модели с суффиксом :free) либо через Gemini (GEMINI_API_KEY).
 * OpenRouter проверяется первым. Без обоих ключей функция вернёт 501 no_provider
 * — приложение честно предложит демо-режим вместо пугающей ошибки.
 */

const SCAN_PROMPT =
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
interface DetectedProduct {
  name: string;
  confidence: 'high' | 'medium';
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function extractProducts(raw: string): DetectedProduct[] {
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

/**
 * OpenRouter — OpenAI-совместимый агрегатор (openrouter.ai), доступен из РФ
 * без VPN. Бесплатные vision-модели (суффикс :free): лимит 20 запросов/мин
 * и 50/день (после разового пополнения $10 — 1000/день), для теста друзьями
 * достаточно. dataURL передаётся в image_url как есть.
 */
async function scanWithOpenRouter(imageDataUrl: string): Promise<DetectedProduct[]> {
  const key = process.env.OPENROUTER_API_KEY!.trim();
  const model = process.env.OPENROUTER_MODEL?.trim() || 'google/gemma-4-31b-it:free';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'ScanRecipe',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SCAN_PROMPT },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
        max_tokens: 512,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      throw new Error(`openrouter ${res.status}: ${detail}`);
    }
    const data: unknown = await res.json();
    const text =
      (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]
        ?.message?.content ?? '';
    return extractProducts(text);
  } finally {
    clearTimeout(timer);
  }
}

async function scanWithGemini(imageDataUrl: string): Promise<DetectedProduct[]> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'Ни OPENROUTER_API_KEY, ни GEMINI_API_KEY не заданы — добавь ключ в Netlify: Site configuration → Environment variables',
    );
  }
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

export default async function handler(req: Request): Promise<Response> {
  const sendJson = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });

  if (req.method !== 'POST') return sendJson(405, { error: 'method_not_allowed' });

  let body: { image?: unknown };
  try {
    body = (await req.json()) as { image?: unknown };
  } catch {
    return sendJson(400, { error: 'bad_json' });
  }

  const image = body?.image;
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return sendJson(400, { error: 'bad_image' });
  }

  // Без ключей — 501: приложение понимает этот статус как «нет vision-провайдера»
  // и честно предлагает демо-режим вместо пугающей ошибки
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY?.trim();
  if (!hasOpenRouter && !process.env.GEMINI_API_KEY?.trim()) {
    return sendJson(501, { error: 'no_provider' });
  }

  try {
    const products = hasOpenRouter
      ? await scanWithOpenRouter(image)
      : await scanWithGemini(image);
    if (products.length === 0) {
      return sendJson(502, { error: 'no_ingredients' });
    }
    return sendJson(200, {
      ingredients: products.map((p) => p.name),
      products,
    });
  } catch (err) {
    return sendJson(502, { error: 'scan_failed', detail: errMsg(err) });
  }
}
