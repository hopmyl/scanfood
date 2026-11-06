// АГЕНТ «ПРОФЕССИОНАЛЬНЫЙ ФУД-ФОТОГРАФ» (запрос пользователя 2026-11-06:
// «создай агента профессионального фотографа для оценки фотографий блюд»).
// Отличие от конвейерного критика (photo-critic.mjs, бинарные флаги для отбраковки):
// фотограф оценивает кадр КАК СЪЁМКУ для приложения — свет, текстуры, физика,
// цвет, посуда/пропсы, композиция — и даёт КОНКРЕТНЫЙ совет «что исправить»,
// который затем забирает агент-маркетолог (scripts/prompt-marketer.mjs).
// Своих генераций не делает, файлы фото не трогает: только оценка и отчёт.
// Запуск: node scripts/photographer-critic.mjs [--only=id1,id2] [--limit=N] [--rerun]
// Отчёт: scripts/photographer-report.json; брак (score<7 или slop) сливается в
// scripts/photographer-fixlist.txt (слияние, без затирания).
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'public/dishes';
const REPORT = 'scripts/photographer-report.json';
const FIXLIST = 'scripts/photographer-fixlist.txt';
const SUBJECTS = fs.existsSync('scripts/photo-subjects.json')
  ? JSON.parse(fs.readFileSync('scripts/photo-subjects.json', 'utf8'))
  : {};

const rerun = process.argv.includes('--rerun');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const onlyIds = onlyArg
  ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : null;
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) || null : null;

// Проходной балл фотографа: как у критика, >=7 и без «нейрослопа».
const PASS_SCORE = 7;

export function photographerPrompt(subject) {
  return (
    'Ты — профессиональный фуд-фотограф с 15-летним опытом (съёмка для ресторанных меню, кулинарных книг и фуд-блогов).\n' +
    'Твоя задача — отличить НАСТОЯЩУЮ фотографию еды от ИИ-генерации («нейрослопа») и точно назвать дефекты.\n' +
    'Ожидаемое блюдо (описание): «' + subject + '»\n' +
    'Ответь ТОЛЬКО JSON без markdown:\n' +
    '{"score":1-10,"light":true/false,"texture":true/false,"physics":true/false,"color":true/false,"props":true/false,"slop":true/false,"advice":"...","note":"..."}\n' +
    'Расшифровка:\n' +
    '- score — общая «настоящесть» кадра: 9-10 неотличим от реальной съёмки, 7-8 можно публиковать, ' +
    '5-6 заметны ИИ-артефакты, 1-4 явный нейрослоп.\n' +
    '- light=true — свет неубедителен или нефизичен: неоновый/контровой глянец, тени не совпадают с источником, ' +
    'студийный «гламур» вместо обычного дневного/кухонного света, пластиковые блик-полосы.\n' +
    '- texture=true — текстуры «нейронные»: восковая или пластиковая поверхность, мраморные переливы, ' +
    'однородная крупа/крошка, размытая детализация там, где должна быть резкость (кора хлеба, волокна мяса, зелень).\n' +
    '- physics=true — нарушение физики: парящие или провисающие без опоры куски, нелогичные разрезы, ' +
    'невозможная геометрия, идеально одинаковые элементы, начинка, которая не совпадает с разрезом.\n' +
    '- color=true — неестественный цвет: перенасыщенность, кислотные оттенки, HDR-пластик, лоснящаяся мультяшность соусов.\n' +
    '- props=true — посуда/фон/пропсы фейковые: кривые или «плавающие» тарелки, нелогичные отражения, ' +
    'размытый градиентный фон вместо реального стола, декоративные нечитаемые этикетки-имитации.\n' +
    '- slop=true — итоговый вердикт: кадр выглядит как ИИ-генерация и вызовет у пользователя недоверие (' +
    'обычно сочетание глянца, восковых текстур и «постерной» композиции).\n' +
    '- advice — 1-2 предложения КОНКРЕТНО, что изменить при пересъёмке/перегенерации: свет, поверхность, ' +
    'сервировку, фон, ракурс (по-русски).\n' +
    '- note — краткий итог по-русски, максимум 10 слов.\n' +
    'Домашняя еда должна выглядеть как реальный снимок на телефон/камеру при дневном свете, ' +
    'с лёгким беспорядком: крошки, неровные края, неровная намазка — это ПЛЮС к достоверности.'
  );
}

