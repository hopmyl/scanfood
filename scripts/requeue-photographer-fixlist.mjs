// Пересборка очереди ремонта по итогам массового прогона фотографа (260/260).
// Источник очереди — scripts/photographer-fixlist.txt (226 брак-id, устоял при аварии отчёта).
// Сортировка «худшие сначала» — по старым оценкам аудита realism-report.json (прокси).
// HUMAN_PASS: tuna-sandwich — перегенерирована промптом маркетолога, визуально проверена
// владельцем конвейера (дневной свет, матовый хлеб, крошки): PASS, запираем текущим sha256.
import fs from 'fs';
import crypto from 'crypto';

const FIXLIST = 'scripts/photographer-fixlist.txt';
const LOCKS = 'scripts/photo-locks.json';
const SHORT = 'scripts/regen-shortlist.txt';
const PROG = 'scripts/regen-progress.txt';
const REALISM = 'scripts/realism-report.json';
const HUMAN_PASS = new Set(['tuna-sandwich']);

const fixIds = fs.readFileSync(FIXLIST, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const queueIds = fixIds.filter((id) => !HUMAN_PASS.has(id));

// старые оценки аудита для сортировки
let realism = {};
try {
  const raw = JSON.parse(fs.readFileSync(REALISM, 'utf8'));
  if (Array.isArray(raw)) raw.forEach((it) => { if (it && it.id) realism[it.id] = it.score; });
  else Object.entries(raw).forEach(([id, v]) => { realism[id] = typeof v === 'object' && v ? v.score : v; });
} catch (e) { realism = {}; }

const sorted = queueIds.slice().sort((a, b) => {
  const sa = (typeof realism[a] === 'number' ? realism[a] : 99);
  const sb = (typeof realism[b] === 'number' ? realism[b] : 99);
  return sa - sb || a.localeCompare(b);
});

// замки: снять с очереди на ремонт, запереть HUMAN_PASS
const locks = JSON.parse(fs.readFileSync(LOCKS, 'utf8'));
const queueSet = new Set(queueIds);
const newLocks = {};
let dropped = 0;
for (const [id, lock] of Object.entries(locks)) {
  if (queueSet.has(id)) { dropped++; continue; }
  newLocks[id] = lock;
}
for (const id of HUMAN_PASS) {
  if (!newLocks[id]) {
    const buf = fs.readFileSync(`public/dishes/${id}.jpg`);
    newLocks[id] = {
      sha256: crypto.createHash('sha256').update(buf).digest('hex'),
      at: new Date().toISOString(),
      score: 8,
      src: 'human-pass-photographer-sweep',
    };
  }
}
fs.writeFileSync(LOCKS, JSON.stringify(newLocks, null, 1));

// шортлист = очередь (худшие сначала)
fs.writeFileSync(SHORT, sorted.join('\n') + '\n');

// прогресс: убрать очередь (возврат в ремонт), остальное оставить
const progLines = fs.readFileSync(PROG, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
const keptProg = progLines.filter((id) => !queueSet.has(id));
fs.writeFileSync(PROG, keptProg.join('\n') + '\n');

console.log('очередь ремонта:', sorted.length, 'блюд (худшие сначала)');
console.log('замки: было', Object.keys(locks).length, '→ стало', Object.keys(newLocks).length, '(снято', dropped + ')');
console.log('прогресс: было', progLines.length, '→ осталось', keptProg.length, '(вернулось в очередь', progLines.length - keptProg.length + ')');
console.log('первые 12 очереди:', sorted.slice(0, 12).join(', '));
const noRealism = sorted.filter((id) => typeof realism[id] !== 'number').length;
console.log('без старой оценки аудита (в конец очереди):', noRealism);
