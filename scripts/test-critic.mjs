// Калибровка агента-критика (photo-critic.mjs):
//   1) шесть УТВЕРЖДЁННЫХ пользователем v6-фото — ожидаем score>=7, флагов нет;
//   2) анти-тест «не то блюдо»: фото борща под описанием сырников — ожидаем wrong=true;
//   3) пара фото старого ресторанного стиля — для сравнения типичных баллов.
// Запуск: node scripts/test-critic.mjs
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'node:fs';
import path from 'node:path';
import { critiquePhoto, isPass, flagsStr } from './photo-critic.mjs';

const SUBJECTS = JSON.parse(fs.readFileSync('scripts/photo-subjects.json', 'utf8'));

const CASES = [
  // [подпись, файл, subject (или null -> брать из photo-subjects.json)]
  ['утв. pelmeni', 'public/dishes/pelmeni.jpg', null],
  ['утв. borscht', 'public/dishes/borscht.jpg', null],
  ['утв. cottage-cheese-pancakes', 'public/dishes/cottage-cheese-pancakes.jpg', null],
  ['утв. greek-salad', 'public/dishes/greek-salad.jpg', null],
  ['утв. spaghetti-bolognese (матовый реролл)', 'public/dishes/spaghetti-bolognese.jpg', null],
  ['утв. milk-blini', 'public/dishes/milk-blini.jpg', null],
  ['АНТИ-ТЕСТ: борщ под именем сырников', 'public/dishes/borscht.jpg', SUBJECTS['cottage-cheese-pancakes']],
  ['старый стиль: cheese-soup', 'public/dishes/cheese-soup.jpg', null],
  ['старый стиль: croissant-salmon', 'public/dishes/croissant-salmon.jpg', null],
];

const zai = await ZAI.create();
let ok = 0;
for (const [label, file, subjOverride] of CASES) {
  const p = path.join('/home/z/my-project', file);
  if (!fs.existsSync(p)) {
    console.log(`${label}: ФАЙЛА НЕТ`);
    continue;
  }
  const subject = subjOverride ?? SUBJECTS[path.basename(file, '.jpg')] ?? 'food dish';
  const qa = await critiquePhoto(zai, p, subject);
  console.log(
    `${label} => score=${qa.score} flags=[${flagsStr(qa)}] ${qa.note}${qa.error ? ' (ОШИБКА КРИТИКА)' : ''}`,
  );
}
console.log('Готово.');
