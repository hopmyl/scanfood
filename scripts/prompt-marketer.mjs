// АГЕНТ «МАРКЕТОЛОГ ПРОМПТОВ» (запрос пользователя 2026-11-06: «создай агента
// маркетолога, который сделает правильные промпты, чтобы не было нейрослопа»).
// Вход: брак из scripts/photographer-fixlist.txt + замечания фотографа
// (photographer-report.json: advice/flags) + исходные subject'ы (photo-subjects.json).
// Выход: scripts/prompt-suggestions.json — на каждое блюдо улучшенный промпт
// генерации (английский) + варианты сцен для best-of-N + список запретов;
// и сводная формула scripts/antislop-guide.md (статичная методичка + счётчики).
// ВАЖНО: сам генератор и его промпты НЕ меняются (заморозка конвейера) —
// агент только готовит предложения, которые применит пользователь/следующий релиз.
// Запуск: node scripts/prompt-marketer.mjs [--only=id1,id2] [--limit=N]
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'node:fs';

const FIXLIST = 'scripts/photographer-fixlist.txt';
const PH_REPORT = 'scripts/photographer-report.json';
const SUBJECTS = fs.existsSync('scripts/photo-subjects.json')
  ? JSON.parse(fs.readFileSync('scripts/photo-subjects.json', 'utf8'))
  : {};
const SUGGESTIONS = 'scripts/prompt-suggestions.json';
const GUIDE = 'scripts/antislop-guide.md';
const MODEL = 'glm-4.6';

const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const onlyIds = onlyArg
  ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : null;
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) || null : null;

// ФОРМУЛА АНТИ-СЛОПА — выжимка всех аудитов 2026-10/11 (пластик, неон-глянец,
// рисованный пар, леттеринг, кривые тарелки). Одна на все генерации.
export const ANTISLOP_FORMULA = [
  'Натуральный дневной свет из окна (soft daylight), никакой студийной драмы и контрового неона.',
  'Матовость: хлеб без «лакированной корки», соус не блестит как пластик, мясо с волокнами, зелень с жилками.',
  'Неидеальность: неровные края, крошки на столе, неровно намазанное масло/соус, слегка съехавшая начинка, конденсат на холодном.',
  'Реальная сцена: обычный деревянный/керамический стол, живой фон с лёгким расфокусом, посуда с следами использования.',
  'Естественные цвета без HDR-перенасыщенности; лёгкая глубина резкости как у камеры телефона.',
  'Никакого текста/леттеринга/логотипов в кадре, никакого нарисованного пара.',
].join(' ');

const FORBIDDEN_WORDS =
  'glamour, studio lighting, dramatic lighting, neon, 8k, ultra-detailed, hyper-realistic, ' +
  'perfect, advertising shot, commercial render, 3D render, glossy, cinematic lighting, food advertisement';

function marketerPrompt(subject, photoReport) {
  const issues = [];
  if (photoReport) {
    if (photoReport.light) issues.push('нефизичный/студийный свет');
    if (photoReport.texture) issues.push('восковые «нейронные» текстуры');
    if (photoReport.physics) issues.push('нарушенная физика/геометрия');
    if (photoReport.color) issues.push('перенасыщенный HDR-цвет');
    if (photoReport.props) issues.push('фейковые посуда/фон');
    if (photoReport.advice) issues.push(`совет фотографа: ${photoReport.advice}`);
  }
  return (
    'Ты — фуд-маркетолог и промпт-инженер генератора изображений. Для блюда составь НОВЫЙ промпт генерации,\n' +
    'который исключит ИИ-артефакты («нейрослоп»), замеченные фотографом.\n' +
    'Блюдо (текущий промпт-субъект): «' + subject + '»\n' +
    'Проблемы кадра: ' + (issues.length ? issues.join('; ') : 'общий нейрослоп-глянец') + '\n\n' +
    'Формула анти-слопа (обязательно учесть): ' + ANTISLOP_FORMULA + '\n' +
    'Запрещённые слова и стили: ' + FORBIDDEN_WORDS + '.\n\n' +
    'Ответь ТОЛЬКО JSON без markdown:\n' +
    '{"improved":"1-3 предложения на английском: блюдо + сцена со всеми анти-слоп деталями",' +
    '"variants":["2 альтернативные сцены на английском для best-of-N"],"why":"кратко по-русски, что изменил и почему"}\n' +
    'Промпт должен остаться про ТО ЖЕ блюдо (не менять состав и узнаваемость), меняться должна только съёмка/сцена.'
  );
}

