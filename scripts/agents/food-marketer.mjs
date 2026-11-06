// АГЕНТ «МАРКЕТОЛОГ» (запрос пользователя 2026-11-06: правильные промпты,
// чтобы на фото блюд не было нейрослопа). Работает ПО ПОВЕРХ вердиктов
// агента-фотографа (scripts/agents/photographer-report.json).
//
//   node scripts/agents/food-marketer.mjs --ids=beef-burger,turkish-pide
//   node scripts/agents/food-marketer.mjs --ids=... --style   (плюс предложение
//        новых констант стиля для замороженного генератора — на утверждение
//        пользователю, сам генератор НЕ трогаем)
//
// Выход: scripts/agents/marketer-prompts.json
//   { styleCharter, prompts: { id: { prompt, negative, focusRu } }, styleProposal? }

import fs from 'node:fs';
import path from 'node:path';
import ZAI from 'z-ai-web-dev-sdk';

const REPORT_P = 'scripts/agents/photographer-report.json';
const OUT = 'scripts/agents/marketer-prompts.json';
const SRC_DIR = 'src/data';

const idsArg = process.argv.find((a) => a.startsWith('--ids='));
const styleFlag = process.argv.includes('--style');
const onlyIds = idsArg
  ? idsArg.slice('--ids='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : null;

// Анти-слоп устав маркетолога (фиксируется в каждом промпте как ограничения)
const STYLE_CHARTER = {
  ru: [
    'Тёплый естественный дневной свет из окна (soft window daylight), лёгкие тени — НЕ студийная драма и НЕ moody-чёрный фон.',
    'Матовые, реальные текстуры: видны крошка, неровная корочка, неровные края, капли соуса матовые, а не зеркальные.',
    'Сдержанная, «съедобная» палитра: никаких кислотных перенасыщенных цветов.',
    'Реальные несовершенства — именно они продают «домашность»: крошки на столе, неровно намазанный соус, чуть съехавший лист салата.',
    'Посуда и фон в стиле серии: тёмный камень/тёмное дерево допустимы, но свет мягкий и тёплый; без фальшивого боке-реквизита.',
    'Запрещённые слова в промптах: glossy, perfect, flawless, hyper-detailed, 8k, studio lighting, dramatic lighting, moody, cinematic, ultra, professional advertisement.',
  ],
  en: [
    'Warm natural window daylight, soft shadows; no studio drama, no moody black-key look.',
    'Matte, honest textures: visible crumb, uneven browning, imperfect edges; sauces look moist, not mirror-glossy.',
    'Restrained edible palette; no oversaturated colors.',
    'Real imperfections sell homemade: crumbs on the table, sauce smeared, a leaf slightly out of place.',
    'Series props: dark stone / dark wood are fine, but lit softly and warmly; no fake bokeh props.',
    'Banned prompt words: glossy, perfect, flawless, hyper-detailed, 8k, studio lighting, dramatic lighting, moody, cinematic, ultra, professional advertisement.',
  ],
};

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

function extractJson(text) {
  const matches = String(text || '').match(/\{[\s\S]*\}/g) || [];
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(matches[i]);
    } catch {}
  }
  return null;
}

function marketerPrompt(dish, photo) {
  const markers = (photo?.slopMarkers || []).join('; ') || 'нет данных';
  const hints = (photo?.hints || []).join('; ') || 'нет данных';
  return `Блюдо: «${dish.nameRu}» (${dish.nameEn}).
Ингредиенты, которые должны быть видны: ${dish.ingredients.join(', ')}.
Вердикт фуд-фотографа по текущему фото: verdict=${photo?.verdict || 'n/a'}, avg=${photo?.avg || 'n/a'}, slop=${photo?.slop ?? 'n/a'}, authenticity=${photo?.authenticity ?? 'n/a'}.
Найденные маркеры нейрослопа: ${markers}.
Замечания фотографа: ${photo?.note || ''}.
Что фотограф исправил бы: ${hints}.

Составь ПРОМПТ для ИИ-генератора изображения (1024x1024), который устранит эти проблемы и даст «настоящее» фуд-фото для карточки рецепта.

ЖЁСТКИЕ ПРАВИЛА (устав анти-слопа):
${STYLE_CHARTER.en.map((s) => '- ' + s).join('\n')}

Требования к промпту:
- английский, 45-70 слов, одна строка;
- описание СЦЕНЫ: какое блюдо, ключевая геометрия/признак блюда (например, pide — BOAT-SHAPED with open meat channel), подача, свет, текстуры, ракурс 30-45°;
- никаких запрещённых слов из устава;
- negative: одна строка на английском, перечисление через запятую того, чего избегать (включая маркеры этого блюда).

Верни ТОЛЬКО JSON:
{"prompt":"...","negative":"...","focusRu":"по-русски 1 предложение: какой признак блюда обязан быть на фото"}`;
}

