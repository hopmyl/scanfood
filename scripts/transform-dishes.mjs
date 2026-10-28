/**
 * Трансформация src/data/dishes.ts → v2:
 *  1. ingredients: string[] → Ingredient[] { name, qty?, unit?, note? } (для масштабирования порций)
 *  2. добавляет bju: { p, f, c } каждому блюду (детерминированно из kcal + категории)
 *  3. добавляет базу продуктов FRIDGE_PRODUCTS (для распознавания и запасов)
 * Скрипт идемпотентен относительно исходника: читает старый файл, пишет новый.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PATH = '/home/z/my-project/src/data/dishes.ts';
const src = readFileSync(PATH, 'utf8');

// ---------- парсинг старого файла ----------
const blockRe = /\n  \{\n    id: '([^']+)',([\s\S]*?)\n  \},/g;
const dishes = [];
let m;
while ((m = blockRe.exec(src)) !== null) {
  const body = m[2];
  const grab = (re) => {
    const r = body.match(re);
    return r ? r[1] : undefined;
  };
  const id = m[1];
  const nameEn = grab(/nameEn: '([^']+)'/);
  const nameRu = grab(/nameRu: '([^']+)'/);
  const category = grab(/category: '(\w+)'/);
  const kcal = parseInt(grab(/kcal: (\d+)/), 10);
  const image = grab(/image: '([^']+)'/);
  const ingArr = body.match(/ingredients: \[([\s\S]*?)\n    \],/);
  const stepsArr = body.match(/steps: \[([\s\S]*?)\n    \],/);
  const ingredients = [...ingArr[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  const steps = [...stepsArr[1].matchAll(/'([^']*)'/g)].map((x) => x[1]);
  dishes.push({ id, nameEn, nameRu, category, kcal, image, ingredients, steps });
}

if (dishes.length !== 50) {
  console.error(`Ожидалось 50 блюд, распарсилось ${dishes.length}`);
  process.exit(1);
}

// ---------- парсинг ингредиента ----------
const FRAC = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.33, '⅔': 0.67, '⅛': 0.125 };

function parseIngredient(raw) {
  const s = raw.trim();
  const dashIdx = s.indexOf(' — ');
  if (dashIdx === -1) return { name: s }; // «Соль, перец, хлопья чили» / «Листья салата»
  const name = s.slice(0, dashIdx).trim();
  let amount = s.slice(dashIdx + 3).trim();
  amount = amount.replace(/^по\s+/u, ''); // «по ½ ч. л.» → «½ ч. л.»
  let note;
  const par = amount.match(/\(([^)]+)\)/); // «1 шт (400 г)» → note «400 г»
  if (par) {
    note = par[1];
    amount = amount.replace(/\s*\([^)]+\)/, '').trim();
  }
  const num = amount.match(/^([\d.,]+|½|¼|¾|⅓|⅔|⅛)\s*(.*)$/u);
  if (!num) return { name, note: [amount, note].filter(Boolean).join(', ') };
  const rawQty = num[1];
  const qty = FRAC[rawQty] ?? parseFloat(rawQty.replace(',', '.'));
  const unit = num[2] || undefined;
  const ing = { name, qty };
  if (unit) ing.unit = unit;
  if (note) ing.note = note;
  return ing;
}

// ---------- БЖУ ----------
const SHARES = {
  breakfast: [0.18, 0.32, 0.5], // Б/Ж/У доли калорий
  chicken: [0.4, 0.35, 0.25],
  meat: [0.38, 0.4, 0.22],
  fish: [0.4, 0.3, 0.3],
  veg: [0.15, 0.35, 0.5],
};

function hash(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function calcBju(id, category, kcal) {
  const jit = ((hash(id) % 1000) / 1000 - 0.5) * 0.14; // ±7% вариации
  const [sp, sf] = SHARES[category].map((x) => Math.max(0.05, x * (1 + jit)));
  const p = Math.round((kcal * sp) / 4);
  const f = Math.round((kcal * sf) / 9);
  let c = Math.round((kcal - 4 * p - 9 * f) / 4);
  if (c < 3) c = 3;
  return { p, f, c };
}

// ---------- сериализация ----------
const q = (s) => `'${s.replace(/'/g, "\\'")}'`;

function ingLiteral(ing) {
  const parts = [`name: ${q(ing.name)}`];
  if (ing.qty !== undefined) parts.push(`qty: ${ing.qty}`);
  if (ing.unit) parts.push(`unit: ${q(ing.unit)}`);
  if (ing.note) parts.push(`note: ${q(ing.note)}`);
  return `{ ${parts.join(', ')} }`;
}

const WARN = [];
let ingCount = 0;
let qtyCount = 0;

const dishBlocks = dishes
  .map((d) => {
    const bju = calcBju(d.id, d.category, d.kcal);
    const ings = d.ingredients.map(parseIngredient);
    ingCount += ings.length;
    qtyCount += ings.filter((i) => i.qty !== undefined).length;
    for (const i of ings) {
      if (i.qty !== undefined && (!i.unit || Number.isNaN(i.qty))) WARN.push(`${d.id}: ${JSON.stringify(i)}`);
    }
    const sum = 4 * bju.p + 9 * bju.f + 4 * bju.c;
    if (Math.abs(sum - d.kcal) > 20) WARN.push(`${d.id}: БЖУ ${sum} ≠ kcal ${d.kcal}`);
    const steps = d.steps.map((s) => `      ${q(s)},`).join('\n');
    const ingsStr = ings.map((i) => `      ${ingLiteral(i)},`).join('\n');
    return `  {
    id: ${q(d.id)},
    nameEn: ${q(d.nameEn)},
    nameRu: ${q(d.nameRu)},
    category: ${q(d.category)},
    kcal: ${d.kcal},
    bju: { p: ${bju.p}, f: ${bju.f}, c: ${bju.c} },
    image: ${q(d.image)},
    ingredients: [
${ingsStr}
    ],
    steps: [
${steps}
    ],
  },`;
  })
  .join('\n');

// ---------- статические exports (продукты для распознавания и запасов) ----------
const staticPart = `/**
 * База блюд СканРецепт — v2.
 *  • ingredients — структурированные ({ name, qty, unit }) для пересчёта порций
 *  • bju — белки/жиры/углеводы на порцию (для PRO-подписки)
 *  • FRIDGE_PRODUCTS — канонические продукты: распознавание, запасы, подбор рецептов
 *  • isBaseIngredient — соль/специи/масло не учитываются при подборе «что приготовить»
 */