async function suggest(zai, subject, photoReport, { attempts = 3 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await zai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: marketerPrompt(subject, photoReport) }],
        thinking: { type: 'disabled' },
      });
      const text = String(res?.choices?.[0]?.message?.content ?? '');
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('нет JSON в ответе маркетолога');
      const p = JSON.parse(m[0]);
      return {
        improved: String(p.improved ?? '').slice(0, 600),
        variants: (Array.isArray(p.variants) ? p.variants : []).slice(0, 3).map((s) => String(s).slice(0, 400)),
        why: String(p.why ?? '').slice(0, 200),
      };
    } catch (err) {
      const isRate = String(err?.message).includes('429');
      console.error(`  [маркетолог] попытка ${attempt}: ${err.message}`);
      if (attempt < attempts)
        await new Promise((r) => setTimeout(r, isRate ? 70000 : 5000 * attempt));
    }
  }
  return null;
}

function writeGuide(sug, badCount) {
  const lines = [
    '# Анти-слоп методичка для генерации фото блюд',
    '',
    `_Обновлено ${new Date().toISOString().slice(0, 10)} · агент-маркетолог · брака фотографа сейчас: ${badCount}_`,
    '',
    '## Формула (база каждого промпта)',
    '',
    ...ANTISLOP_FORMULA.split('. ').filter(Boolean).map((s) => '- ' + s.trim().replace(/\.?$/, '.')),
    '',
    '## Запрещённые слова и стили',
    '',
    FORBIDDEN_WORDS + '.',
    '',
    '## Почему появляется слоп (наши кейсы)',
    '',
    '- Восковый/мраморный глянец — следствие слов «glossy, 8k, ultra-detailed, advertising».',
    '- Нарисованный пар и декоративный дым — генератор «украшает»; пар в промпт не просить.',
    '- Студийный тёмный фон с контровым светом — «glamour/studio/dramatic»; вместо этого daylight window.',
    '- Леттеринг на еде и кривые этикетки — просить «no text, no labels» в сцене.',
    '- Идеально одинаковые элементы и невозможные разрезы — добавлять в промпт «imperfect, hand-cut, slightly messy».',
    '',
    '## Готовые улучшенные промпты по браку',
    '',
  ];
  for (const [id, s] of Object.entries(sug)) {
    if (!s) continue;
    lines.push(`### ${id}`);
    lines.push(`- Было: \`${s.original}\``);
    lines.push(`- Стало: \`${s.improved}\``);
    for (const v of s.variants || []) lines.push(`- Вариант: \`${v}\``);
    lines.push(`- Зачем: ${s.why}`);
    lines.push('');
  }
  fs.writeFileSync(GUIDE, lines.join('\n'));
}

async function main() {
  const zai = await ZAI.create();
  const phReport = fs.existsSync(PH_REPORT) ? JSON.parse(fs.readFileSync(PH_REPORT, 'utf8')) : {};
  const existing = fs.existsSync(SUGGESTIONS) ? JSON.parse(fs.readFileSync(SUGGESTIONS, 'utf8')) : {};

  let ids = fs.existsSync(FIXLIST)
    ? fs.readFileSync(FIXLIST, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
    : [];
  if (onlyIds) ids = onlyIds;
  ids = ids.filter((id) => SUBJECTS[id]);
  if (limit) ids = ids.slice(0, limit);

  console.log(`Маркетолог: блюд в работе ${ids.length}${onlyIds ? ' (явный список)' : ' (весь брак фотографа)'}`);
  const suggestions = { ...existing };
  let done = 0;
  for (const id of ids) {
    const original = SUBJECTS[id];
    process.stdout.write(`- ${id}: `);
    const s = await suggest(zai, original, phReport[id]);
    if (s) {
      s.original = original;
      s.ts = new Date().toISOString();
      suggestions[id] = s;
      done++;
      console.log(`готово — ${s.why}`);
    } else {
      console.log('не удалось (квота/сеть) — докатит следующий запуск');
    }
    fs.writeFileSync(SUGGESTIONS, JSON.stringify(suggestions, null, 1));
  }

  const badCount = fs.existsSync(FIXLIST)
    ? fs.readFileSync(FIXLIST, 'utf8').split('\n').filter(Boolean).length
    : 0;
  writeGuide(suggestions, badCount);
  console.log(`ИТОГ маркетолога: новых промптов ${done}, всего в prompt-suggestions.json ${Object.keys(suggestions).length}`);
  console.log(`Методичка: ${GUIDE}`);
}

main().catch((e) => {
  console.error('Фатальная ошибка маркетолога:', e.message);
  process.exit(1);
});
