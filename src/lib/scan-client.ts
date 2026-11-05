/**
 * Клиентская цепочка распознавания продуктов по фото.
 *
 * Порядок попыток (первая успешная побеждает):
 *   1) POST /api/scan с того же origin — работает на хостингах с serverless
 *      (Vercel, Netlify);
 *   2) POST на VITE_SCAN_API_URL — адрес внешнего деплоя этого же API,
 *      заданный при сборке зеркала (CORS включён в api/scan.ts и
 *      netlify/functions/scan.ts);
 *   3) OpenRouter прямо из браузера — только если при сборке задан
 *      VITE_OPENROUTER_KEY (⚠️ ключ попадает в публичный бандл: используй
 *      ключ с нулевым кредитным лимитом и только бесплатные модели);
 *   4) ничего не сработало → { ok:false, reason:'unavailable' } — вызывающий
 *      код честно предлагает демо-скан вместо пугающей ошибки.
 *
 * Статусы 404 и 405 означают «статический хостинг без /api» (GitHub Pages
 * отвечает 405 «Method Not Allowed» на любой POST), 501 — «сервер без
 * vision-ключей». Все три считаются «распознавание недоступно» и ведут к
 * следующей попытке, а не к ошибке у пользователя.
 */

/** Распознанный продукт с уверенностью модели */
export interface DetectedProduct {
  name: string;
  confidence: 'high' | 'medium';
}

/** Итог цепочки: ok — список продуктов; иначе причина («демо» или «ошибка») */
export type ScanOutcome =
  | { ok: true; products: DetectedProduct[]; via: string }
  | { ok: false; reason: 'unavailable' | 'failed'; detail: string | null };

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

/** Таймауты: серверные функции отвечают до ~45 с, браузер-провайдер — до 60 с.
 *  Суммарное ожидание цепочки не растёт бесконечно: на статическом хостинге
 *  /api/scan отвечает 405 мгновенно, дальше максимум 45 + 60 с. */
const ENDPOINT_TIMEOUT = 45_000;
const DIRECT_TIMEOUT = 60_000;

/** Бесплатные vision-модели OpenRouter — цепочка фолбэков для тестового периода:
 *  если первая модель перегружена или недоступна, роутер сам попробует следующую.
 *  Основная — nvidia/nemotron (см. scanProducts): без гео-блока Google и быстрая;
 *  gemma-*:free из РФ режется Google AI Studio, оставлена запасной. dots-*:free
 *  исключён — reasoning-модель, съедает весь бюджет токенов на рассуждение. */
const FREE_VISION_FALLBACKS = [
  'google/gemma-4-26b-a4b-it:free',
] as const;

/**
 * Парсит ответ модели. Терпим к формату: принимает и объекты {name, confidence},
 * и старые строки; убирает markdown-обёртки ```json … ```.
 */
