/**
 * Статистика тиров free/pro по категориям (только блюда с фото = видимые).
 * Запуск: node scripts/tier-stats.mjs [--json]
 */
import fs from 'node:fs';

const files = fs
  .readdirSync('src/data')
  .filter((f) => (f.startsWith('dishes-') || f === 'dishes.ts') && f.endsWith('.ts'));
const cat = {};
for (const f of files) {
  const src = fs.readFileSync(`src/data/${f}`, 'utf8');
  const re = /id:\s*'([\w-]+)',[\s\S]*?category:\s*'(\w+)'(?![\s\S]{0,40}id:\s*')/g;
  let m;
  while ((m = re.exec(src))) cat[m[1]] = m[2];
}

const dishesTs = fs.readFileSync('src/data/dishes.ts', 'utf8');
const worldTs = fs.readFileSync('src/data/dishes-world.ts', 'utf8');
const block = dishesTs.match(/export const PRO_DISH_IDS[\s\S]*?\n\]\);/)[0];
const worldBlock = worldTs.match(/export const WORLD_PRO_IDS[\s\S]*?\n\];/)[0];
const grab = (s) => [...s.matchAll(/'([\w-]+)'/g)].map((x) => x[1]).filter((x) => x.length > 2);
const proIds = new Set([...grab(block), ...grab(worldBlock)]);

const manTs = fs.readFileSync('src/data/photo-manifest.ts', 'utf8');
const photoIds = new Set(grab(manTs));

const dist = {};
for (const [id, c] of Object.entries(cat)) {
  if (!photoIds.has(id)) continue;
  dist[c] ??= { free: 0, pro: 0 };
  proIds.has(id) ? dist[c].pro++ : dist[c].free++;
}

let tf = 0, tp = 0;
const rows = [];
for (const c of Object.keys(dist).sort()) {
  const { free, pro } = dist[c];
  tf += free; tp += pro;
  rows.push({ category: c, free, pro, total: free + pro });
  console.log(c.padEnd(10), `free=${String(free).padStart(3)}`, `pro=${String(pro).padStart(3)}`, ` total=${free + pro}`);
}
console.log('ИТОГО free=' + tf, 'pro=' + tp, 'всего с фото=' + (tf + tp));

const worldSrc = fs.readFileSync('src/data/dishes-world.ts', 'utf8');
const worldWithPhoto = Object.keys(cat).filter((id) => photoIds.has(id) && worldSrc.includes(`'${id}'`));
console.log('кухни мира с фото:', worldWithPhoto.length, '(pro из них:', worldWithPhoto.filter((id) => proIds.has(id)).length + ')');

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rows, totals: { free: tf, pro: tp }, worldWithPhoto: worldWithPhoto.length }, null, 1));
}
