/**
 * Выгружает {id: промпт} для ВСЕХ блюд из TS-данных в scripts/photo-subjects.json.
 * Промпт строится из nameEn + кухонных подсказок композиции.
 * Запуск: node scripts/dump-photo-subjects.mjs
 */
import { buildSync } from 'esbuild';
import fs from 'node:fs';

buildSync({
  entryPoints: ['scripts/photo-subjects-entry.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'scripts/photo-subjects-bundle.mjs',
  allowOverwrite: true,
  logLevel: 'silent',
});

const { DISHES, CUISINE_META } = await import('./photo-subjects-bundle.mjs');

const CUISINE_HINT = {
  russian: 'Russian home cooking, simple ceramic plate, rustic style',
  mediterranean: 'Mediterranean dish, olive oil, fresh herbs, terracotta plate',
  italian: 'Italian dish, simple white plate, basil and olive oil',
  thai: 'Thai street food, banana leaf or ceramic bowl, chili and lime on the side',
  chinese: 'Chinese dish, round white plate or bamboo steamer, chopsticks beside',
  japanese: 'Japanese dish, minimal plating, black bowl or wooden tray, chopsticks',
  american: 'American diner style, generous portion, wooden board or enamel plate',
  mexican: 'Mexican dish, colorful ceramic plate, lime wedges and cilantro',
  indian: 'Indian dish, copper or steel bowl, naan bread and fresh cilantro',
  korean: 'Korean dish, small steel side dishes, stone bowl, chopsticks and spoon',
};

const out = {};
for (const d of DISHES) {
  const hint = CUISINE_HINT[d.cuisine ?? 'russian'] ?? CUISINE_HINT.russian;
  out[d.id] = `${d.nameEn}. ${hint}`;
}

fs.writeFileSync('scripts/photo-subjects.json', JSON.stringify(out, null, 1));
console.log(`Готово: ${Object.keys(out).length} промптов → scripts/photo-subjects.json`);
