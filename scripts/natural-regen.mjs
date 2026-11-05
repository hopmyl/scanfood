// Алгоритм «Натурал v7» — финальная перегенерация бракованных фото.
//
// Проблема, которую решает: 15 блюд уже перегенерировались по разу (v6) и
// ВСЁ РАВНО в браке — старый конвейер больше их не трогает (regen-progress),
// потолок качества z-ai-генератора достигнут. Плюс z-ai дни простаивает в 429.
//
// Что нового:
//   1) Промпт v7: та же тёплая рустик-сцена (совместимо с каталогом), но
//      анти-пластиковые правки: matte-текстуры, «casual home snapshot look»,
//      соусы с лёгким масляным блеском вместо «glossy» (глоссил пластик).
//   2) Мульти-провайдер кандидатов на кадр:
//        a) OpenRouter image (google/gemini-2.5-flash-image, ПЛАТНЫЙ) —
//           включается АВТОМАТИЧЕСКИ, если на ключе есть кредиты (не free tier);
//        b) z-ai (бесплатный, текущий);
//        c) Pollinations flux (бесплатный, независимый от 429 z-ai).
//     Критик выбирает лучшего из кандидатов.
//   3) Критик с фолбэком: z-ai glm-4.5v → OpenRouter nemotron (free, счётчик
//     бюджета, чтобы не съедать квоту сканера) → fail-open.
//   4) ФИНАЛЬНЫЕ ЗАМКИ (scripts/photo-locks.json): кадр, прошедший гейт
//     (score>=8 и ни одного флага), замораживается хэшем sha256 — аудит и
//     qa-runner больше НИКОГДА его не тронут (пока файл не изменится руками).
//     Это ответ на «нужно сделать так, чтобы потом не переделывать».
//   5) Не прошёл гейт — в файл идёт лучший кандидат (улучшение), блюдо
//     добавляется в qa-manual.txt на ваш просмотр; БЕССКОНЕЧНЫХ циклов нет.
//
// Запуск:
//   node scripts/natural-regen.mjs                     # очередь сама из отчёта
//   node scripts/natural-regen.mjs --only=id1,id2      # явный список
//   node scripts/natural-regen.mjs --limit=5           # сколько блюд за прогон
// Переменные: CANDIDATES=3, OR_CRITIC_CAP=15, PHOTO_OR_MODEL=google/gemini-2.5-flash-image
import ZAI from 'z-ai-web-dev-sdk';
import sharp from 'sharp';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { critiquePhoto, isPass, isBad, flagsStr, criticPrompt } from './photo-critic.mjs';

// scripts/.env (в .gitignore): OPENROUTER_API_KEY=…, GEMINI_API_KEY=…
// env переменные приоритетнее файла — файл только добирает недостающее.
for (const line of readSafeEnv()) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
function readSafeEnv() {
  try {
    return fs.readFileSync('scripts/.env', 'utf8').split('\n');
  } catch {
    return [];
  }
}

const OUT_DIR = 'public/dishes';
const REPORT = 'scripts/realism-report.json';
const LOCKS_FILE = 'scripts/photo-locks.json';
const APPROVE_FILE = 'scripts/qa-approve.txt';
const MANUAL_FILE = 'scripts/qa-manual.txt';
const LOG_FILE = 'scripts/natural-log.txt';
const STATE_FILE = 'scripts/natural-state.json'; // последний балл записанного кадра (для защиты от регрессии)
const SHORTLIST = 'scripts/regen-shortlist.txt';

const OR_KEY = process.env.OPENROUTER_API_KEY || '';
const OR_IMAGE_MODEL = process.env.PHOTO_OR_MODEL || 'google/gemini-2.5-flash-image';
const OR_CRITIC_MODEL = process.env.PHOTO_OR_CRITIC || 'nvidia/nemotron-3.5-super-vl:free';
const OR_CRITIC_CAP = Number(process.env.OR_CRITIC_CAP ?? 15); // резервируем квоту сканера
const CANDIDATES = Math.max(1, Number(process.env.CANDIDATES ?? 2));