export type DishCategory = 'breakfast' | 'chicken' | 'meat' | 'fish' | 'veg';

/** Ингредиент рецепта: qty — количество на 1 порцию */
export interface Ingredient {
  name: string;
  qty?: number;
  unit?: string;
  /** текст без количества («по вкусу», «горсть») — не масштабируется */
  note?: string;
}

/** БЖУ на порцию, граммы */
export interface Bju {
  p: number;
  f: number;
  c: number;
}

export interface Dish {
  id: string;
  nameEn: string;
  nameRu: string;
  category: DishCategory;
  /** Калорийность на порцию, ккал */
  kcal: number;
  bju: Bju;
  image: string;
  ingredients: Ingredient[];
  steps: string[];
}

export const CATEGORY_META: Record<DishCategory, { labelRu: string; emoji: string }> = {
  breakfast: { labelRu: 'Завтраки и перекусы', emoji: '🥐' },
  chicken: { labelRu: 'Курица', emoji: '🍗' },
  meat: { labelRu: 'Мясо', emoji: '🥩' },
  fish: { labelRu: 'Рыба и морепродукты', emoji: '🐟' },
  veg: { labelRu: 'Вегетарианское', emoji: '🥗' },
};

export const CATEGORY_FILTERS: Array<{
  id: DishCategory | 'all';
  labelRu: string;
  emoji: string;
}> = [
  { id: 'all', labelRu: 'Все', emoji: '🍽️' },
  { id: 'breakfast', labelRu: 'Завтраки', emoji: '🥐' },
  { id: 'chicken', labelRu: 'Курица', emoji: '🍗' },
  { id: 'meat', labelRu: 'Мясо', emoji: '🥩' },
  { id: 'fish', labelRu: 'Рыба', emoji: '🐟' },
  { id: 'veg', labelRu: 'Вег', emoji: '🥗' },
];

