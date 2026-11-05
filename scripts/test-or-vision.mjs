/**
 * Тест бесплатных vision-моделей OpenRouter на реальном фото из
 * scripts/scan-test-payload.json — параметры запроса идентичны api/scan.ts
 * (SCAN_PROMPT, max_tokens, temperature), чтобы проверить модель до настройки
 * env на Vercel. Запуск: node scripts/test-or-vision.mjs model1 [model2 ...]
 */
import fs from 'node:fs';

const key = fs.readFileSync('/tmp/orkey', 'utf8').trim();
const { image } = JSON.parse(
  fs.readFileSync('/home/z/my-project/scripts/scan-test-payload.json', 'utf8'),
);

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

/** Минимальный парсер — копия логики extractProducts из api/scan.ts */
function extractProducts(raw) {
  if (!raw) return [];
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try { parsed = JSON.parse(m[0]); } catch { return []; }
  }
  const list = parsed?.ingredients;
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    let name = typeof item === 'string' ? item : (item?.name ?? '');
    let conf = item?.confidence === 'medium' || item?.confidence === 'low' ? 'medium' : 'high';
    name = String(name).trim().replace(/^[«"'\-–—\s]+|[«"'\s]+$/g, '');
    if (name.length < 2 || name.length > 40) continue;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name, confidence: conf });
    if (out.length >= 12) break;
  }
  return out;
}

const models = process.argv.slice(2);
if (models.length === 0) models.push('nvidia/nemotron-3.5-super-vl:free');

for (const model of models) {
  const t0 = Date.now();
  process.stdout.write(`\n=== ${model} ===\n`);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'X-Title': 'ScanRecipe',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SCAN_PROMPT },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
        max_tokens: 512,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    process.stdout.write(`HTTP ${res.status}, ${dt} с\n`);
    const j = await res.json();
    if (!res.ok) {
      process.stdout.write(`ОШИБКА: ${JSON.stringify(j).slice(0, 400)}\n`);
      continue;
    }
    const msg = j?.choices?.[0]?.message ?? {};
    const content = msg.content ?? '';
    const finish = j?.choices?.[0]?.finish_reason;
    const usage = j?.usage ?? {};
    process.stdout.write(`finish_reason=${finish}; tokens: prompt=${usage.prompt_tokens} completion=${usage.completion_tokens}\n`);
    process.stdout.write(`content (${content.length} симв.): ${content.slice(0, 500)}\n`);
    if (msg.reasoning) process.stdout.write(`(reasoning ${String(msg.reasoning).length} симв., не показываю)\n`);
    const products = extractProducts(content);
    process.stdout.write(`РАСПАРСЕНО ПРОДУКТОВ: ${products.length}\n`);
    for (const p of products) process.stdout.write(`  - ${p.name} [${p.confidence}]\n`);
  } catch (e) {
    process.stdout.write(`ИСКЛЮЧЕНИЕ: ${e?.message ?? e}\n`);
  }
}
