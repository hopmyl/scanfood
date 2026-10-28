/**
 * Финальная нормализация: удаляет ЛЮБЫЕ ingredient-записи, чей name
 * (или name + ' — ' + note) совпадает с шагом рецепта. Пересобирает
 * массив ingredients в каноничном формате.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = '/home/z/my-project/src/data/dishes.ts';
let src = readFileSync(PATH, 'utf8');

let removed = 0;
let kept = 0;

src = src.replace(/\n  \{\n    id: '([^']+)',([\s\S]*?)\n  \},/g, (block) => {
  const stepsArr = block.match(/steps: \[([\s\S]*?)\n    \],/);
  const steps = new Set([...stepsArr[1].matchAll(/'([^']*)'/g)].map((x) => x[1]));

  const ingArrMatch = block.match(/ingredients: \[\n([\s\S]*?)\n    \],/);
  const lines = ingArrMatch[1].split('\n');

  const keptLines = lines.filter((line) => {
    const nameM = line.match(/\{ name: '([^']*)'/);
    if (!nameM) return true; // не ингредиент — не трогаем
    const noteM = line.match(/, note: '([^']*)'/);
    const name = nameM[1];
    const recon = noteM ? `${name} — ${noteM[1]}` : name;
    if (steps.has(name) || steps.has(recon)) {
      removed++;
      return false;
    }
    kept++;
    return true;
  });

  const fixedIng = `ingredients: [\n${keptLines.join('\n')}\n    ],`;
  return block.replace(/ingredients: \[\n[\s\S]*?\n    \],/, fixedIng);
});

writeFileSync(PATH, src, 'utf8');
console.log(`Удалено фантомов: ${removed}, оставлено ингредиентов: ${kept}`);
