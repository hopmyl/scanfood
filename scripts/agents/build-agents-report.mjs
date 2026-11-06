// Сборка пользовательского отчёта по агентам (фотограф + маркетолог) в download/
import fs from 'node:fs';

const photo = JSON.parse(fs.readFileSync('scripts/agents/photographer-report.json', 'utf8'));
const mkt = JSON.parse(fs.readFileSync('scripts/agents/marketer-prompts.json', 'utf8'));
const FENCE = '```';

const ids = process.argv[2]
  ? process.argv[2].split(',')
  : Object.keys(mkt.prompts);

const V = { GOOD: 'GOOD', RETOUCH: 'RETOUCH', REGEN: 'REGEN' };

let md = '# Агенты «Фотограф» и «Маркетолог» — разбор карточек СканРецепт\n\n';
md += '*Отчёт по запросу пользователя 2026-11-06; блюд в промптах: ' + ids.length + '*\n\n';
md += '---\n\n';
md += '## 1. Что бросается в глаза (профессиональный разбор)\n\n';
md += 'Все 8 присланных карточек сняты в одном постановочном ИИ-стиле: тёмный moody-фон, драматичный свет, глянцевые соусы. Каждая карточка по отдельности «нарядная», но серия выглядит синтетически. Главные общие маркеры нейрослопа:\n\n';
md += '1. **Восковой/пластиковый глянец** — соусы и хлеб блистают как пластик (корень — фраза "glossy natural sauces" в промпте генератора).\n';
md += '2. **«Ковровые» текстуры** — фарш, начинка, панировка как ровный ковёр из одинаковых гранул, без структуры рубленого мяса.\n';
md += '3. **Копии одного элемента** — фалафели: три почти идентичных шара; идеально повторяющиеся ломтики.\n';
md += '4. **Moody-клише** — чёрный фон + драматичные тени + фальшивое боке-«реквизит» на заднем плане.\n';
md += '5. **Несоответствие блюду** — «Пиде — турецкая ЛОДОЧКА» снята как круглый закрытый пирог (auth 2/10) — худшая карточка серии.\n';
md += '6. **Несоответствие составу** — «Синнабоны с глазурью» без глазури; тунцовый салат выглядит как тёртое мясо без соуса.\n\n';
md += '## 2. Вердикты агента-фотографа\n\n';
md += '| Блюдо | Вердикт | Средняя | Слоп | Соотв. | Заключение фотографа |\n';
md += '|---|---|---|---|---|---|\n';

for (const id of ids) {
  const p = photo[id];
  if (!p) continue;
  const note = String(p.note || '').replace(/\|/g, '/').slice(0, 180);
  md += '| **' + (p.nameRu || id) + '** | ' + (V[p.verdict] || p.verdict) + ' | ' + p.avg + '/10 | ' + p.slop + '/10 | ' + p.authenticity + '/10 | ' + note + ' |\n';
}

md += '\n**Оценочные оси** (0-10): свет, композиция, стайлинг, текстуры, соответствие блюду, аппетитность, чистота от слопа, бренд-стиль. Правила вердикта: соответствие блюду <=4 или слоп <=4 -> REGEN (только перегенерация); 8+ по средним и слопу -> GOOD; иначе RETOUCH.\n\n';
md += '**Найденные маркеры слопа по блюдам:**\n\n';

for (const id of ids) {
  const p = photo[id];
  if (!p) continue;
  md += '- **' + (p.nameRu || id) + '**: ' + ((p.slopMarkers || []).join(', ') || '—') + '\n';
}

md += '\n---\n\n';
md += '## 3. Анти-слоп устав агента-маркетолога\n\n';
md += mkt.styleCharter.ru.map((s, i) => (i + 1) + '. ' + s).join('\n') + '\n\n';
md += '## 4. Новые промпты маркетолога (по блюдам)\n\n';
md += 'Готовы к использованию в генераторе при разморозке. Каждый промпт обязан показать ключевой признак блюда (ключевой признак — focusRu).\n\n';

for (const id of ids) {
  const p = mkt.prompts[id];
  if (!p) continue;
  md += '### ' + (p.nameRu || id) + ' — ' + (V[p.verdict] || p.verdict) + '\n\n';
  md += '**Ключевой признак:** ' + (p.focusRu || '') + '\n\n';
  md += FENCE + '\nPROMPT: ' + p.prompt + '\n\nNEGATIVE: ' + (p.negative || '') + '\n' + FENCE + '\n\n';
}

if (mkt.styleProposal) {
  md += '## 5. Предложение новых констант стиля генератора (на утверждение)\n\n';
  md += 'Сейчас в generate-dish-photos.mjs зашито "dark slate plate on rustic dark wooden table" + "glossy natural sauces" — источник moody-клише и пластикового глянца. Предлагаемая замена (в код НЕ вносилась — заморозка промптов, нужно ваше одобрение):\n\n';
  md += FENCE + '\n';
  md += 'STYLE_A_NEW = "' + mkt.styleProposal.STYLE_A_NEW + '"\n\n';
  md += 'STYLE_B_NEW = "' + mkt.styleProposal.STYLE_B_NEW + '"\n\n';
  md += 'NEGATIVE_GLOBAL = "' + mkt.styleProposal.NEGATIVE_GLOBAL + '"\n';
  md += FENCE + '\n\n';
  md += '**Обоснование маркетолога:** ' + (mkt.styleProposal['обоснованиеRu'] || '') + '\n\n';
  md += '---\n\n';
}

md += '## 6. Как внедрять\n\n';
md += '1. **Согласовать стиль** — одобрить (или поправить) константы из раздела 5.\n';
md += '2. **Разморозка промптов** — после одобрения константы вносятся в scripts/generate-dish-photos.mjs (сейчас трогать запрещено условием заморозки).\n';
md += '3. **Перегенерация 8 блюд** — по промптам из раздела 4 (приоритет: turkish-pide — «не то блюдо», sloppy-joes и beef-burger — сильнейший слоп).\n';
md += '4. **Массовый контроль** — агент фотографа прогнать по всей базе: node scripts/agents/food-photographer.mjs --all --limit=40 (докатится за несколько прогонов, отчёт накапливается в scripts/agents/photographer-report.json).\n';
md += '5. Худшие по слопу попадут в очередь перегенерации — тем же конвейером NATURAL v7, что уже вычистил 260 фото.\n';

fs.mkdirSync('/home/z/my-project/download', { recursive: true });
fs.writeFileSync('/home/z/my-project/download/otchet-agenty-fotograf-i-marketolog.md', md);
console.log('OK: download/otchet-agenty-fotograf-i-marketolog.md,', md.length, 'bytes');
