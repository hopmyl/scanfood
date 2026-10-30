/**
 * Продакшн-сервер СканРецепт для российских хостингов (Amvera, Timeweb Cloud, VPS).
 *
 * Ноль зависимостей: чистый node:http. Один процесс = статика + API:
 *   GET  /                → dist/index.html (+ SPA-фолбэк)
 *   GET  /assets/*        → статика сборки Vite
 *   GET  /dishes/*.jpg    → фото блюд
 *   POST /api/scan        → распознавание продуктов. Провайдер выбирается по env:
 *                           1) AI_BASE_URL + AI_API_KEY (+ AI_MODEL) — любой
 *                              OpenAI-совместимый сервис (Groq, HuggingFace,
 *                              VseGPT, ProxyAPI…);
 *                           2) OPENROUTER_API_KEY — OpenRouter (открыт из РФ);
 *                           3) GEMINI_API_KEY — Gemini (резерв).
 *   GET  /api/barcode     → Open Food Facts по штрих-коду
 *   GET  /api/ping        → healthcheck
 *
 * Запуск: npm run build && npm start   (PORT по умолчанию 3000)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 5 * 1024 * 1024; // 5 МБ — как на Vercel

// ---------------------------------------------------------------------------
// /api/scan — порт api/scan.ts (Gemini). Синхронизируй при изменении промпта.
// ---------------------------------------------------------------------------

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

function errMsg(e) {
  return e instanceof Error ? e.message : String(e);
}

function extractProducts(raw) {
  if (!raw) return [];
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let parsed;
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
  const list = parsed?.ingredients;
  if (!Array.isArray(list)) return [];

  const out = [];
  const seen = new Set();
  for (const item of list) {
    let name = '';
    let confidence = 'high';
    if (typeof item === 'string') {
      name = item;
    } else if (item && typeof item === 'object') {
      name = typeof item.name === 'string' ? item.name : '';
      confidence = item.confidence === 'medium' || item.confidence === 'low' ? 'medium' : 'high';
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
 * Выбор vision-провайдера по переменным окружения (первый заданный побеждает):
 * 1) универсальный OpenAI-совместимый: AI_BASE_URL + AI_API_KEY, модель в AI_MODEL
 * 2) OpenRouter: OPENROUTER_API_KEY (бесплатные vision-модели с суффиксом :free)
 * 3) Gemini: GEMINI_API_KEY (резерв)
 */
function visionProvider() {
  const aiBase = process.env.AI_BASE_URL?.trim();
  const aiKey = process.env.AI_API_KEY?.trim();
  if (aiBase && aiKey) {
    return {
      kind: 'openai',
      base: aiBase.replace(/\/+$/, ''),
      key: aiKey,
      model: process.env.AI_MODEL?.trim() || '',
    };
  }
  const orKey = process.env.OPENROUTER_API_KEY?.trim();
  if (orKey) {
    return {
      kind: 'openai',
      base: 'https://openrouter.ai/api/v1',
      key: orKey,
      model: process.env.OPENROUTER_MODEL?.trim() || 'google/gemma-4-31b-it:free',
    };
  }
  if (process.env.GEMINI_API_KEY?.trim()) return { kind: 'gemini' };
  return null;
}

/**
 * Любой OpenAI-совместимый API: POST {base}/chat/completions с контентом
 * [{type:'text'},{type:'image_url'}]. dataURL передаётся как есть.
 */
async function scanWithOpenAICompat(provider, imageDataUrl) {
  if (!provider.model) {
    throw new Error(
      'AI_MODEL не задан — укажи модель провайдера (например, llama-3.2-11b-vision-instruct для Groq, Qwen/Qwen2.5-VL-7B-Instruct для HuggingFace)',
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  try {
    const res = await fetch(`${provider.base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.key}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.model,
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
      throw new Error(`openai-compat ${res.status}: ${detail}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    return extractProducts(text);
  } finally {
    clearTimeout(timer);
  }
}

async function scanWithGemini(imageDataUrl) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY не задан — укажи его в настройках хостинга');

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
            { parts: [{ text: SCAN_PROMPT }, { inline_data: { mime_type: mime, data: base64 } }] },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
        }),
      },
    );
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      throw new Error(`gemini ${res.status}: ${detail}`);
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? '').join('');
    return extractProducts(text);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// /api/barcode — порт api/barcode.ts (Open Food Facts)
