// Генерирует src/data/photo-manifest.ts — список блюд, у которых ЕСТЬ фото
// (public/dishes/<id>.jpg, файлы > 20 КБ — отсекаем обрезки/заглушки).
// Запускается автоматически перед каждой сборкой (npm prebuild, см. package.json):
// карточки блюд без фото скрыты из каталога и появляются по мере добавления фото.
// Ручной запуск: node scripts/make-photo-manifest.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const DISHES_DIR = path.join(ROOT, 'public', 'dishes');
const OUT = path.join(ROOT, 'src', 'data', 'photo-manifest.ts');

const MIN_BYTES = 20_000; // меньше — битое/заглушечное фото

const ids = fs
  .readdirSync(DISHES_DIR)
  .filter((f) => f.endsWith('.jpg'))
  .filter((f) => fs.statSync(path.join(DISHES_DIR, f)).size >= MIN_BYTES)
  .map((f) => f.replace(/\.jpg$/, ''))
  .sort();

const body = `// GENERATED FILE — не править руками.
// Обновляется скриптом scripts/make-photo-manifest.mjs перед каждой сборкой
// (npm prebuild). Список блюд, у которых есть фото в public/dishes.
// Карточки блюд без фото скрыты из каталога (решение пользователя 2026-10-31).
export const PHOTO_IDS: ReadonlySet<string> = new Set([
${ids.map((id) => `  '${id}',`).join('\n')}
]);
`;

fs.writeFileSync(OUT, body);
console.log(`photo-manifest: ${ids.length} фото -> ${path.relative(ROOT, OUT)}`);