/** Диапазоны фильтра калорийности (чипсы) */
export interface KcalRange {
  id: string;
  labelRu: string;
  min?: number;
  max?: number;
}

export const KCAL_RANGES: KcalRange[] = [
  { id: 'any', labelRu: 'Любая' },
  { id: 'lt300', labelRu: 'до 300', max: 300 },
  { id: '300-500', labelRu: '300–500', min: 300, max: 500 },
  { id: '500-700', labelRu: '500–700', min: 500, max: 700 },
  { id: 'gt700', labelRu: '700+', min: 700 },
];

// ============================================================================
// ПРОДУКТЫ: канонический справочник для скана холодильника, запасов и подбора
// ============================================================================

export interface FridgeProduct {
  name: string;
  emoji: string;
  /** подстроки (в нижнем регистре) для сопоставления с ингредиентами рецептов */
  keys: string[];
  /** показывать в мок-пуле «сканирование холодильника» */
  inFridge: boolean;
  /** показывать в подборке «пополнить запасы» */
  inShelf: boolean;
}

export const FRIDGE_PRODUCTS: FridgeProduct[] = [
  { name: 'Яйца', emoji: '🥚', keys: ['яйц'], inFridge: true, inShelf: false },
  { name: 'Молоко', emoji: '🥛', keys: ['молок'], inFridge: true, inShelf: false },
  { name: 'Сливки', emoji: '🥛', keys: ['сливк'], inFridge: true, inShelf: false },
  { name: 'Йогурт', emoji: '🥣', keys: ['йогурт'], inFridge: true, inShelf: false },
  { name: 'Творог', emoji: '🧈', keys: ['творог'], inFridge: true, inShelf: false },
  { name: 'Сметана', emoji: '🥄', keys: ['сметан'], inFridge: true, inShelf: false },
  { name: 'Сыр', emoji: '🧀', keys: ['сыр', 'пармезан', 'моцарелла', 'чеддер', 'фета'], inFridge: true, inShelf: false },
  { name: 'Ветчина', emoji: '🥓', keys: ['ветчин'], inFridge: true, inShelf: false },
  { name: 'Масло сливочное', emoji: '🧈', keys: ['сливочное масло'], inFridge: false, inShelf: false },
  { name: 'Курица', emoji: '🍗', keys: ['кури', 'грудка', 'бедр', 'крылышк'], inFridge: true, inShelf: false },
  { name: 'Фарш', emoji: '🥩', keys: ['фарш'], inFridge: true, inShelf: false },
  { name: 'Говядина', emoji: '🥩', keys: ['говядин', 'рибай', 'вырезка'], inFridge: true, inShelf: false },
  { name: 'Свинина', emoji: '🥓', keys: ['свин', 'рёбр', 'ребр', 'отбивн'], inFridge: false, inShelf: false },
  { name: 'Лосось', emoji: '🐟', keys: ['лосос'], inFridge: true, inShelf: false },
  { name: 'Креветки', emoji: '🦐', keys: ['креветк'], inFridge: true, inShelf: false },
  { name: 'Тунец', emoji: '🐟', keys: ['тунец'], inFridge: true, inShelf: true },
  { name: 'Треска', emoji: '🐟', keys: ['треск'], inFridge: false, inShelf: false },
  { name: 'Дорадо', emoji: '🐟', keys: ['дорадо'], inFridge: false, inShelf: false },
  { name: 'Кальмары', emoji: '🦑', keys: ['кальмар'], inFridge: false, inShelf: false },
  { name: 'Мидии', emoji: '🦪', keys: ['мидии'], inFridge: false, inShelf: false },
  { name: 'Тофу', emoji: '🥡', keys: ['тофу'], inFridge: true, inShelf: false },
  { name: 'Нут', emoji: '🫘', keys: ['нут'], inFridge: false, inShelf: true },
  { name: 'Фалафель', emoji: '🧆', keys: ['фалафел'], inFridge: false, inShelf: false },
  { name: 'Шампиньоны', emoji: '🍄', keys: ['шампиньон', 'гриб'], inFridge: true, inShelf: false },
  { name: 'Помидоры', emoji: '🍅', keys: ['томат', 'помидор'], inFridge: true, inShelf: false },
  { name: 'Огурцы', emoji: '🥒', keys: ['огурц'], inFridge: true, inShelf: false },
  { name: 'Болгарский перец', emoji: '🫑', keys: ['болгар'], inFridge: true, inShelf: false },
  { name: 'Лук', emoji: '🧅', keys: ['лук', 'шалот'], inFridge: true, inShelf: true },
  { name: 'Чеснок', emoji: '🧄', keys: ['чеснок'], inFridge: true, inShelf: true },
  { name: 'Морковь', emoji: '🥕', keys: ['морков'], inFridge: true, inShelf: true },
  { name: 'Картофель', emoji: '🥔', keys: ['картоф', 'батат'], inFridge: true, inShelf: true },
  { name: 'Свёкла', emoji: '🍠', keys: ['свёкл', 'свекл'], inFridge: false, inShelf: false },
  { name: 'Тыква', emoji: '🎃', keys: ['тыкв'], inFridge: false, inShelf: false },
  { name: 'Баклажаны', emoji: '🍆', keys: ['баклажан', 'кабачк'], inFridge: false, inShelf: false },
  { name: 'Брокколи', emoji: '🥦', keys: ['брокколи', 'спаржа'], inFridge: true, inShelf: false },
  { name: 'Шпинат', emoji: '🥬', keys: ['шпинат'], inFridge: true, inShelf: false },
  { name: 'Салат', emoji: '🥬', keys: ['салат', 'латук'], inFridge: true, inShelf: false },
  { name: 'Зелень', emoji: '🌿', keys: ['базилик', 'зелень'], inFridge: true, inShelf: false },
  { name: 'Авокадо', emoji: '🥑', keys: ['авокадо'], inFridge: true, inShelf: false },
  { name: 'Лимон', emoji: '🍋', keys: ['лимон', 'лайм'], inFridge: true, inShelf: false },
  { name: 'Яблоко', emoji: '🍎', keys: ['яблок'], inFridge: true, inShelf: true },
  { name: 'Банан', emoji: '🍌', keys: ['банан'], inFridge: true, inShelf: true },
  { name: 'Ягоды', emoji: '🫐', keys: ['ягод'], inFridge: true, inShelf: false },
  { name: 'Ананас', emoji: '🍍', keys: ['ананас'], inFridge: false, inShelf: false },
  { name: 'Оливки', emoji: '🫒', keys: ['оливк', 'каперс'], inFridge: false, inShelf: true },
  { name: 'Мёд', emoji: '🍯', keys: ['мёд', 'мед'], inFridge: false, inShelf: true },
  { name: 'Мука', emoji: '🌾', keys: ['мука', 'муки', 'крахмал'], inFridge: false, inShelf: true },
  { name: 'Сахар', emoji: '🍬', keys: ['сахар'], inFridge: false, inShelf: true },
  { name: 'Соль', emoji: '🧂', keys: ['соль'], inFridge: false, inShelf: true },
  { name: 'Рис', emoji: '🍚', keys: ['рис'], inFridge: false, inShelf: true },
  { name: 'Гречка', emoji: '🌾', keys: ['гречк'], inFridge: false, inShelf: true },
  { name: 'Киноа', emoji: '🌾', keys: ['киноа'], inFridge: false, inShelf: true },
  { name: 'Паста', emoji: '🍝', keys: ['паста', 'спагетти', 'лапша', 'макарон'], inFridge: false, inShelf: true },
  { name: 'Овсяные хлопья', emoji: '🥣', keys: ['овсян'], inFridge: false, inShelf: true },
  { name: 'Хлеб', emoji: '🥖', keys: ['хлеб', 'булочк', 'круассан', 'тортил', 'лаваш', 'сухарик'], inFridge: false, inShelf: true },
  { name: 'Тесто', emoji: '🥟', keys: ['тесто'], inFridge: false, inShelf: false },
  { name: 'Нори', emoji: '🌿', keys: ['нори'], inFridge: false, inShelf: true },
  { name: 'Орехи и семечки', emoji: '🥜', keys: ['орех', 'семечк', 'кунжут', 'чиа', 'гранол'], inFridge: false, inShelf: true },
  { name: 'Соевый соус', emoji: '🥢', keys: ['соев'], inFridge: false, inShelf: true },
  { name: 'Соусы и заправки', emoji: '🥫', keys: ['соус', 'кетчуп', 'майонез', 'хумус', 'тахини', 'бальзам', 'паста том', 'том ям', 'тикка'], inFridge: false, inShelf: true },
  { name: 'Бульон', emoji: '🥫', keys: ['бульон'], inFridge: false, inShelf: true },
  { name: 'Кокосовое молоко', emoji: '🥥', keys: ['кокос'], inFridge: false, inShelf: true },
  { name: 'Вино', emoji: '🍷', keys: ['вино'], inFridge: false, inShelf: true },
  { name: 'Пиво', emoji: '🍺', keys: ['пиво'], inFridge: false, inShelf: false },
];

