// Аудит фотореалистичности блюд через ЕДИНУЮ рубрику агента-критика
// (scripts/photo-critic.mjs, glm-4.5v). Для каждого public/dishes/<id>.jpg —
// score 1-10 + флаги (пар/пластик/текст/люди/не-то-блюдо) + сверка с subject'ом
// блюда из photo-subjects.json (детектор дрейфа: сырники -> блины).
// Результат инкрементально пишется в scripts/realism-report.json.
// Правила переаудита:
//   - новые фото проверяются всегда;
//   - перегенерированные (mtime файла новее записи отчёта) — перепроверяются;
//   - ошибочные записи (score -1) — перепроверяются;
//   - остальное пропускается (без --rerun).
// Брак (<6 или любой флаг) ДОБАЛЯЕТСЯ (слиянием, без затирания пендинга) в
// scripts/regen-shortlist.txt — его первым подхватывает конвейер генерации.
// Запуск: node scripts/check-photo-realism.mjs [--rerun] [--only=id1,id2] [--limit=N]
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'node:fs';
import path from 'node:path';
import { critiquePhoto, isBad, flagsStr } from './photo-critic.mjs';

const OUT_DIR = 'public/dishes';
const REPORT = 'scripts/realism-report.json';
const SHORTLIST = 'scripts/regen-shortlist.txt';
const SUBJECTS = fs.existsSync('scripts/photo-subjects.json')
  ? JSON.parse(fs.readFileSync('scripts/photo-subjects.json', 'utf8'))
  : {};
// Иммунитет: фото, утверждённые пользователем лично (qa-approve.txt) — аудит
// фиксирует их score, но НЕ отправляет на перегенерацию.
const APPROVED = new Set(
  fs.existsSync('scripts/qa-approve.txt')
    ? fs.readFileSync('scripts/qa-approve.txt', 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
    : [],
);

const rerun = process.argv.includes('--rerun');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const onlyIds = onlyArg
  ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : null;
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) || null : null;

const report = fs.existsSync(REPORT) && !rerun
  ? JSON.parse(fs.readFileSync(REPORT, 'utf8'))
  : {};

async function main() {
  const zai = await ZAI.create();
  const allIds = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.jpg'))
    .map((f) => f.replace('.jpg', ''))
    .filter((id) => (onlyIds ? onlyIds.includes(id) : true))
    .sort();

  const ids = [];
  for (const id of allIds) {
    const file = path.join(OUT_DIR, `${id}.jpg`);
    const mtime = fs.statSync(file).mtimeMs;
    const prev = report[id];
    const stale =
      !prev || prev.score < 0 || rerun || (prev.mtime !== undefined && mtime > prev.mtime + 1000);
    // Старые записи без mtime считаем актуальными, если score > 0 (не тратим квоту)
    const needsCheck = rerun || onlyIds || !prev || prev.score < 0 || prev.mtime !== undefined ? stale : false;
    if (needsCheck) ids.push(id);
    if (limit !== null && ids.length >= limit) break;
  }

  console.log(`К проверке: ${ids.length} (всего фото: ${allIds.length}, в отчёте: ${Object.keys(report).length})`);
  let done = 0;
  for (const id of ids) {
    const subject = SUBJECTS[id] ?? id;
    const r = await critiquePhoto(zai, path.join(OUT_DIR, `${id}.jpg`), subject);
    r.mtime = fs.statSync(path.join(OUT_DIR, `${id}.jpg`)).mtimeMs;
    r.at = new Date().toISOString();
    report[id] = r;
    done++;
    const verdict = r.score < 0 ? 'ошибка' : `${r.score} ${flagsStr(r)}`;
    console.log(`[${done}/${ids.length}] ${id}: ${verdict}${r.note ? ' — ' + r.note : ''}`);
    if (done % 5 === 0 || done === ids.length) {
      fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
    }
  }
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));

  // Брак по ВСЕМУ отчёту (не только свежему слайсу) -> шортлист слиянием.
  // Утверждённые пользователем (qa-approve.txt) не попадают — их не трогаем.
  const bad = Object.entries(report)
    .filter(([id, r]) => r.score >= 0 && isBad(r) && !APPROVED.has(id))
    .map(([id]) => id);
  const pending = new Set(
    fs.existsSync(SHORTLIST)
      ? fs.readFileSync(SHORTLIST, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
      : [],
  );
  for (const id of bad) pending.add(id);
  fs.writeFileSync(SHORTLIST, [...pending].sort().join('\n'));

  console.log(
    `=== ИТОГ: в отчёте ${Object.keys(report).length}, брак по отчёту: ${bad.length}, шортлист итого: ${pending.size}`,
  );
  if (bad.length) console.log(bad.join(', '));
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
