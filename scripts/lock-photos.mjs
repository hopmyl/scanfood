// Заморозка фото, прошедших рубрику критика: пишет sha256 каждого файла в
// scripts/photo-locks.json. Замороженные фото аудит и qa-runner больше не
// трогают — гарантия «сделали и больше не переделываем» (запрос пользователя
// 2026-11-05). Критерий заморозки:
//   - score >= 7 и ни одного флага (пар/пластик/текст/люди/не-то/глянец), ЛИБО
//   - фото утверждено пользователем лично (qa-approve.txt) — его воля финальна;
//   - и НЕ в qa-manual.txt (ручной список — значит сомнения остались).
// Повторный запуск идемпотентен: замки сливаются, хэши обновляются.
// Запуск: node scripts/lock-photos.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';

const OUT_DIR = 'public/dishes';
const REPORT = 'scripts/realism-report.json';
const LOCKS_FILE = 'scripts/photo-locks.json';
const readIds = (f) => {
  try {
    return fs.readFileSync(f, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
};
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const locks = fs.existsSync(LOCKS_FILE) ? JSON.parse(fs.readFileSync(LOCKS_FILE, 'utf8')) : {};
const approved = new Set(readIds('scripts/qa-approve.txt'));
const manual = new Set(readIds('scripts/qa-manual.txt'));

let locked = 0, skippedManual = 0, noReport = 0;
for (const [id, r] of Object.entries(report)) {
  const file = `${OUT_DIR}/${id}.jpg`;
  if (!fs.existsSync(file)) continue;
  if (manual.has(id) && !approved.has(id)) {
    skippedManual++;
    continue; // в ручном списке — сомнения, не морозим
  }
  const passes = r.score >= 7 && !r.steam && !r.plastic && !r.text && !r.people && !r.wrong && !r.glamor;
  if (!passes && !approved.has(id)) continue;
  if (r.score < 0 && !approved.has(id)) continue; // ошибка критика — пусть доаудитится
  locks[id] = {
    sha256: sha256(fs.readFileSync(file)),
    at: new Date().toISOString(),
    score: r.score,
    src: approved.has(id) ? 'user-approved' : 'audit-v7',
  };
  locked++;
}
// Фото без записи в отчёте не замораживаем — сначала аудит.
const photoIds = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4));
for (const id of photoIds) if (!report[id]) noReport++;

fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks, null, 1));
console.log(`Заморожено: ${locked} (утверждённых: ${approved.size}); пропущено из qa-manual: ${skippedManual}; без отчёта: ${noReport}`);
console.log(`Всего фото: ${photoIds.length}, замков в файле: ${Object.keys(locks).length}`);
