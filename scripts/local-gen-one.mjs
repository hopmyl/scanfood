// Регенерация ОДНОГО блюда локальным генератором песочницы (z-ai) + критик glm-4.5v.
// Использование: node scripts/local-gen-one.mjs <slug> [attempts=3]
// Промпт: prompt-overrides.json[slug] ?? photo-subjects.json[slug] + STYLE (gen-style.mjs).
// Критик photo-critic.mjs НЕ тронут (PASS_SCORE=7). Лучший кадр -> download/<slug>-gen.png.
// Результат: scripts/local-gen-one-<slug>.json; exit 2, если PASS не достигнут.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import ZAI from 'z-ai-web-dev-sdk';
import { critiquePhoto, isPass, flagsStr } from './photo-critic.mjs';
import { STYLE } from './gen-style.mjs';

const slug = process.argv[2];
const ATTEMPTS = Number(process.argv[3]) || 3;
if (!slug) {
  console.error('usage: node scripts/local-gen-one.mjs <slug> [attempts]');
  process.exit(1);
}

const subjects = JSON.parse(fs.readFileSync('scripts/photo-subjects.json', 'utf8'));
const overrides = fs.existsSync('scripts/prompt-overrides.json')
  ? JSON.parse(fs.readFileSync('scripts/prompt-overrides.json', 'utf8'))
  : {};
const subject = overrides[slug] ?? subjects[slug];
if (!subject) { console.error(`нет subject для ${slug}`); process.exit(1); }

const prompt = subject + STYLE;
console.log(`slug=${slug} попыток=${ATTEMPTS} промпт=${overrides[slug] ? 'override' : 'subjects'}`);

const zai = await ZAI.create();
const outA = (a) => `/home/z/my-project/download/${slug}-gen-a${a}.png`;
let best = null; // { qa, a }

for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  try {
    execSync(`z-ai image -p "${prompt.replace(/"/g, '\\"')}" -o "${outA(attempt)}" -s 1024x1024`, {
      stdio: 'pipe', timeout: 240000,
    });
  } catch (e) {
    console.log(`попытка${attempt}: генерация упала ${String(e.message).slice(0, 60)}`);
    continue;
  }
  const png = fs.readFileSync(outA(attempt));
  const qa = await critiquePhoto(zai, png, subject, { attempts: 1 });
  console.log(`попытка${attempt}: score=${qa.score} flags=${flagsStr(qa)} — ${qa.note}`);
  if (isPass(qa)) { best = { qa, a: attempt }; break; }
  if (!best || qa.score > best.qa.score) best = { qa, a: attempt };
}

let result;
if (best) {
  fs.copyFileSync(outA(best.a), `/home/z/my-project/download/${slug}-gen.png`);
  result = {
    slug, attempts: ATTEMPTS, bestAttempt: best.a,
    pass: isPass(best.qa), score: best.qa.score,
    flags: flagsStr(best.qa), note: best.qa.note,
    path: `/home/z/my-project/download/${slug}-gen.png`,
  };
} else {
  result = { slug, attempts: ATTEMPTS, pass: false, score: 0, flags: 'none', note: 'генерация не удалась', path: null };
}
fs.writeFileSync(`scripts/local-gen-one-${slug}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
if (!result.pass) process.exit(2);
