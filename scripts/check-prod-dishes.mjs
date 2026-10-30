// Сравнивает dish-id из локальных шриф данных с тем, что реально в прод-бандле
import fs from 'node:fs';
import path from 'node:path';

const SRC = '/home/z/my-project/src/data';
const BUNDLE = process.argv[2] || '/tmp/prod-bundle.js';
const bundle = fs.readFileSync(BUNDLE, 'utf8');

const files = fs.readdirSync(SRC).filter((f) => f.startsWith('dishes') && f.endsWith('.ts'));
let totalLocal = 0;
let totalInProd = 0;
const missing = [];

for (const f of files) {
  const text = fs.readFileSync(path.join(SRC, f), 'utf8');
  const ids = [...text.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
  // убираем id товаров холодильника (у них есть поле inFridge/inShelf в этом же объекте — грубо: в dishes.ts)
  let inProd = 0;
  const miss = [];
  for (const id of ids) {
    if (bundle.includes(`id:"${id}"`) || bundle.includes(`id:'${id}'`) || bundle.includes(`"${id}"`)) inProd++;
    else miss.push(id);
  }
  if (ids.length) {
    console.log(`${f.padEnd(28)} локально: ${String(ids.length).padStart(3)}  в проде: ${String(inProd).padStart(3)}  нет: ${miss.length}`);
    totalLocal += ids.length;
    totalInProd += inProd;
    if (miss.length) missing.push({ file: f, ids: miss });
  }
}

console.log('---');
console.log(`ИТОГО локально: ${totalLocal}, в прод-бандле: ${totalInProd}, отсутствует: ${totalLocal - totalInProd}`);
for (const m of missing) console.log(`  ${m.file}: ${m.ids.slice(0, 6).join(', ')}${m.ids.length > 6 ? ' …' : ''}`);