// --- v7-стиль: ДНК v6 (тёмное дерево, керамика, лён, тёплый боковой свет) ---
// Анти-пластик: matte, крошки и мелкие пятна на столе, «casual home snapshot»,
// соусы с ЛЁГКИМ блеском (было «glossy» — триггер восковости), приглушённые
// цвета вместо «rich» (насыщенность = неоновый CGI).
const DISH_STYLE_V7 =
  'real photograph of appetizing homemade comfort food, cozy rustic homestyle cooking, ' +
  'served on handmade glazed ceramic tableware, ' +
  'simple cutlery and a folded beige linen napkin beside the dish, ' +
  'a few raw ingredients and spices scattered around that naturally match this dish, ' +
  'warm natural side light from a kitchen window, golden warm tone, soft natural shadows, ' +
  'muted natural colors, matte realistic food textures: visible grains and crumb, ' +
  'uneven browning, slightly irregular homemade shapes, sauces with a light oil sheen, ' +
  'a few crumbs on the table, casual home snapshot look, unedited photo from a real home cook, ' +
  'shallow depth of field, 50mm lens look, static view of the table, ' +
  'not a render, not CGI, not 3D, not illustration, no text, no captions, no lettering, no watermark';

// Turbo/SDXL-вариант: СЕМЕЙСТВО SDXL ИГНОРИРУЕТ негативы, а слова «text»,
// «lettering» сами провоцируют надписи на картинке (урок чанка 1: 8/8
// кандидатов с флагом «текст»). Поэтому тут только позитивные формулировки,
// без единого запрета и без упоминания текста/рендеров.
const TURBO_STYLE =
  'real photograph of appetizing homemade comfort food, cozy rustic homestyle cooking, ' +
  'served on handmade glazed ceramic tableware, a folded beige linen napkin beside the dish, ' +
  'a few raw ingredients scattered around that match the dish, ' +
  'warm natural window light, golden warm tone, soft shadows, muted natural colors, ' +
  'matte food textures, visible grains and crumb, uneven browning, slightly irregular homemade shapes, ' +
  'light oil sheen on the sauce, a few crumbs on the wooden table, ' +
  'casual snapshot taken with a phone camera, amateur food photo, shallow depth of field';

// Сцены — те же варианты, что в generate-dish-photos.mjs (стиль каталога един).
const ANGLES = [
  'camera at a slight 45-degree angle above the table',
  'straight-on eye-level camera angle',
  'top-down overhead camera angle looking straight down at the dish',
  'low camera angle close to the table surface',
  'camera at a gentle 30-degree angle close to the dish',
];
const TABLES = [
  'on a dark walnut wooden table',
  'on a rustic oak wooden table',
  'on a weathered dark wooden table',
  'on a beige linen cloth over a wooden table',
  'on a warm terracotta tiled table',
  'on a light pine wooden table',
];
const BACKGROUNDS = [
  'softly blurred cozy rustic kitchen in the background',
  'softly blurred dark wooden wall with linen textiles in the background',
  'warmly blurred kitchen shelves with jars and herbs in the background',
  'softly blurred bright window with sheer curtains in the background',
  'gently blurred dark dining room corner in the background',
];
function pickVariant(arr, id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
}
function sceneFor(id, attempt = 0) {
  const salt = attempt === 0 ? id : `${id}::v${attempt}`;
  return `${pickVariant(ANGLES, salt)}, ${pickVariant(TABLES, salt)}, ${pickVariant(BACKGROUNDS, salt)}`;
}

const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
const readIds = (f) => read(f).split('\n').map((s) => s.trim()).filter(Boolean);
const log = (m) => {
  const line = `${new Date().toISOString()} ${m}`;
  console.log(m);
  fs.appendFileSync(LOG_FILE, line + '\n');
};
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ================= ГЕНЕРАТОРЫ =================

