// Тест продакшн-параметров сканера (капа reasoning + max_tokens 3000) на двух фото
import fs from 'node:fs';

const key = fs.readFileSync('/tmp/orkey', 'utf8').trim();
const payload = JSON.parse(
  fs.readFileSync('/home/z/my-project/scripts/scan-test-payload.json', 'utf8'),
).image;

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

const photos = [
  ['payload (помидоры/яйца/сыр)', payload],
  ['olivier', `data:image/jpeg;base64,${fs.readFileSync('/home/z/my-project/public/dishes/olivier.jpg').toString('base64')}`],
  ['shakshuka', `data:image/jpeg;base64,${fs.readFileSync('/home/z/my-project/public/dishes/shakshuka.jpg').toString('base64')}`],
];

for (const [label, dataUrl] of photos) {
  const t0 = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Title': 'ScanRecipe',
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3.5-super-vl:free',
      models: ['nvidia/nemotron-3.5-super-vl:free', 'google/gemma-4-26b-a4b-it:free'],
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: SCAN_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
      reasoning: { max_tokens: 1000 },
      max_tokens: 3000,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const j = await res.json().catch(() => null);
  if (!res.ok) { console.log(`${label}: HTTP ${res.status} ${dt}с — ${JSON.stringify(j).slice(0, 150)}`); continue; }
  const msg = j?.choices?.[0]?.message ?? {};
  const content = msg.content ?? '';
  let names = [];
  try {
    const t = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const m = t.match(/\{[\s\S]*\}/) ?? [null, null];
    names = (JSON.parse(m[0] ?? t)?.ingredients ?? []).map((x) => x?.name ?? x);
  } catch { /* покажем сырец */ }
  console.log(`${label}: ${dt}с | finish=${j?.choices?.[0]?.finish_reason} | completion=${j?.usage?.completion_tokens} | ${names.length ? names.join(', ') : 'ПУСТО: ' + content.slice(0, 80)}`);
}
