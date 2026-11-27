// Критик glm-4.5v для ДВУХ фото пользователя (Gemini web, 2026-11-26):
//   upload/Gemini_Generated_Image_e4v5y7e4v5y7e4v5.png -> lazy-vareniki
//   upload/Gemini_Generated_Image_y8o2jmy8o2jmy8o2.png -> son-in-law-eggs
// Единая рубрика photo-critic.mjs, PASS_SCORE=7, критик не изменён.
import fs from 'node:fs';
import ZAI from 'z-ai-web-dev-sdk';
import { critiquePhoto, isPass, flagsStr } from './photo-critic.mjs';

const MAP = [
  ['upload/Gemini_Generated_Image_e4v5y7e4v5y7e4v5.png', 'lazy-vareniki'],
  ['upload/Gemini_Generated_Image_y8o2jmy8o2jmy8o2.png', 'son-in-law-eggs'],
];

const subjects = JSON.parse(fs.readFileSync('scripts/photo-subjects.json', 'utf8'));
const zai = await ZAI.create();
const out = [];
for (const [path, slug] of MAP) {
  const subject = subjects[slug];
  if (!subject) { console.error(`нет subject для ${slug}`); process.exit(1); }
  const qa = await critiquePhoto(zai, path, subject, { attempts: 2 });
  const row = { slug, path, score: qa.score, flags: flagsStr(qa), pass: isPass(qa), note: qa.note };
  out.push(row);
  console.log(JSON.stringify(row));
}
fs.writeFileSync('scripts/critic-user-photos-1126.json', JSON.stringify(out, null, 2));
console.log('-> scripts/critic-user-photos-1126.json');
