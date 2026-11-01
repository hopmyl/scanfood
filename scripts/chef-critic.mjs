// АГЕНТ-ПОВАР СканРецепта — проверка правильности рецептов и порядка приготовления.
// Пользовательское задание 2026-11-01: «агент повар, который будет проверять
// правильность рецептов и порядок приготовления».
//
// Два уровня проверки:
//   1) СТАТИКА (без квоты ИИ, все блюда): шаги/ингредиенты не пусты, каждый
//      ингредиент из списка реально упоминается в шагах, температуры в разумных
//      пределах (100-280°C), длительности шага <= 10 часов, КБЖУ согласовано
//      с калорийностью (±45%).
//   2) LLM-проверка (glm-4.6, текст, дёшево): кулинарная логика и ПОРЯДОК шагов
//      (подготовка -> основное -> подача), нереалистичные времена/температуры,
//      опасные пропуски (недоготовленная птица/свинина), неиспользованные
//      ингредиенты, противоречия между ингредиентами и шагами.
//
// Результат инкрементально пишется в scripts/chef-report.json:
//   { id: { verdict: 'ok'|'fix', major, minor, issues[], static[], at, hash } }
// Брак (verdict=fix) сливается (без затирания) в scripts/chef-fixlist.txt —
// список правок рецептов. САМ src/data НЕ ПРАВИТСЯ: правки — отдельным
// одобренным шагом (заморозка изменений контента).
// Данные блюд подгружаются бандлом esbuild из src/data/dishes.ts (TS -> ESM).
// Запуск: node scripts/chef-critic.mjs [--limit=N] [--rerun] [--only=id1,id2]
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import esbuild from 'esbuild';

const REPORT = 'scripts/chef-report.json';
const FIXLIST = 'scripts/chef-fixlist.txt';
const MODEL = 'glm-4.6';

const rerun = process.argv.includes('--rerun');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const onlyIds = onlyArg
  ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : null;
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) || 20 : 20;

// --- Загрузка блюд: бандлим TS в /tmp и импортируем -------------------------
async function loadDishes() {
  const outfile = '/tmp/skanrecept-dishes-bundle.mjs';
  await esbuild.build({
    entryPoints: ['src/data/dishes.ts'],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
  });
  const mod = await import(outfile);
  return mod.DISHES;
}

// --- Статические проверки (бесплатные) --------------------------------------
const words = (s) =>
  s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я\s-]/g, ' ').split(/\s+/).filter(Boolean);

/** Грубая нормализация слова к основе: отрезаем частые русские окончания */
function stem(w) {
  return w
    .replace(/(ами|ями|ов|ев|ой|ий|ый|ая|ое|ые|ых|ую|ем|ам|ям|ах|ях|у|ю|а|я|ы|и|е|о|ь)$/, '');
}

function ingMentionedInSteps(ing, stepsText) {
  const tokens = words(ing).filter((w) => w.length >= 4 && !['растительное', 'по'].includes(w));
  if (!tokens.length) return true; // «соль», «масло» и note — пропускаем
  return tokens.some((t) => stepsText.includes(stem(t)));
}

