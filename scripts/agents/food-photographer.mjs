// АГЕНТ «ФУД-ФОТОГРАФ» (запрос пользователя 2026-11-06: профессиональная
// оценка фото блюд, поиск нейрослопа). Замороженные скрипты (photo-critic,
// generate-dish-photos) не трогаем — это ОТДЕЛЬНЫЙ оценщик.
//
// Рубрика профессионального фуд-фотографа: свет, композиция, стайлинг,
// текстуры, соответствие блюду, аппетитность, маркеры нейрослопа, бренд-стиль.
//
//   node scripts/agents/food-photographer.mjs --ids=beef-burger,turkish-pide
//   node scripts/agents/food-photographer.mjs --all --limit=40
//   node scripts/agents/food-photographer.mjs --ids=... --rerun   (перепроверить)
//
// Отчёт: scripts/agents/photographer-report.json (сливается по id).

import fs from 'node:fs';
import path from 'node:path';
import ZAI from 'z-ai-web-dev-sdk';

const DISH_DIR = 'public/dishes';
const SRC_DIR = 'src/data';
const REPORT = 'scripts/agents/photographer-report.json';

const idsArg = process.argv.find((a) => a.startsWith('--ids='));
const allArg = process.argv.includes('--all');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const rerun = process.argv.includes('--rerun');
const onlyIds = idsArg
  ? idsArg.slice('--ids='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : null;
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) || null : null;

// --- метаданные блюд из src/data/*.ts (только чтение!) ---
function loadDishMeta() {
  const meta = {};
  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.ts'));
  for (const f of files) {
    const text = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');
    const idRe = /id:\s*'([\w-]+)'/g;
    let m;
    const marks = [];
    while ((m = idRe.exec(text))) marks.push({ id: m[1], start: m.index });
    for (let i = 0; i < marks.length; i++) {
      const slice = text.slice(
        marks[i].start,
        i + 1 < marks.length ? marks[i + 1].start : text.length
      );
      const nameRu = (slice.match(/nameRu:\s*'([^']+)'/) || [])[1] || '';
      const nameEn = (slice.match(/nameEn:\s*'([^']+)'/) || [])[1] || '';
      const ing = [...slice.matchAll(/name:\s*'([^']+)'/g)]
        .map((x) => x[1])
        .slice(0, 12);
      if (nameRu || nameEn) meta[marks[i].id] = { nameRu, nameEn, ingredients: ing };
    }
  }
  return meta;
}

function photographerPrompt(dish) {
  const name = dish?.nameRu || '';
  const ing = (dish?.ingredients || []).join(', ');
  return `Ты — фуд-фотограф с 20-летним стажем съёмок для кулинарных изданий. Тебе показывают фото блюда «${name}»${ing ? ` (ингредиенты: ${ing})` : ''} для карточки рецепта в мобильном приложении (тёмная тема).

Оцени фото КАК ПРОФЕССИОНАЛЬНЫЙ ФОТОГРАФ, строго и без жалости. Особое внимание — маркерам «нейрослопа» (типичные артефакты ИИ-генерации еды):
- пластиковый/восковой глянец поверхностей и соусов;
- перенасыщенные «кислотные» цвета;
- слишком правильные, одинаковые, повторяющиеся элементы (шары, ломтики, крошки);
- «ковровые» текстуры (фарш/крошка как ровный ковёр);
- постановочное драматичное освещение-клише (moody dark + блики);
- фальшивый реквизит и фон, бессмысленное боке;
- физически невозможные конструкции (висящие куски, бесшовные разрезы);
- несоответствие блюду (другая форма/состав — например «лодочка», а на фото круг);
- прочие артефакты генерации.

Оси оценки, каждая 0-10 (10 — идеально):
light — свет: естественный, направленный, без драматичного клише;
composition — композиция и кадрирование под карточку;
styling — стайлинг, посуда и реквизит уместны;
texture — текстуры еды: матовые, реальные, с несовершенствами;
authenticity — фото показывает ИМЕННО это блюдо и его ключевые признаки;
appetite — аппетитность;
slop — чистота от нейрослопа (10 = ни одного маркера);
brand — консистентность со стилем серии (тёмный фон/камень-дерево — ок, клише — нет).

Верни ТОЛЬКО JSON (без markdown):
{"light":0,"composition":0,"styling":0,"texture":0,"authenticity":0,"appetite":0,"slop":0,"brand":0,"slopMarkers":["только реально видимые, из списка выше"],"verdict":"GOOD|RETOUCH|REGEN","note":"краткое профессиональное заключение по-русски, 1-2 предложения, конкретно про это фото","hints":["что фотограф исправил бы при пересъёмке, по-русски, 2-3 пункта"]}`;
}

