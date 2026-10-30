/**
 * Генератор src/data/dish-meta.ts: оценка времени приготовления (timeMin)
 * и сложности (difficulty) для всех блюд.
 *
 * timeMin — из явных указаний в шагах («запекай 25 минут», «полтора часа»):
 * суммируем все упомянутые фазы, +5 минут подготовки; если явных указаний нет —
 * база по категории + надбавка за число шагов. Результат округлён к 5 минутам.
 *
 * difficulty — эвристика по числу шагов и ингредиентов (база однородна:
 * почти все рецепты имеют 4–7 шагов, поэтому пороги относительные):
 *   easy:   шагов ≤ 4
 *   hard:   шагов ≥ 6 или ингредиентов ≥ 9
 *   medium: остальное (обычно 5 шагов и 6–8 продуктов)
 *
 * Скрипт детерминирован: перезапуск даёт тот же файл.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = '/home/z/my-project/src/data';

// Файлы с инлайн-блюдами (dishes-more.ts — реэкспорт, dishes-world.ts — агрегатор)
const SKIP = new Set(['dishes-more.ts', 'dishes-world.ts']);
const files = readdirSync(DIR)
  .filter((f) => /^dishes.*\.ts$/.test(f) && !SKIP.has(f))
  .sort();

const blockRe = /\n  \{\n    id: '([^']+)',([\s\S]*?)\n  \},/g;
const dishes = new Map();

for (const file of files) {
  const src = readFileSync(join(DIR, file), 'utf8');
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    const id = m[1];
    const body = m[2];
    const category = (body.match(/category: '(\w+)'/) ?? [])[1] ?? 'veg';
    const ingBlock = body.match(/ingredients: \[([\s\S]*?)\n    \],/);
    const stepsBlock = body.match(/steps: \[([\s\S]*?)\n    \],/);
    if (!stepsBlock) continue;
    const ingCount = ingBlock ? (ingBlock[1].match(/name: '/g) ?? []).length : 0;
    const steps = [...stepsBlock[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1]);
    if (!dishes.has(id)) dishes.set(id, { id, category, ingCount, steps, file });
  }
}

// ---------- время из текста шагов ----------
const BASE_MIN = {
  breakfast: 10,
  salads: 10,
  veg: 25,
  fish: 20,
  chicken: 30,
  meat: 35,
  soups: 40,
  baking: 55,
};

function explicitMinutes(text) {
  let sum = 0;
  // «3–5 минут», «3-4 мин» → берём верхнюю границу
  for (const m of text.matchAll(/(\d+)\s*[–-]\s*(\d+)\s*(минут|мин|минуты)/gi)) {
    sum += Math.max(Number(m[1]), Number(m[2]));
  }
  // одиночные «25 минут», «10 мин»
  for (const m of text.matchAll(/(\d+)\s*(минут|мин|минуты)(?!\s*[–-]\s*\d)/gi)) {
    // исключаем уже учтённые диапазоны: грубая проверка не нужна —
    // одиночный паттерн с негативным lookahead не матчится внутри «3–5 минут»
    sum += Number(m[1]);
  }
  for (const m of text.matchAll(/(\d+)\s*(часа|часов|час)/gi)) sum += Number(m[1]) * 60;
  if (/полтора\s+часа|1,5\s+часа/i.test(text)) sum += 90;
  if (/полчаса/i.test(text)) sum += 30;
  return sum;
}

function round5(n) {
  return Math.max(5, Math.min(180, Math.round(n / 5) * 5));
}

function estimateTime(d) {
  const explicit = d.steps.reduce((acc, s) => acc + explicitMinutes(s), 0);
  if (explicit > 0) return round5(explicit + 5);
  const base = BASE_MIN[d.category] ?? 25;
  return round5(base + Math.max(0, d.steps.length - 4) * 3);
}

function difficulty(d) {
  if (d.steps.length <= 4) return 'easy';
  if (d.steps.length >= 6 || d.ingCount >= 9) return 'hard';
  return 'medium';
}

// ---------- генерация ----------
const entries = [...dishes.values()].map((d) => ({
  id: d.id,
  timeMin: estimateTime(d),
  difficulty: difficulty(d),
}));

const uniq = new Set(entries.map((e) => e.id));
if (uniq.size !== entries.length || entries.length < 300) {
  console.error(`Неожиданное число блюд: ${entries.length}, уникальных ${uniq.size}`);
  process.exit(1);
}
entries.sort((a, b) => a.id.localeCompare(b.id));

const dist = { easy: 0, medium: 0, hard: 0 };
for (const e of entries) dist[e.difficulty]++;
const timeBuckets = { le15: 0, le30: 0, le60: 0, gt60: 0 };
for (const e of entries) {
  if (e.timeMin <= 15) timeBuckets.le15++;
  else if (e.timeMin <= 30) timeBuckets.le30++;
  else if (e.timeMin <= 60) timeBuckets.le60++;
  else timeBuckets.gt60++;
}

const header = `/**
 * Сгенерировано scripts/add-dish-meta.mjs — НЕ редактировать вручную.
 * timeMin — оценка времени приготовления (мин): явные указания из шагов
 * («запекай 25 минут») + 5 мин подготовки; без указаний — база по категории.
 * difficulty — эвристика по числу шагов и ингредиентов.
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DishMeta {
  timeMin: number;
  difficulty: Difficulty;
}

export const DISH_META: Record<string, DishMeta> = {
`;

const body = entries
  .map((e) => `  '${e.id}': { timeMin: ${e.timeMin}, difficulty: '${e.difficulty}' },`)
  .join('\n');

writeFileSync(join(DIR, 'dish-meta.ts'), `${header}${body}\n};\n`);

console.log(`Файлов прочитано: ${files.length}`);
console.log(`Блюд: ${entries.length}`);
console.log(`Сложность: easy=${dist.easy} medium=${dist.medium} hard=${dist.hard}`);
console.log(
  `Время: ≤15=${timeBuckets.le15} 16-30=${timeBuckets.le30} 31-60=${timeBuckets.le60} >60=${timeBuckets.gt60}`,
);