function staticChecks(dish) {
  const problems = [];
  const steps = dish.steps ?? [];
  const ings = dish.ingredients ?? [];
  if (steps.length < 3) problems.push(`шагов всего ${steps.length}, нужно >= 3`);
  if (ings.length < 3) problems.push(`ингредиентов всего ${ings.length}, нужно >= 3`);

  const stepsText = steps.map(words).flat().map(stem).join(' ');
  for (const ing of ings) {
    if (ing.note) continue; // «по вкусу», «для жарки» — могут не упоминаться
    if (!ingMentionedInSteps(ing.name, stepsText)) {
      problems.push(`ингредиент «${ing.name}» не упоминается в шагах`);
    }
  }

  const joined = steps.join(' ');
  for (const m of joined.matchAll(/(\d{2,3})\s*°/g)) {
    const t = Number(m[1]);
    if (t < 100 || t > 280) problems.push(`подозрительная температура ${t}°C в шагах`);
    break; // первой найденной достаточно
  }
  for (const m of joined.matchAll(/(\d+)\s*(мин|час|ч\b|сут)/g)) {
    const n = Number(m[1]);
    const unit = m[2];
    const mins = unit.startsWith('сут') ? n * 1440 : unit.startsWith('час') || unit === 'ч' ? n * 60 : n;
    if (mins > 600) {
      problems.push(`шаг длится ${n} ${unit} — больше 10 часов, похоже на ошибку`);
      break;
    }
  }

  const kcal = Number(dish.kcal) || 0;
  if (kcal < 50 || kcal > 1500) problems.push(`ккал ${kcal} вне диапазона 50-1500`);
  const { p, f, c } = dish.bju ?? { p: 0, f: 0, c: 0 };
  const calc = 4 * p + 9 * f + 4 * c;
  if (kcal > 0 && calc > 0 && Math.abs(calc - kcal) / kcal > 0.45) {
    problems.push(`КБЖУ не сходится: по нутриентам ${Math.round(calc)} ккал против заявленных ${kcal}`);
  }
  return problems;
}

// --- LLM-проверка шефом -------------------------------------------------------
function chefPrompt(dish) {
  const ings = (dish.ingredients ?? [])
    .map((i) => `- ${i.name}${i.qty != null ? ` — ${i.qty} ${i.unit ?? ''}` : ''}${i.note ? ` (${i.note})` : ''}`)
    .join('\n');
  const steps = (dish.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n');
  return (
    'Ты — шеф-повар и технолог общественного питания. Проверь рецепт блюда ' +
    `«${dish.nameRu}» (категория: ${dish.category}).\n\n` +
    `ИНГРЕДИЕНТЫ:\n${ings}\n\nШАГИ:\n${steps}\n\n` +
    'Проверь: 1) каждый ли ингредиент используется и в нужном месте; ' +
    '2) ПРАВИЛЬНОСТЬ ПОРЯДКА шагов (подготовка -> основное приготовление -> подача; ' +
    'разогрев духовки/масла до жарки; маринады и отдых теста вовремя); ' +
    '3) реалистичность времени и температур для техники шага; ' +
    '4) безопасность (птица/свинина/фарш не остаются недоготовленными, яйца — термически обработаны); ' +
    '5) противоречия (соль не добавлена, соус подаётся до варки и т.п.).\n' +
    'Не придирайся к вариативности сервировки и домашней подаче.\n' +
    'Ответ — СТРОГО валидный JSON без markdown:\n' +
    '{"verdict": "ok" | "fix", "issues": [{"severity": "major"|"minor", "step": 0, ' +
    '"problem": "кратко по-русски", "fix": "как исправить, кратко"}], "note": "итог одним предложением"}\n' +
    'verdict="fix", если есть хотя бы одна major-проблема; step — номер шага (0 — общий).'
  );
}

function parseChefJson(text) {
  const m = String(text ?? '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('нет JSON в ответе шефа');
  const p = JSON.parse(m[0]);
  const issues = Array.isArray(p.issues)
    ? p.issues.slice(0, 8).map((i) => ({
        severity: i?.severity === 'major' ? 'major' : 'minor',
        step: Number(i?.step) || 0,
        problem: String(i?.problem ?? '').slice(0, 200),
        fix: String(i?.fix ?? '').slice(0, 200),
      }))
    : [];
  return {
    verdict: p.verdict === 'fix' || issues.some((i) => i.severity === 'major') ? 'fix' : 'ok',
    issues,
    note: String(p.note ?? '').slice(0, 160),
  };
}

async function chefCheck(zai, dish, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await zai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: chefPrompt(dish) }],
        temperature: 0.2,
      });
      return parseChefJson(res?.choices?.[0]?.message?.content ?? '');
    } catch (err) {
      const isRate = /\b429\b|Too many requests|rate.?limit/i.test(String(err?.message));
      console.error(`  [шеф] попытка ${attempt}: ${err.message}`);
      if (attempt < attempts) await new Promise((r) => setTimeout(r, isRate ? 30000 : 5000 * attempt));
    }
  }
  return { verdict: 'error', issues: [], note: 'ошибка проверки (повторит следующий прогон)' };
}

