/**
 * Собирает файл с промптами для «скрытых» блюд (есть в рецептах, нет фото в public/dishes/).
 * Промпт = subject (photo-subjects.json) + детерминированная сцена sceneFor(id) + DISH_STYLE_BASE
 * — ровно та формула, которую использует конвейер generate-dish-photos.mjs.
 * Запуск: node scripts/make-hidden-prompts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/z/my-project';

// ---------- 1. Стиль и сцены — точная копия из generate-dish-photos.mjs ----------
const DISH_STYLE_BASE =
  'real photograph of appetizing homemade comfort food, cozy rustic homestyle cooking, ' +
  'served on handmade glazed ceramic tableware, ' +
  'simple cutlery and a folded beige linen napkin beside the dish, ' +
  'a few raw ingredients and spices scattered around that naturally match this dish, ' +
  'warm natural side light, golden warm tone, soft gentle shadows, rich but natural colors, ' +
  'real food textures: visible grains and crumb, uneven browning, natural imperfect shapes, glossy natural sauces, ' +
  'shallow depth of field, 50mm lens look, static view of the table, ' +
  'appetizing, mouth-watering, ' +
  'not a render, not CGI, not 3D, not illustration, no text, no captions, no lettering, no watermark';

const ANGLES = [
  'camera at a slight 45-degree angle above the table',
  'straight-on eye-level camera angle',
  'top-down overhead camera angle looking straight down at the dish',
  'low camera angle close to the table surface',
  'camera at a gentle 30-degree angle close to the dish',
];
const TABLES = [
  'on a dark walnut wooden table',
  'on a rustic oak wooden table',
  'on a weathered dark wooden table',
  'on a beige linen cloth over a wooden table',
  'on a warm terracotta tiled table',
  'on a light pine wooden table',
];
const BACKGROUNDS = [
  'softly blurred cozy rustic kitchen in the background',
  'softly blurred dark wooden wall with linen textiles in the background',
  'warmly blurred kitchen shelves with jars and herbs in the background',
  'softly blurred bright window with sheer curtains in the background',
  'gently blurred dark dining room corner in the background',
];

function pickVariant(arr, id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
}
function sceneFor(id, attempt = 0) {
  const salt = attempt === 0 ? id : `${id}::v${attempt}`;
  return `${pickVariant(ANGLES, salt)}, ${pickVariant(TABLES, salt)}, ${pickVariant(BACKGROUNDS, salt)}`;
}

// ---------- 2. Парсинг блюд из TS-данных ----------
const DATA_DIR = path.join(ROOT, 'src/data');
const files = fs.readdirSync(DATA_DIR).filter((f) => /^dishes.*\.ts$/.test(f));

const dishes = new Map(); // id -> { id, nameRu, nameEn, cuisine, ingredients[] }
for (const f of files) {
  const src = fs.readFileSync(path.join(DATA_DIR, f), 'utf8');
  // записи блюд: "  {\n    id: '...'" — режем по открытию блока с 2 пробелами
  const chunks = src.split(/\n  \{\n/).slice(1);
  for (const chunk of chunks) {
    const idm = chunk.match(/^    id: '([a-z0-9-]+)',/m);
    if (!idm) continue;
    const id = idm[1];
    const nameRu = (chunk.match(/^    nameRu: '(.+?)',$/m) || [])[1] || '';
    const nameEn = (chunk.match(/^    nameEn: '(.+?)',$/m) || [])[1] || '';
    const cuisine = (chunk.match(/^    cuisine: '([a-z]+)',$/m) || [])[1] || '';
    const ings = [...chunk.matchAll(/\{ name: '([^']+)'[,}]/g)].map((m) => m[1]);
    if (!dishes.has(id)) dishes.set(id, { id, nameRu, nameEn, cuisine, ingredients: ings });
  }
}

// ---------- 3. Скрытые = блюда без jpg ----------
const photoDir = path.join(ROOT, 'public/dishes');
const photos = new Set(fs.readdirSync(photoDir).filter((f) => f.endsWith('.jpg')).map((f) => f.replace(/\.jpg$/, '')));
const hidden = [...dishes.values()].filter((d) => !photos.has(d.id));

// ---------- 4. Subjects из конвейера ----------
const subjects = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/photo-subjects.json'), 'utf8'));

// Сладкие блюда: у них второе предложение subject'а — дежурная кухня-подсказка
// («basil and olive oil», «lime wedges and cilantro», «naan bread…») — оставляем
// только первое предложение, сервировку даёт DISH_STYLE_BASE.
const DROP_CUISINE_HINT = new Set([
  'gulab-jamun', 'kheer', 'gajar-halwa',
  'tiramisu', 'panna-cotta', 'cannoli', 'affogato',
  'tres-leches-cake', 'churros', 'flan', 'arroz-con-leche', 'conchas',
  'hotteok', 'japanese-cheesecake',
]);
function subjectFor(id) {
  const raw = String(subjects[id] || '').trim();
  const base = DROP_CUISINE_HINT.has(id)
    ? (raw.includes('. ') ? raw.slice(0, raw.indexOf('. ')) : raw)
    : raw;
  // хвостовая точка убирается: промпт склеивается через ", " (иначе «., low camera…»)
  return base.replace(/\.$/, '');
}

// ---------- 5. Компоновка файла ----------
const CUISINE_RU = {
  russian: 'русская',
  italian: 'итальянская',
  mediterranean: 'средиземноморская',
  french: 'французская',
  chinese: 'китайская',
  japanese: 'японская',
  korean: 'корейская',
  thai: 'тайская',
  indian: 'индийская',
  mexican: 'мексиканская',
  american: 'американская',
};
const PANTRY = ['соль', 'перец', 'вода', 'сахар', 'масло', 'специ', 'лавр', 'уксус', 'сода', 'разрыхл', 'желатин'];
const isPantry = (n) => PANTRY.some((p) => n.toLowerCase().startsWith(p));
const ingLine = (d) => {
  const core = d.ingredients.filter((n) => !isPantry(n));
  const rest = d.ingredients.filter(isPantry);
  return [...core, ...rest].slice(0, 8).join(', ');
};

const cuisineOrder = ['russian', 'mediterranean', 'italian', 'french', 'american', 'mexican', 'chinese', 'japanese', 'korean', 'thai', 'indian'];
hidden.sort((a, b) => {
  const ca = cuisineOrder.indexOf(a.cuisine), cb = cuisineOrder.indexOf(b.cuisine);
  if (ca !== cb) return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
  return a.id.localeCompare(b.id);
});

const out = [];
out.push('# СканРецепт — промпты для фото скрытых блюд');
out.push('');
out.push(`**Блюд без фото: ${hidden.length}** · сгенерировано ${new Date().toISOString().slice(0, 10)} · стиль и формула — те же, что у фотоконвейера сайта (v6).`);
out.push('');
out.push('## Как пользоваться (Gemini / Nano Banana)');
out.push('');
out.push('1. Копируй промпт **целиком** — фирменный стиль сайта уже вшит внутрь, менять ничего не нужно.');
out.push('2. Формат кадра: **квадрат 1:1** (как на сайте; 1024×1024 или выше).');
out.push('3. Сохрани результат как `public/dishes/<id>.jpg` — id и путь указаны у каждого промпта. Имя файла менять нельзя.');
out.push('4. Не добавляй на фото текст, логотипы и водяные знаки — фото-критик сайта такое помечает браком.');
out.push('5. Когда часть фото готова — напиши боту: добавлю файлы, пересоберу манифест, задеплою на оба зеркала и прогоню аудит.');
out.push('');
out.push('Под каждым промптом — состав блюда из рецепта (RU): по нему удобно проверять, что на фото узнаваемы ключевые ингредиенты (иначе критик пометит «не то блюдо» и фото придётся переделывать).');
out.push('');
out.push('---');
out.push('');

let n = 0;
let noSubject = [];
for (const d of hidden) {
  n++;
  const subject = subjectFor(d.id);
  if (!subject) noSubject.push(d.id);
  const scene = sceneFor(d.id, 0);
  const prompt = `${subject}, ${scene}, ${DISH_STYLE_BASE}`;
  const cuisine = CUISINE_RU[d.cuisine] || d.cuisine || '—';
  out.push(`### ${n}. \`${d.id}\` — ${d.nameRu || d.nameEn}`);
  out.push('');
  out.push(`*Кухня: ${cuisine} · файл: \`public/dishes/${d.id}.jpg\`*`);
  out.push('');
  out.push('```text');
  out.push(prompt);
  out.push('```');
  out.push('');
  if (d.ingredients.length) {
    out.push(`*Состав для проверки:* ${ingLine(d)}`);
    out.push('');
  }
}

const OUT = path.join(ROOT, 'download/промпты-скрытых-блюд.md');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out.join('\n'), 'utf8');

console.log(`блюд всего: ${dishes.size}, фото: ${photos.size}, скрытых: ${hidden.length}`);
console.log(`без subject: ${noSubject.length ? noSubject.join(', ') : 'нет'}`);
console.log(`файл: ${OUT}`);
