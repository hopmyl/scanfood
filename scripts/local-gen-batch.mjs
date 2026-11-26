// Батч-генерация фото блюд ЛОКАЛЬНЫМ генератором песочницы (z-ai) + критика конвейера.
// Правила приёма те же, что в qa-runner: isPass (score>=7, флаги чистые), иначе 1 реролл.
// Использование: node scripts/local-gen-batch.mjs [N=10]
// Результат: download/<slug>-gen.png (passers) + scripts/local-gen-batch-results.json
// Промпты НЕ меняем: subjects[slug] + стандартный стиль-блок копи-тула.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import ZAI from 'z-ai-web-dev-sdk';
import { critiquePhoto, isPass, flagsStr } from './photo-critic.mjs';

const N = Number(process.argv[2]) || 10;

const subjects = JSON.parse(fs.readFileSync('scripts/photo-subjects.json', 'utf8'));
const shortlist = fs.readFileSync('scripts/regen-shortlist.txt', 'utf8')
  .split('\n').map(s => s.trim()).filter(Boolean);
const progress = new Set(fs.readFileSync('scripts/regen-progress.txt', 'utf8')
  .split('\n').map(s => s.trim()).filter(Boolean));
const locks = JSON.parse(fs.readFileSync('scripts/photo-locks.json', 'utf8'));

const pending = shortlist.filter(s => !progress.has(s) && !locks[s]);
const batch = pending.slice(0, N);
console.log(`пендинг: ${pending.length}, берём первых ${batch.length}: ${batch.join(', ')}`);

// УСИЛЕННЫЙ стиль-блок v2 (апгрейд по запросу пользователя 2026-11-25: цель 9-10/10).
// Против пластика: amateur-якорь в начале, matte/rough/шум; против глянца: светлый день, без студии.
// Критик photo-critic.mjs НЕ тронут — баллы сравнимы.
const STYLE =
  ', casual amateur food photo shot on a phone camera, eye-level straight-on view, ' +
  'bright soft daylight from a kitchen window, airy light scene, no studio lighting, ' +
  'on a warm terracotta tiled table, softly blurred warm beige wall with linen textiles in the background, ' +
  'real homemade comfort food on a simple matte ceramic plate, slightly messy honest home plating, ' +
  'a folded beige linen napkin beside the dish, ' +
  'a few raw ingredients and spices scattered around that naturally match this dish, ' +
  'golden warm tone, soft natural shadows, muted natural colors, ' +
  'rough matte food textures: visible grains and crumb, uneven browning, slightly irregular homemade shapes, ' +
  'meat and chicken look fibrous and dry-matte with natural juices, never waxy or uniform, ' +
  'sauces with a light oil sheen, a few crumbs on the table, ' +
  'realistic dynamic range, slight photo noise, unedited casual snapshot from a real home cook, ' +
  'shallow depth of field, 50mm lens look, static view of the table, ' +
  'not a render, not CGI, not 3D, not illustration, no plastic sheen, no wax texture, no artificial gloss, ' +
  'no studio advertising style, no dark moody lighting, no dramatic shadows, not oversharpened, not hyperrealistic, ' +
  'no text anywhere in the frame, no captions, no lettering, blank or unlabeled jars and packages only';

const zai = await ZAI.create();
// Возобновляемость: подтягиваем прошлые результаты, skip passers.
const RES = 'scripts/local-gen-batch-results.json';
const prev = fs.existsSync(RES) ? JSON.parse(fs.readFileSync(RES, 'utf8')) : null;
const pass = prev?.pass ?? {};
const fail = prev?.fail ?? {};
const log = prev?.log ?? [];
const done = new Set([...Object.keys(pass), ...Object.keys(fail)]);
const todo = batch.filter(s => !done.has(s));
if (done.size) console.log(`возобновление: пропускаю уже обработанные (${done.size}), осталось ${todo.length}`);

const save = () => fs.writeFileSync(RES, JSON.stringify(
  { at: new Date().toISOString(), batch, pass, fail, log }, null, 2));

// Тайм-гард: чистый выход через ~9 минут (лимит вызова 10 мин, песочница всё равно убивает).
const T0 = Date.now();
const LEFT_MS = 9.2 * 60 * 1000;

for (const slug of todo) {
  if (Date.now() - T0 > LEFT_MS) { console.log('тайм-гард: выхожу чисто, докатит следующий вызов'); break; }
  const subject = subjects[slug];
  if (!subject) { fail[slug] = 'нет subject'; save(); continue; }
  const prompt = subject + STYLE;
  let best = null, bestPath = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const out = `/home/z/my-project/download/${slug}-gen.png`;
    try {
      execSync(`z-ai image -p "${prompt.replace(/"/g, '\\"')}" -o "${out}" -s 1024x1024`, {
        stdio: 'pipe', timeout: 240000,
      });
    } catch (e) {
      log.push(`${slug} попытка${attempt}: генерация упала ${String(e.message).slice(0, 60)}`);
      continue;
    }
    const png = fs.readFileSync(out);
    const qa = await critiquePhoto(zai, png, subject, { attempts: 1 });
    log.push(`${slug} попытка${attempt}: score=${qa.score} flags=${flagsStr(qa)} — ${qa.note}`);
    if (isPass(qa)) { best = qa; bestPath = out; break; }
    if (!best || qa.score > best.score) { best = qa; bestPath = out; }
  }

  if (best && isPass(best)) {
    pass[slug] = { score: best.score, note: best.note, path: bestPath };
    console.log(`✓ ${slug}: score=${best.score} PASS`);
  } else {
    fail[slug] = best
      ? `score=${best.score} flags=${flagsStr(best)} — ${best.note}`
      : 'генерация не удалась (2 попытки)';
    console.log(`✗ ${slug}: ${fail[slug]}`);
  }
  save(); // инкрементально: таймаут ничего не теряет
}

console.log(`\nИТОГ: pass=${Object.keys(pass).length}/${batch.length}, fail=${Object.keys(fail).length}`);
console.log('results -> scripts/local-gen-batch-results.json');