export function extractProducts(raw: string): DetectedProduct[] {
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

/** Продукты из ответа серверного эндпоинта ({products} или старый {ingredients}) */
function productsFromEndpoint(data: unknown): DetectedProduct[] {
  const d = data as {
    products?: Array<{ name?: unknown; confidence?: unknown }>;
    ingredients?: unknown[];
  };
  const raw: Array<{ name: string; confidence?: string }> =
    Array.isArray(d?.products) && d.products.length > 0
      ? d.products.map((p) => ({
          name: typeof p?.name === 'string' ? p.name : '',
          confidence: typeof p?.confidence === 'string' ? p.confidence : undefined,
        }))
      : (Array.isArray(d?.ingredients) ? d.ingredients : []).map((n) => ({
          name: typeof n === 'string' ? n : '',
        }));
  return raw
    .filter((p) => p.name)
    .map((p) => ({
      name: p.name,
      confidence: p.confidence === 'medium' || p.confidence === 'low' ? 'medium' : 'high',
    }));
}

/** fetch c таймаутом и JSON-телом */
async function postJson(
  url: string,
  body: unknown,
  timeoutMs: number,
  headers: Record<string, string> = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Одна попытка: серверный эндпоинт с контрактом {image} → {products} */
async function tryScanEndpoint(
  url: string,
  dataUrl: string,
  label: string,
): Promise<ScanOutcome> {
  try {
    const r = await postJson(url, { image: dataUrl }, ENDPOINT_TIMEOUT);
    // 404/405 — статический хостинг (GitHub Pages отдаёт 405 на POST),
    // 501 — сервер без vision-провайдера: честно идём к следующей попытке
    if (r.status === 404 || r.status === 405 || r.status === 501) {
      return { ok: false, reason: 'unavailable', detail: `${label} ${r.status}` };
    }
    if (!r.ok) {
      let detail = `${label} ${r.status}`;
      try {
        const j = (await r.json()) as { error?: unknown; detail?: unknown };
        if (j?.error === 'no_ingredients') detail = 'на фото не удалось найти продукты';
        else if (typeof j?.detail === 'string') detail = j.detail.slice(0, 160);
      } catch {
        /* тело не JSON (например, html-заглушка хостинга) — остаётся статус */
      }
      // 429 — лимит запросов ИИ: понятный текст вместо сырого ответа провайдера
      if (r.status === 429 || /429|Too many requests|rate.?limit/i.test(detail)) {
        detail = 'сервис распознавания перегружен — попробуйте ещё раз через минуту';
      }
      return { ok: false, reason: 'failed', detail };
    }
    const products = productsFromEndpoint(await r.json());
    if (products.length === 0) {
      return { ok: false, reason: 'failed', detail: 'на фото не удалось найти продукты' };
    }
    return { ok: true, products, via: label };
  } catch (e) {
    return {
      ok: false,
      reason: 'failed',
      detail: e instanceof Error ? (e.name === 'AbortError' ? 'сервер не ответил за 45 с' : e.message) : String(e),
    };
  }
}

/** Одна попытка: OpenRouter напрямую из браузера (CORS открыт, ключ зашит при сборке).
 *  fallbacks — дополнительные бесплатные модели, если основная недоступна. */
async function tryDirectOpenRouter(
  key: string,
  model: string,
  dataUrl: string,
  fallbacks?: readonly string[],
): Promise<ScanOutcome> {
  try {
    const r = await postJson(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        ...(fallbacks && fallbacks.length > 0 ? { models: [model, ...fallbacks] } : {}),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SCAN_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        // 2000, а не 512: у reasoning-моделей рассуждение идёт в те же токены
        max_tokens: 2000,
        temperature: 0.2,
      },
      DIRECT_TIMEOUT,
      { Authorization: `Bearer ${key}`, 'X-Title': 'ScanRecipe' },
    );
    if (!r.ok) {
      let detail = `openrouter ${r.status}`;
      try {
        detail = `openrouter ${r.status}: ${(await r.text()).slice(0, 140)}`;
      } catch {
        /* без тела */
      }
      // 429 — лимит запросов: понятный текст вместо сырого ответа провайдера
      if (r.status === 429 || /429|Too many requests|rate.?limit/i.test(detail)) {
        detail = 'сервис распознавания перегружен — попробуйте ещё раз через минуту';
      }
      // неверный/исчерпанный ключ — это «недоступно» (демо), а не «ошибка»
      return { ok: false, reason: r.status === 401 || r.status === 402 || r.status === 403 ? 'unavailable' : 'failed', detail };
    }
    const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const products = extractProducts(data?.choices?.[0]?.message?.content ?? '');
    if (products.length === 0) {
      return { ok: false, reason: 'failed', detail: 'модель не вернула список продуктов' };
    }
    return { ok: true, products, via: 'openrouter (браузер)' };
  } catch (e) {
    return {
      ok: false,
      reason: 'failed',
      detail:
        e instanceof Error
          ? e.name === 'AbortError'
            ? 'openrouter не ответил за 60 с'
            : e.message
          : String(e),
    };
  }
}

/**
 * Вся цепочка. Выполняет попытки по очереди; первый успех возвращает результат,
 * иначе сводка: реальная ошибка (failed) важнее «распознавание недоступно».
 */
export async function scanProducts(dataUrl: string): Promise<ScanOutcome> {
  const attempts: ScanOutcome[] = [];

  // 1) тот же origin
  const sameOrigin = await tryScanEndpoint('/api/scan', dataUrl, 'scan api');
  if (sameOrigin.ok) return sameOrigin;
  attempts.push(sameOrigin);

  // 2) внешний API, заданный при сборке зеркала
  const alt = (import.meta.env.VITE_SCAN_API_URL as string | undefined)?.trim();
  if (alt) {
    const url = /\/api\/scan\/?$/.test(alt) ? alt : `${alt.replace(/\/+$/, '')}/api/scan`;
    const out = await tryScanEndpoint(url, dataUrl, 'внешний scan api');
    if (out.ok) return out;
    attempts.push(out);
  }

  // 3) OpenRouter из браузера — только если ключ зашит при сборке.
  // Бесплатный тариф OpenRouter открыт из РФ без VPN, без карты:
  // ~50 сканов/сутки на бесплатных моделях — хватает на время тестирования.
  // Передаём массив моделей: если первая занята/недоступна, OpenRouter сам
  // попробует следующую бесплатную vision-модель.
  const key = (import.meta.env.VITE_OPENROUTER_KEY as string | undefined)?.trim();
  if (key) {
    const configured = (import.meta.env.VITE_OPENROUTER_MODEL as string | undefined)?.trim();
    // Дефолт — nemotron: без гео-блока Google AI Studio (gemma-*:free из РФ режутся)
    const model = configured || 'nvidia/nemotron-3.5-super-vl:free';
    const out = await tryDirectOpenRouter(key, model, dataUrl, configured ? undefined : FREE_VISION_FALLBACKS);
    if (out.ok) return out;
    attempts.push(out);
  }

  const failed = attempts.find((a) => !a.ok && a.reason === 'failed');
  return failed ?? { ok: false, reason: 'unavailable', detail: null };
}