// ---------------------------------------------------------------------------

const barcodeCache = new Map();

function num(v) {
  const n = typeof v === 'string' ? Number.parseFloat(v) : v;
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

function normalizeProduct(barcode, data) {
  const p = data?.product;
  if (!p) return null;
  const name = String(p.product_name_ru || p.product_name || '').trim();
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
    brands:
      String(p.brands || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)[0] ?? '',
    image: p.image_front_small_url || p.image_url || null,
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

function isValidBarcode(code) {
  return /^\d{8,14}$/.test(code);
}

async function lookupBarcode(code) {
  if (barcodeCache.has(code)) return barcodeCache.get(code) ?? null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'SkanRecept/0.4 (PWA; contact: dev@skanrecept.local)' },
      },
    );
    const data = await response.json();
    const product = data?.status === 1 ? normalizeProduct(code, data) : null;
    barcodeCache.set(code, product);
    return product;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// HTTP: маршруты + статика
// ---------------------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(res, urlPath) {
  // Безопасность пути: не выпускаем за пределы dist
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel.includes('..')) rel = '/';
  let filePath = path.join(DIST, rel === '/' ? 'index.html' : rel);
  if (!filePath.startsWith(DIST)) filePath = path.join(DIST, 'index.html');

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // SPA-фолбэк: любой неизвестный путь → index.html
      filePath = path.join(DIST, 'index.html');
    }
    fs.readFile(filePath, (err2, data) => {
      if (err2) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('dist/ не собран — выполни npm run build');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      // Хэшированные ассеты Vite живут вечно, index.html — всегда свежий
      const immutable = filePath.includes(`${path.sep}assets${path.sep}`);
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': immutable
          ? 'public, max-age=31536000, immutable'
          : 'public, max-age=0, must-revalidate',
      });
      res.end(data);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/';

  try {
    if (url === '/api/ping') {
      sendJson(res, 200, { ok: true, ts: Date.now() });
      return;
    }

    if (url === '/api/scan' && req.method === 'POST') {
      let body;
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
      // Без провайдера — 501: клиент понимает этот статус как «демо-режим»
      const provider = visionProvider();
      if (!provider) {
        sendJson(res, 501, { error: 'no_provider' });
        return;
      }
      try {
        const products =
          provider.kind === 'openai'
            ? await scanWithOpenAICompat(provider, image)
            : await scanWithGemini(image);
        if (products.length === 0) {
          sendJson(res, 502, { error: 'no_ingredients' });
          return;
        }
        sendJson(res, 200, { ingredients: products.map((p) => p.name), products });
      } catch (err) {
        sendJson(res, 502, { error: 'scan_failed', detail: errMsg(err) });
      }
      return;
    }

    if (url.startsWith('/api/barcode') && (req.method === 'GET' || req.method === 'HEAD')) {
      const code = (new URL(url, 'http://local').searchParams.get('code') ?? '').trim();
      if (!isValidBarcode(code)) {
        sendJson(res, 400, { error: 'bad_code' });
        return;
      }
      try {
        const product = await lookupBarcode(code);
        sendJson(res, 200, product ? { found: true, product } : { found: false });
      } catch (err) {
        sendJson(res, 502, { error: 'lookup_failed', detail: errMsg(err) });
      }
      return;
    }

    if (url.startsWith('/api/')) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }

    serveStatic(res, url);
  } catch (err) {
    sendJson(res, 500, { error: 'internal', detail: errMsg(err) });
  }
});

server.listen(PORT, () => {
  console.log(`СканРецепт: http://localhost:${PORT} (dist: ${DIST})`);
});