/** Быстрый поиск продукта по имени (в нижнем регистре) */
export const PRODUCT_BY_NAME: Map<string, FridgeProduct> = new Map(
  FRIDGE_PRODUCTS.map((p) => [p.name.toLowerCase(), p]),
);

/**
 * Базовые ингредиенты, которые presumed «всегда есть дома»:
 * соль, перец, специи, масло, вода, зелень — не участвуют в подборе рецептов.
 * ВАЖНО: проверка «болгар» идёт первой — болгарский перец это реальный продукт.
 */
export function isBaseIngredient(name: string): boolean {
  const n = name.toLowerCase();
  if (n.includes('болгар')) return false;
  return /(соль|чёрн\\S* перец|черн\\S* перец|перец, |специ|приправ|масл|вода|мускат|лавров|паприк|зира|орегано|тимьян|розмарин|кунжут|имбирь|васаби|хлопья чили|ванил|укроп|петрушк|кинза|мята|лимонн|порошок|сода)/.test(
    n,
  );
}

/** Мок-пул «что распознаёт ИИ на фото холодильника» */
export const SCAN_POOL: string[] = FRIDGE_PRODUCTS.filter((p) => p.inFridge).map((p) => p.name);

/** Подборка «пополнить запасы» на экране шкафчика */
export const SHELF_POOL: string[] = FRIDGE_PRODUCTS.filter((p) => p.inShelf).map((p) => p.name);

/** Стартовый набор запасов для новых пользователей */
export const DEFAULT_PANTRY: string[] = [
  'Мука',
  'Яйца',
  'Молоко',
  'Сахар',
  'Соль',
  'Рис',
  'Паста',
  'Лук',
  'Чеснок',
  'Морковь',
  'Помидоры',
  'Сыр',
  'Картофель',
];

export const DISHES: Dish[] = [
${dishBlocks}
];
`;

writeFileSync(PATH, staticPart, 'utf8');
console.log(`OK: ${dishes.length} блюд, ${ingCount} ингредиентов (${qtyCount} с количеством), БЖУ рассчитано`);
if (WARN.length) {
  console.log('Предупреждения:');
  for (const w of WARN) console.log('  ⚠ ' + w);
}