// Pollinations flux — бесплатный, независимый канал (работал, когда z-ai в 429).
async function genFlux(prompt) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const seed = Math.floor(Math.random() * 999999);
      // model=turbo: с 2026-11 flux у Pollinations стал платным (HTTP 402),
      // turbo остался бесплатным и быстрее (~2с на кадр)
      const url =
        'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) +
        `?width=1024&height=1024&model=turbo&nologo=true&seed=${seed}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(150000) });
      const ct = r.headers.get('content-type') || '';
      if (r.status === 200 && ct.startsWith('image')) {
        const raw = Buffer.from(await r.arrayBuffer());
        // Turbo без авторизации ставит вотермарку «pollinations.ai» в нижних
        // ~4% кадра (урок 2026-11-05: критик браковал 8/8 кандидатов из-за
        // «текст»). Срезаем нижние 6% и центруем до квадрата без искажений.
        const img = sharp(raw);
        const meta = await img.metadata();
        const w = meta.width ?? 1024, h = meta.height ?? 1024;
        const cut = Math.round(h * 0.06); // нижняя полоса с вотермаркой
        const side = Math.min(w, h - cut); // максимальный квадрат без искажений
        return await img
          .extract({ left: Math.round((w - side) / 2), top: 0, width: side, height: side })
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer();
      }
      console.error(`  [flux] HTTP ${r.status} ${ct.split(';')[0]} (попытка ${attempt})`);
    } catch (e) {
      console.error(`  [flux] попытка ${attempt}: ${String(e.message).slice(0, 100)}`);
    }
    await new Promise((r) => setTimeout(r, 8000 * attempt));
  }
  return null;
}

// z-ai (текущий генератор каталога) — 2 попытки с окном 75с на 429.
// Если канал мёртв (проба не прошла) — пропускаем целиком, не тратя 75с на кадр.
let zaiImageDead = false;
async function probeZaiImage(zai) {
  try {
    const r = await zai.images.generations.create({
      prompt: 'a single red apple on a wooden table, natural light',
      size: '1024x1024',
    });
    return !!(r?.data?.[0]?.base64);
  } catch {
    return false;
  }
}
async function genZai(zai, prompt) {
  if (zaiImageDead) return null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await zai.images.generations.create({ prompt, size: '1024x1024' });
      const b64 = r?.data?.[0]?.base64;
      if (!b64) throw new Error('пустой ответ');
      return await sharp(Buffer.from(b64, 'base64')).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    } catch (e) {
      const is429 = String(e.message).includes('429');
      console.error(`  [z-ai] попытка ${attempt}: ${String(e.message).slice(0, 100)}`);
      if (attempt < 2) await new Promise((r) => setTimeout(r, is429 ? 75000 : 5000));
    }
  }
  return null;
}

// OpenRouter image (ПЛАТНЫЙ) — nano-banana; включается только при кредитах.
let orImageDead = false;
async function genOrImage(prompt) {
  if (orImageDead || !OR_KEY) return null;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OR_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OR_IMAGE_MODEL,
        modalities: ['image', 'text'],
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(180000),
    });
    if (r.status === 402 || r.status === 404) {
      orImageDead = true; // нет кредитов / модель ушла — больше не дёргаем до след. запуска
      console.error(`  [or-image] недоступен (HTTP ${r.status}) — канал отключён до конца прогона`);
      return null;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const url = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url || '';
    const m = String(url).match(/^data:image\/\w+;base64,(.+)$/s);
    if (!m) throw new Error('нет изображения в ответе');
    return await sharp(Buffer.from(m[1], 'base64')).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } catch (e) {
    console.error(`  [or-image] ${String(e.message).slice(0, 100)}`);
    return null;
  }
}

// Платный тариф? Ключ с купленными кредитами → nano-banana первый в цепочке.
async function orPaidTier() {
  if (!OR_KEY) return false;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${OR_KEY}` },
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json();
    const paid = j?.data && j.data.is_free_tier === false && Number(j.data.limit_remaining ?? 0) > 0;
    if (paid) log(`ПЛАТНЫЙ ТАРИФ активен — включаю ${OR_IMAGE_MODEL} первым каналом`);
    return paid;
  } catch {
    return false;
  }
}