// --- Основной цикл -------------------------------------------------------------
const recipeHash = (d) =>
  crypto
    .createHash('md5')
    .update(JSON.stringify([d.nameRu, d.ingredients, d.steps, d.kcal, d.bju]))
    .digest('hex')
    .slice(0, 10);

async function main() {
  const dishes = await loadDishes();
  const byId = onlyIds ? new Map(dishes.filter((d) => onlyIds.includes(d.id)).map((d) => [d.id, d])) : null;
  const report = fs.existsSync(REPORT) && !rerun ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : {};

  // Кандидаты: нет записи, изменился рецепт (hash), verdict=error или --rerun/--only
  const queue = [];
  for (const d of dishes) {
    if (byId && !byId.has(d.id)) continue;
    const prev = report[d.id];
    const hash = recipeHash(d);
    const stale = rerun || onlyIds || !prev || prev.hash !== hash || prev.verdict === 'error';
    if (stale) queue.push({ dish: d, hash });
  }
  const slice = queue.slice(0, limit);

  console.log(
    `Агент-повар: к проверке ${slice.length} из ${dishes.length} блюд (в отчёте: ${Object.keys(report).length}, очередь: ${queue.length})`,
  );

  if (slice.length === 0) {
    console.log('=== ИТОГ: всё актуально, новых проверок не нужно');
    return;
  }

  // Статика — все queued сразу (бесплатно), LLM — срезом
  const zai = await ZAI.create();
  let done = 0;
  for (const { dish, hash } of slice) {
    const staticProblems = staticChecks(dish);
    let entry;
    if (staticProblems.length >= 3) {
      // Жёсткая статика — LLM не тратим: проблемы и так явные
      entry = {
        verdict: 'fix',
        major: staticProblems.length,
        minor: 0,
        issues: staticProblems.map((s) => ({ severity: 'major', step: 0, problem: s, fix: '' })),
        note: 'статические проверки',
        src: 'static',
      };
    } else {
      const chef = await chefCheck(zai, dish);
      const staticIssues = staticProblems.map((s) => ({
        severity: 'minor',
        step: 0,
        problem: s,
        fix: '',
      }));
      const allIssues = [...chef.issues, ...staticIssues];
      // ошибка LLM без статики => 'error' (перепроверится следующим прогоном),
      // а не 'ok' — блюдо фактически не проверено
      const verdict =
        chef.verdict === 'error' && staticProblems.length === 0
          ? 'error'
          : chef.verdict === 'fix' || staticProblems.length
            ? 'fix'
            : 'ok';
      entry = {
        verdict,
        major: allIssues.filter((i) => i.severity === 'major').length,
        minor: allIssues.filter((i) => i.severity === 'minor').length,
        issues: allIssues,
        note: chef.note,
        src: 'llm+static',
      };
    }
    entry.hash = hash;
    entry.at = new Date().toISOString();
    report[dish.id] = entry;
    done++;
    const badge =
      entry.verdict === 'fix' ? `FIX (${entry.major} major)` : entry.verdict === 'error' ? 'ошибка' : 'ok';
    console.log(`[${done}/${slice.length}] ${dish.id}: ${badge}${entry.note ? ' — ' + entry.note : ''}`);
    // Пишем ПОСЛЕ КАЖДОГО блюда: блюда медленные (ретраи 429), таймаут не должен
    // обнулять проделанную работу. Фикслист тоже мерджим сразу.
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
    const bad = Object.entries(report)
      .filter(([, r]) => r.verdict === 'fix')
      .map(([id]) => id);
    const pending = new Set(
      fs.existsSync(FIXLIST)
        ? fs.readFileSync(FIXLIST, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
        : [],
    );
    for (const id of bad) pending.add(id);
    fs.writeFileSync(FIXLIST, [...pending].sort().join('\n'));
  }

  const bad = Object.entries(report)
    .filter(([, r]) => r.verdict === 'fix')
    .map(([id]) => id);
  console.log(
    `=== ИТОГ: в отчёте ${Object.keys(report).length}, с fix-вердиктом: ${bad.length}`,
  );
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