// Ретраи как в конвейерном критике: 429 -> окно квоты 70с, прочее -> 5с*попытка.
async function critiqueAsPhotographer(zai, imageFile, subject, { attempts = 4 } = {}) {
  const b64 = fs.readFileSync(imageFile).toString('base64');
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await zai.chat.completions.createVision({
        model: 'glm-4.5v',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
              { type: 'text', text: photographerPrompt(subject) },
            ],
          },
        ],
        thinking: { type: 'disabled' },
      });
      const text = String(res?.choices?.[0]?.message?.content ?? '');
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('нет JSON в ответе фотографа');
      const p = JSON.parse(m[0]);
      return {
        score: Number(p.score) || 0,
        light: p.light === true,
        texture: p.texture === true,
        physics: p.physics === true,
        color: p.color === true,
        props: p.props === true,
        slop: p.slop === true,
        advice: String(p.advice ?? '').slice(0, 300),
        note: String(p.note ?? '').slice(0, 100),
      };
    } catch (err) {
      const isRate = String(err?.message).includes('429');
      console.error(`  [фотограф] попытка ${attempt}: ${err.message}`);
      if (attempt < attempts)
        await new Promise((r) => setTimeout(r, isRate ? 70000 : 5000 * attempt));
    }
  }
  return { score: -1, light: false, texture: false, physics: false, color: false, props: false, slop: false, advice: '', note: 'ошибка фотографа', error: true };
}

const flags = (q) => {
  const f = [];
  if (q.light) f.push('свет');
  if (q.texture) f.push('текстуры');
  if (q.physics) f.push('физика');
  if (q.color) f.push('цвет');
  if (q.props) f.push('пропсы');
  if (q.slop) f.push('СЛОП');
  return f.length ? f.join('+') : 'чисто';
};

async function main() {
  const zai = await ZAI.create();
  const report = fs.existsSync(REPORT) && !rerun ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : {};

  let ids = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.jpg'))
    .map((f) => f.replace('.jpg', ''));
  if (onlyIds) ids = ids.filter((id) => onlyIds.includes(id));
  else if (!rerun) ids = ids.filter((id) => !report[id] || report[id].error);
  if (limit) ids = ids.slice(0, limit);

  console.log(`Фотограф: к оценке ${ids.length}${onlyIds ? ' (явный список)' : ''}`);
  let bad = 0;
  for (const id of ids) {
    const file = path.join(OUT_DIR, `${id}.jpg`);
    const subject = SUBJECTS[id] || id;
    process.stdout.write(`- ${id}: `);
    const q = await critiqueAsPhotographer(zai, file, subject);
    q.ts = new Date().toISOString();
    report[id] = q;
    const isBadPhoto = q.score >= 0 && (q.score < PASS_SCORE || q.slop);
    if (isBadPhoto) bad++;
    console.log(`${q.score} [${flags(q)}] ${q.note}${q.error ? ' — перепроверю позже' : ''}`);
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
  }

  // Брак -> fixlist (слияние, без дублей; ошибки критика не попадают).
  const badIds = Object.entries(report)
    .filter(([, q]) => q.score >= 0 && (q.score < PASS_SCORE || q.slop))
    .map(([id]) => id);
  const existing = fs.existsSync(FIXLIST)
    ? fs.readFileSync(FIXLIST, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
    : [];
  const merged = [...new Set([...existing, ...badIds])];
  fs.writeFileSync(FIXLIST, merged.join('\n') + (merged.length ? '\n' : ''));

  console.log(`ИТОГ фотографа: оценено ${ids.length}, брак сейчас ${bad}, всего в fixlist ${merged.length}`);
}

main().catch((e) => {
  console.error('Фатальная ошибка фотографа:', e.message);
  process.exit(1);
});