function verdictFrom(p) {
  const axes = ['light', 'composition', 'styling', 'texture', 'authenticity', 'appetite', 'brand'];
  const avg = axes.reduce((s, k) => s + (Number(p[k]) || 0), 0) / axes.length;
  const slop = Number(p.slop) || 0;
  const auth = Number(p.authenticity) || 0;
  let verdict = String(p.verdict || '').toUpperCase();
  if (!['GOOD', 'RETOUCH', 'REGEN'].includes(verdict)) {
    verdict = auth <= 5 || slop <= 5 ? 'REGEN' : avg >= 8 && slop >= 8 ? 'GOOD' : 'RETOUCH';
  }
  if (auth <= 4 || slop <= 4) verdict = 'REGEN'; // «не то блюдо» / сильный слоп — только перегенерация
  return { verdict, avg: Math.round(avg * 10) / 10 };
}

function extractJson(text) {
  const matches = String(text || '').match(/\{[\s\S]*\}/g) || [];
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(matches[i]);
    } catch {}
  }
  return null;
}

async function main() {
  const meta = loadDishMeta();
  let allIds = fs
    .readdirSync(DISH_DIR)
    .filter((f) => f.endsWith('.jpg'))
    .map((f) => f.replace('.jpg', ''))
    .sort();
  if (onlyIds) allIds = allIds.filter((id) => onlyIds.includes(id));
  else if (!allArg) allIds = [];
  if (limit) allIds = allIds.slice(0, limit);
  if (!allIds.length) {
    console.log('Нет блюд для оценки (укажи --ids=... или --all)');
    return;
  }

  fs.mkdirSync('scripts/agents', { recursive: true });
  const report = fs.existsSync(REPORT)
    ? JSON.parse(fs.readFileSync(REPORT, 'utf8'))
    : {};

  const zai = await ZAI.create();
  let done = 0;
  for (const id of allIds) {
    const file = path.join(DISH_DIR, `${id}.jpg`);
    if (report[id] && !rerun && !onlyIds) {
      // без явного --ids не переоцениваем свежие записи
      if (Date.now() - (report[id].checkedAt || 0) < 20 * 3600 * 1000) continue;
    }
    const b64 = fs.readFileSync(file).toString('base64');
    process.stdout.write(`[фотограф] ${id} ... `);
    let parsed = null;
    for (let attempt = 1; attempt <= 3 && !parsed; attempt++) {
      try {
        const res = await zai.chat.completions.createVision({
          model: 'glm-4.5v',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}` } },
                { type: 'text', text: photographerPrompt(meta[id] || {}) },
              ],
            },
          ],
          temperature: 0.2,
        });
        parsed = extractJson(res?.choices?.[0]?.message?.content);
        if (!parsed) throw new Error('нет JSON в ответе');
      } catch (err) {
        const isRate = /\b429\b|rate.?limit/i.test(String(err?.message));
        process.stdout.write(`попытка ${attempt}: ${err.message} `);
        if (attempt < 3) await new Promise((r) => setTimeout(r, isRate ? 30000 : 5000));
      }
    }
    if (!parsed) {
      console.log('-> ОШИБКА, повторит следующий прогон');
      continue;
    }
    const { verdict, avg } = verdictFrom(parsed);
    report[id] = {
      ...parsed,
      verdict,
      avg,
      nameRu: meta[id]?.nameRu || '',
      file,
      checkedAt: Date.now(),
    };
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
    console.log(
      `${verdict} (avg ${avg}, slop ${parsed.slop}, auth ${parsed.authenticity}) — ${String(parsed.note || '').slice(0, 90)}`
    );
    done++;
  }

  const all = Object.entries(report);
  const byVerdict = { GOOD: 0, RETOUCH: 0, REGEN: 0 };
  for (const [, v] of all) byVerdict[v.verdict] = (byVerdict[v.verdict] || 0) + 1;
  console.log(
    `=== ФОТОГРАФ: в отчёте ${all.length} блюд | GOOD ${byVerdict.GOOD} / RETOUCH ${byVerdict.RETOUCH} / REGEN ${byVerdict.REGEN}`
  );
}

main().catch((e) => {
  console.error('ФАТАЛ:', e.message);
  process.exit(1);
});
