// Тест: генерация фото блюда своим генератором (z-ai) + критика glm-4.5v.
// Использование: node scripts/test-local-gen.mjs <slug> [prompt-file]
// Промпт по умолчанию берётся из scripts/prompt-overrides.json или photo-subjects.json.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import ZAI from 'z-ai-web-dev-sdk';
import { critiquePhoto } from './photo-critic.mjs';

const slug = process.argv[2];
if (!slug) {
  console.error('usage: node scripts/test-local-gen.mjs <slug> [prompt-file]');
  process.exit(1);
}

// 1) Промпт: аргумент-файл > prompt-overrides.json > photo-subjects.json
let prompt = null;
if (process.argv[3] && fs.existsSync(process.argv[3])) {
  prompt = fs.readFileSync(process.argv[3], 'utf8').trim();
  console.log('промпт из файла:', process.argv[3]);
}
const subjects = JSON.parse(fs.readFileSync('scripts/photo-subjects.json', 'utf8'));
const overrides = fs.existsSync('scripts/prompt-overrides.json')
  ? JSON.parse(fs.readFileSync('scripts/prompt-overrides.json', 'utf8'))
  : {};
const subject = overrides[slug] ?? subjects[slug];
if (!subject) {
  console.error(`нет subject для ${slug}`);
  process.exit(1);
}
if (!prompt) {
  // Стандартный стиль-блок конвейера (как в копи-туле, без изменений промптов):
  prompt =
    subject +
    ', straight-on eye-level camera angle, on a warm terracotta tiled table, ' +
    'softly blurred dark wooden wall with linen textiles in the background, ' +
    'real photograph of appetizing homemade comfort food, cozy rustic homestyle cooking, ' +
    'served on handmade glazed ceramic tableware, simple cutlery and a folded beige linen napkin beside the dish, ' +
    'a few raw ingredients and spices scattered around that naturally match this dish, ' +
    'warm natural side light from a kitchen window, golden warm tone, soft natural shadows, muted natural colors, ' +
    'matte realistic food textures: visible grains and crumb, uneven browning, slightly irregular homemade shapes, ' +
    'sauces with a light oil sheen, a few crumbs on the table, casual home snapshot look, ' +
    'unedited photo from a real home cook, shallow depth of field, 50mm lens look, static view of the table, ' +
    'not a render, not CGI, not 3D, not illustration, no text, no captions, no lettering, no watermark, ' +
    'plastic sheen, artificial gloss, oversharpened, hyperrealistic, 3d render, cgi, fake, synthetic, ' +
    'overly perfect, clinical, sterile, moody dark lighting, dramatic shadows';
}
console.log(`[${slug}] генерирую (1024x1024), промпт ${prompt.length} симв...`);

// 2) Генерация через z-ai CLI
const outPng = `/home/z/my-project/download/${slug}-test.png`;
execSync(`z-ai image -p "${prompt.replace(/"/g, '\\"')}" -o "${outPng}" -s 1024x1024`, {
  stdio: 'inherit',
  timeout: 240000,
});
const png = fs.readFileSync(outPng);
console.log(`сгенерировано: ${outPng} (${(png.length / 1024).toFixed(0)} KB)`);

// 3) Критика glm-4.5v (тот же критик, что в конвейере — промпты не трогаем)
const zai = await ZAI.create();
const qa = await critiquePhoto(zai, png, subject, { attempts: 2 });
console.log('=== ВЕРДИКТ КРИТИКА ===');
console.log(JSON.stringify(qa, null, 2));
fs.writeFileSync(
  `/home/z/my-project/scripts/local-gen-${slug}.json`,
  JSON.stringify({ slug, promptLen: prompt.length, qa, at: new Date().toISOString() }, null, 2)
);
console.log(`json: scripts/local-gen-${slug}.json`);