function styleProposalPrompt() {
  return `Ты — маркетолог фуд-приложения. Текущий генератор фото жёстко зашивает стиль:
STYLE_A = "professional food photography, served on a dark slate plate on a rustic dark wooden table, ..."
STYLE_B включает фразу "real food textures: visible grains and crumb, uneven browning, natural imperfect shapes, glossy natural sauces, ..."
Фраза "glossy natural sauces" даёт пластиковый глянец (нейрослоп), "professional food photography" + тёмный фон дают moody-клише.

Напиши ПРЕДЛОЖЕНИЕ новых констант (на утверждение пользователю; в код их вносит только человек):
- STYLE_A_NEW: английская строка 30-45 слов — стиль серии: тёмный камень/тёмное дерево ок, но тёплый мягкий дневной свет, матовые текстуры, редакционный журнальный вид;
- STYLE_B_NEW: английская строка 25-40 слов — про честные текстуры вместо "glossy natural sauces";
- NEGATIVE_GLOBAL: одна строка на английском — глобальный negative-промпт против нейрослопа.
Верни ТОЛЬКО JSON: {"STYLE_A_NEW":"...","STYLE_B_NEW":"...","NEGATIVE_GLOBAL":"...","обоснованиеRu":"2-3 предложения по-русски"}`;
}

async function main() {
  if (!fs.existsSync(REPORT_P)) {
    console.error('Нет photographer-report.json — сначала запусти food-photographer.mjs');
    process.exit(1);
  }
  const photo = JSON.parse(fs.readFileSync(REPORT_P, 'utf8'));
  const meta = loadDishMeta();

  let ids = onlyIds || Object.keys(photo);
  ids = ids.filter((id) => photo[id]); // только с вердиктами фотографа
  if (!ids.length) {
    console.log('Нет блюд с вердиктами фотографа');
    return;
  }

  const out = fs.existsSync(OUT)
    ? JSON.parse(fs.readFileSync(OUT, 'utf8'))
    : { styleCharter: STYLE_CHARTER, prompts: {} };
  out.styleCharter = STYLE_CHARTER;

  const zai = await ZAI.create();

  for (const id of ids) {
    const dish = meta[id];
    if (!dish) {
      console.log(`[маркетолог] ${id}: нет метаданных в src/data — пропускаю`);
      continue;
    }
    process.stdout.write(`[маркетолог] ${id} ... `);
    let parsed = null;
    for (let attempt = 1; attempt <= 3 && !parsed; attempt++) {
      try {
        const res = await zai.chat.completions.create({
          model: 'glm-4.6',
          messages: [{ role: 'user', content: marketerPrompt(dish, photo[id]) }],
          temperature: 0.4,
        });
        parsed = extractJson(res?.choices?.[0]?.message?.content);
        if (!parsed || !parsed.prompt) throw new Error('нет JSON/промпта');
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
    out.prompts[id] = {
      nameRu: dish.nameRu,
      verdict: photo[id].verdict,
      prompt: String(parsed.prompt).trim(),
      negative: String(parsed.negative || '').trim(),
      focusRu: String(parsed.focusRu || '').trim(),
      madeAt: Date.now(),
    };
    fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    console.log(`OK — ${String(out.prompts[id].focusRu).slice(0, 80)}`);
  }

  if (styleFlag) {
    process.stdout.write('[маркетолог] предложение новых констант стиля ... ');
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await zai.chat.completions.create({
          model: 'glm-4.6',
          messages: [{ role: 'user', content: styleProposalPrompt() }],
          temperature: 0.3,
        });
        const p = extractJson(res?.choices?.[0]?.message?.content);
        if (!p || !p.STYLE_A_NEW) throw new Error('нет JSON');
        out.styleProposal = p;
        fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
        console.log('OK');
        break;
      } catch (err) {
        if (attempt === 3) console.log(`-> ОШИБКА: ${err.message}`);
        else await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  console.log(`=== МАРКЕТОЛОГ: промптов ${Object.keys(out.prompts).length}, стиль-предложение: ${out.styleProposal ? 'есть' : 'нет'} -> ${OUT}`);
}

main().catch((e) => {
  console.error('ФАТАЛ:', e.message);
  process.exit(1);
});