// ================= КРИТИК (z-ai → OpenRouter → null) =================
// Бюджет OR-критика — СТОЙКИЙ между запусками (/tmp/or-critic-used.json):
// чанковый режим запуска сбрасывал бы счётчик в памяти и мы съели бы квоту
// сканера. Кап = OR_CRITIC_CAP на СУТКИ (по дате в файле).
const OR_COUNT_FILE = '/tmp/or-critic-used.json';
let orCriticUsed = 0; // за текущий процесс (для логов)
function orBudgetLeft() {
  try {
    const j = JSON.parse(fs.readFileSync(OR_COUNT_FILE, 'utf8'));
    if (j.day === new Date().toISOString().slice(0, 10)) return OR_CRITIC_CAP - j.count;
  } catch {}
  return OR_CRITIC_CAP;
}
function orBudgetInc() {
  const day = new Date().toISOString().slice(0, 10);
  let j = { day, count: 0 };
  try {
    const p = JSON.parse(fs.readFileSync(OR_COUNT_FILE, 'utf8'));
    if (p.day === day) j = p;
  } catch {}
  j.count++;
  fs.writeFileSync(OR_COUNT_FILE, JSON.stringify(j));
  orCriticUsed = j.count;
}
// Проба здоровья z-ai-критика: если 429 — не ждём по 75с на каждом кадре,
// критикуем быстрым фейлом сразу через OR-фолбэк. Перепроверяем каждые 5 блюд.
let zaiCriticDead = false;
async function probeZaiCritic(zai) {
  const tiny = await sharp({ create: { width: 64, height: 64, channels: 3, background: 'grey' } })
    .jpeg()
    .toBuffer();
  const r = await critiquePhoto(zai, tiny, 'тест здоровья', { attempts: 1 });
  return !!(r && r.score >= 0);
}
async function critiqueWithFallback(zai, buf, subject) {
  // 1) штатный критик glm-4.5v (если жив — 2 попытки, если мёртв — быстрый фейл)
  const r = await critiquePhoto(zai, buf, subject, { attempts: zaiCriticDead ? 1 : 2 });
  if (r && r.score >= 0) return r;
  // 2) фолбэк OpenRouter — но в пределах суточного бюджета, чтобы не съесть квоту сканера
  if (!OR_KEY || orBudgetLeft() <= 0) {
    log(`  [критик] OR-фолбэк недоступен (использовано ${OR_CRITIC_CAP - orBudgetLeft()}/${OR_CRITIC_CAP} за сутки) — fail-open`);
    return null;
  }
  orBudgetInc();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OR_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OR_CRITIC_MODEL,
        max_tokens: 2000, // reasoning-модель: рассуждение ест токены
        reasoning: { max_tokens: 1000 },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${buf.toString('base64')}` } },
              { type: 'text', text: criticPrompt(subject) },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const msg = j?.choices?.[0]?.message ?? {};
    const text = String(msg.content ?? '') || String(msg.reasoning ?? '');
    const matches = text.match(/\{[\s\S]*?\}/g) || [];
    const p = JSON.parse(matches[matches.length - 1] || 'null');
    if (!p || p.score === undefined) throw new Error('нет JSON');
    log(`  [критик] OR-фолбэк (used=${orCriticUsed}/${OR_CRITIC_CAP})`);
    return {
      score: Number(p.score) || 0,
      steam: p.steam === true, plastic: p.plastic === true, text: p.text === true,
      people: p.people === true, wrong: p.wrong === true, glamor: p.glamor === true,
      note: String(p.note ?? '').slice(0, 80),
    };
  } catch (e) {
    console.error(`  [критик] OR-фолбэк: ${String(e.message).slice(0, 100)}`);
    return null;
  }
}

// ================= ОЧЕРЕДЬ =================
function buildQueue(locks) {
  const report = JSON.parse(read(REPORT) || '{}');
  const approved = new Set(readIds(APPROVE_FILE));
  const manual = new Set(readIds(MANUAL_FILE));
  const progress = new Set(readIds('scripts/regen-progress.txt'));
  const shortlist = readIds(SHORTLIST);
  const photos = new Set(
    fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4)) : [],
  );
  const isLocked = (id) => {
    const l = locks[id];
    if (!l || !photos.has(id)) return false;
    try {
      return sha256(fs.readFileSync(path.join(OUT_DIR, `${id}.jpg`))) === l.sha256;
    } catch {
      return false;
    }
  };
  const badFromReport = Object.entries(report)
    .filter(([id, r]) => r.score >= 0 && isBad(r) && !approved.has(id))
    .map(([id]) => id);
  const pendingShortlist = shortlist.filter((id) => !progress.has(id) && !approved.has(id));
  const queue = [...new Set([...badFromReport, ...manual, ...pendingShortlist])].filter((id) => !isLocked(id));
  return queue;
}

// ================= MAIN =================
async function main() {
  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.slice('--limit='.length)) || null : null;

  const locks = fs.existsSync(LOCKS_FILE) ? JSON.parse(fs.readFileSync(LOCKS_FILE, 'utf8')) : {};
  const subjects = fs.existsSync('scripts/photo-subjects.json')
    ? JSON.parse(fs.readFileSync('scripts/photo-subjects.json', 'utf8'))
    : {};
  const report = JSON.parse(read(REPORT) || '{}');

  let queue = onlyArg
    ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
    : buildQueue(locks);
  if (limit) queue = queue.slice(0, limit);
  // Худшие — первыми: им гарантированно хватит бюджета критика
  queue.sort((a, b) => {
    const sa = report[a]?.score >= 0 ? report[a].score : 0;
    const sb = report[b]?.score >= 0 ? report[b].score : 0;
    return sa - sb;
  });

  log(`=== НАТУРАЛ v7 старт: ${queue.length} блюд (кандидатов на блюдо: ${CANDIDATES}) ===`);
  if (!queue.length) {
    log('Очередь пуста — всё исправлено и заморожено.');
    return;
  }

  const zai = await ZAI.create();
  const paid = await orPaidTier();
  zaiCriticDead = !(await probeZaiCritic(zai));
  log(`Критик z-ai: ${zaiCriticDead ? 'НЕДОСТУПЕН (429) — работаю через OR-фолбэк' : 'жив'}`);
  zaiImageDead = !(await probeZaiImage(zai));
  log(`Генератор z-ai: ${zaiImageDead ? 'НЕДОСТУПЕН (429) — работаю через flux/OR' : 'жив'}`);
  const manualSet = new Set(readIds(MANUAL_FILE));
  let okCount = 0, manualCount = 0;

  for (const [dishIdx, id] of queue.entries()) {
    if (dishIdx > 0 && dishIdx % 5 === 0 && (zaiCriticDead || zaiImageDead)) {
      if (zaiCriticDead) {
        zaiCriticDead = !(await probeZaiCritic(zai)); // z-ai мог очнуться
        if (!zaiCriticDead) log('Критик z-ai ВЕРНУЛСЯ — переключаюсь на штатный');
      }
      if (zaiImageDead) {
        zaiImageDead = !(await probeZaiImage(zai));
        if (!zaiImageDead) log('Генератор z-ai ВЕРНУЛСЯ — переключаюсь на штатный');
      }
    }
    const subject = subjects[id] ?? id;
    log(`--- ${id}: «${subject.slice(0, 70)}…»`);

    // Кандидаты: платный OR (если тариф) → z-ai → turbo × остаток.
    // Промпты разные: z-ai/OR понимают негативы (DISH_STYLE_V7), SDXL-turbo —
    // только позитивные формулировки (TURBO_STYLE).
    const cands = [];
    for (let i = 0; i < CANDIDATES; i++) {
      const salt = paid ? i : i + 1;
      const promptV7 = `${subject}, ${sceneFor(id, salt)}, ${DISH_STYLE_V7}`;
      const promptTurbo = `${subject}, ${sceneFor(id, salt)}, ${TURBO_STYLE}`;
      let buf = null;
      if (paid) buf = await genOrImage(promptV7);
      if (!buf) buf = await genZai(zai, promptV7);
      if (!buf) buf = await genFlux(promptTurbo);
      if (buf) {
        const qa = await critiqueWithFallback(zai, buf, subject);
        cands.push({ buf, qa });
        if (qa && isPass(qa)) break; // гейт пройден — остальные кандидаты не нужны
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    const scored = cands.filter((c) => c.qa && c.qa.score >= 0);
    scored.sort((a, b) => b.qa.score - a.qa.score);
    const best = scored[0] ?? cands[0] ?? null;
    if (!best) {
      log(`FAIL ${id}: ни один канал не дал кадра`);
      continue;
    }

    const outPath = path.join(OUT_DIR, `${id}.jpg`);
    // Защита от регрессии: не записывать кадр хуже уже записанного/зааудированного.
    // База = максимум из балла аудита и последнего балла natural-прогона.
    let state = {};
    try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
    const baseScore = Math.max(report[id]?.score ?? -1, state[id] ?? -1);
    if (best.qa && best.qa.score >= 0 && baseScore >= 0 && best.qa.score < baseScore) {
      log(`KEEP ${id}: лучший кандидат ${best.qa.score} хуже текущего ${baseScore} — файл не трогаю`);
      if (!manualSet.has(id)) {
        manualSet.add(id);
        fs.appendFileSync(MANUAL_FILE, `${id}\n`);
      }
      manualCount++;
      continue;
    }
    fs.writeFileSync(outPath, best.buf);
    const score = best.qa ? best.qa.score : -1;
    const flags = flagsStr(best.qa);

    if (best.qa && isPass(best.qa)) {
      locks[id] = { sha256: sha256(best.buf), at: new Date().toISOString(), score, src: 'natural-v7' };
      fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks, null, 1));
      // Если блюдо было в ручном списке — убираем: гейт пройден
      const manualNow = new Set(readIds(MANUAL_FILE));
      if (manualNow.has(id)) {
        manualNow.delete(id);
        fs.writeFileSync(MANUAL_FILE, [...manualNow].join('\n') + '\n');
      }
      state[id] = score; // фиксируем балл замороженного кадра
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
      okCount++;
      log(`OK+ЗАМОК ${id} score=${score} (${flags}) каналов=${cands.length}`);
    } else {
      if (!manualSet.has(id)) {
        manualSet.add(id);
        fs.appendFileSync(MANUAL_FILE, `${id}\n`);
      }
      state[id] = score; // балл записанного улучшения — база для следующего прогона
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1));
      manualCount++;
      log(`MANUAL ${id} score=${score} (${flags}) — лучший из ${cands.length} записан, на ваш просмотр`);
    }
  }

  log(`=== НАТУРАЛ v7 итог: заморожено ${okCount}, на просмотр ${manualCount}, критик OR used=${orCriticUsed} ===`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
