/**
 * База блюд СканРецепт — v2.
 *  • ingredients — структурированные ({ name, qty, unit }) для пересчёта порций
 *  • bju — белки/жиры/углеводы на порцию (для PRO-подписки)
 *  • FRIDGE_PRODUCTS — канонические продукты: распознавание, запасы, подбор рецептов
 *  • isBaseIngredient — соль/специи/масло не учитываются при подборе «что приготовить»
 */

export type DishCategory =
  | 'breakfast'
  | 'chicken'
  | 'meat'
  | 'fish'
  | 'veg'
  | 'soups'
  | 'salads'
  | 'baking';

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
  /** Уровень доступа: free — классика (бесплатно), pro — авторская коллекция */
  tier?: 'free' | 'pro';
}

export const CATEGORY_META: Record<DishCategory, { labelRu: string; emoji: string }> = {
  breakfast: { labelRu: 'Завтраки и перекусы', emoji: '🥐' },
  chicken: { labelRu: 'Курица', emoji: '🍗' },
  meat: { labelRu: 'Мясо', emoji: '🥩' },
  fish: { labelRu: 'Рыба и морепродукты', emoji: '🐟' },
  veg: { labelRu: 'Вегетарианское', emoji: '🥗' },
  soups: { labelRu: 'Супы', emoji: '🍲' },
  salads: { labelRu: 'Салаты и закуски', emoji: '🥙' },
  baking: { labelRu: 'Выпечка и десерты', emoji: '🧁' },
};

export const CATEGORY_FILTERS: Array<{
  id: DishCategory | 'all';
  labelRu: string;
  emoji: string;
}> = [
  { id: 'all', labelRu: 'Все', emoji: '🍽️' },
  { id: 'breakfast', labelRu: 'Завтраки', emoji: '🥐' },
  { id: 'soups', labelRu: 'Супы', emoji: '🍲' },
  { id: 'salads', labelRu: 'Салаты', emoji: '🥙' },
  { id: 'chicken', labelRu: 'Курица', emoji: '🍗' },
  { id: 'meat', labelRu: 'Мясо', emoji: '🥩' },
  { id: 'fish', labelRu: 'Рыба', emoji: '🐟' },
  { id: 'veg', labelRu: 'Вег', emoji: '🥗' },
  { id: 'baking', labelRu: 'Выпечка', emoji: '🧁' },
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

/*
 * Эмодзи подобраны по правилу «первая ассоциация русского покупателя».
 * Там, где точного эмодзи не существует, взято ближайшее по смыслу — это
 * осознанные допущения, а не ошибки:
 *   Свёкла 🍠, Кабачки 🥒, Тофу 🥡, Тесто 🥟, Сахар 🍬, Сухофрукты 🍇,
 *   Фарш 🥩, Сметана 🥄, Мидии 🦪 (нет отдельных эмодзи).
 * Семейные группы: белые напитки (Молоко/Сливки/Кефир/Йогурт) — 🥛,
 * зерно и крупы (Крупы/Мука/Гречка/Киноа/Овсяные хлопья) — 🌾, листовые
 * (Капуста/Шпинат/Салат/Нори) — 🥬.
 */
export const FRIDGE_PRODUCTS: FridgeProduct[] = [
  { name: 'Яйца', emoji: '🥚', keys: ['яйц'], inFridge: true, inShelf: false },
  { name: 'Молоко', emoji: '🥛', keys: ['молок'], inFridge: true, inShelf: false },
  { name: 'Сливки', emoji: '🥛', keys: ['сливк'], inFridge: true, inShelf: false },
  { name: 'Йогурт', emoji: '🥛', keys: ['йогурт'], inFridge: true, inShelf: false },
  { name: 'Творог', emoji: '🥣', keys: ['творог'], inFridge: true, inShelf: false },
  { name: 'Сметана', emoji: '🥄', keys: ['сметан'], inFridge: true, inShelf: false },
  { name: 'Сыр', emoji: '🧀', keys: ['сыр', 'пармезан', 'моцарелла', 'чеддер', 'фета', 'сулугуни', 'чечил', 'рокфор', 'рикотта', 'маскарпоне'], inFridge: true, inShelf: false },
  { name: 'Кефир', emoji: '🥛', keys: ['кефир', 'простокваш', 'ряженк', 'айран'], inFridge: true, inShelf: true },
  { name: 'Колбаса и копчёности', emoji: '🌭', keys: ['колбас', 'сосиск', 'сардельк', 'бекон', 'карбонад', 'буженин', 'копчён'], inFridge: true, inShelf: false },
  { name: 'Ветчина', emoji: '🥓', keys: ['ветчин'], inFridge: true, inShelf: false },
  { name: 'Масло сливочное', emoji: '🧈', keys: ['сливочное масло'], inFridge: false, inShelf: false },
  { name: 'Курица', emoji: '🍗', keys: ['кури', 'грудка', 'бедр', 'крылышк'], inFridge: true, inShelf: false },
  { name: 'Фарш', emoji: '🥩', keys: ['фарш'], inFridge: true, inShelf: false },
  { name: 'Говядина', emoji: '🥩', keys: ['говядин', 'рибай', 'вырезка'], inFridge: true, inShelf: false },
  { name: 'Свинина', emoji: '🥓', keys: ['свин', 'рёбр', 'ребр', 'отбивн'], inFridge: false, inShelf: false },
  { name: 'Лосось', emoji: '🐟', keys: ['лосос'], inFridge: true, inShelf: false },
  { name: 'Креветки', emoji: '🦐', keys: ['креветк'], inFridge: true, inShelf: false },
  { name: 'Тунец', emoji: '🐟', keys: ['тунец'], inFridge: true, inShelf: true },
  { name: 'Треска', emoji: '🐟', keys: ['треск', 'минтай', 'хек', 'путассу'], inFridge: false, inShelf: false },
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
  { name: 'Баклажаны', emoji: '🍆', keys: ['баклажан'], inFridge: false, inShelf: false },
  { name: 'Кабачки', emoji: '🥒', keys: ['кабачк', 'цуккини', 'патиссон'], inFridge: false, inShelf: false },
  { name: 'Капуста', emoji: '🥬', keys: ['капуст', 'кольраби', 'брюссельск', 'цветн'], inFridge: true, inShelf: true },
  { name: 'Сельдь', emoji: '🐟', keys: ['сельд', 'селёдк', 'иваси'], inFridge: false, inShelf: false },
  { name: 'Скумбрия', emoji: '🐟', keys: ['скумбри', 'макрель'], inFridge: false, inShelf: false },
  { name: 'Форель', emoji: '🐟', keys: ['форель', 'горбуш', 'кета', 'радужн', 'сёмг', 'семг'], inFridge: false, inShelf: false },
  { name: 'Баранина', emoji: '🥩', keys: ['баран', 'ягнят', 'люля'], inFridge: false, inShelf: false },
  { name: 'Крабовые палочки', emoji: '🦀', keys: ['крабов'], inFridge: true, inShelf: false },
  { name: 'Кукуруза', emoji: '🌽', keys: ['кукуруз'], inFridge: false, inShelf: true },
  { name: 'Зелёный горошек', emoji: '🫛', keys: ['горошек', 'горошк'], inFridge: false, inShelf: true },
  { name: 'Чечевица', emoji: '🫘', keys: ['чечевиц'], inFridge: false, inShelf: true },
  { name: 'Крупы', emoji: '🌾', keys: ['перлов', 'пшено', 'булгур', 'ячнев', 'манка', 'манной', 'горох', 'нут', 'кускус'], inFridge: false, inShelf: true },
  { name: 'Брокколи', emoji: '🥦', keys: ['брокколи', 'спаржа'], inFridge: true, inShelf: false },
  { name: 'Шпинат', emoji: '🥬', keys: ['шпинат'], inFridge: true, inShelf: false },
  { name: 'Салат', emoji: '🥬', keys: ['салат', 'латук'], inFridge: true, inShelf: false },
  { name: 'Зелень', emoji: '🌿', keys: ['базилик', 'зелень'], inFridge: true, inShelf: false },
  { name: 'Авокадо', emoji: '🥑', keys: ['авокадо'], inFridge: true, inShelf: false },
  { name: 'Лимон', emoji: '🍋', keys: ['лимон', 'лайм'], inFridge: true, inShelf: false },
  { name: 'Яблоко', emoji: '🍎', keys: ['яблок'], inFridge: true, inShelf: true },
  { name: 'Банан', emoji: '🍌', keys: ['банан'], inFridge: true, inShelf: true },
  { name: 'Ягоды', emoji: '🫐', keys: ['ягод', 'черник', 'малин', 'клубник', 'смородин', 'вишн', 'брусник', 'клюкв'], inFridge: true, inShelf: false },
  { name: 'Ананас', emoji: '🍍', keys: ['ананас'], inFridge: false, inShelf: false },
  { name: 'Оливки и маслины', emoji: '🫒', keys: ['оливк', 'маслин', 'каперс'], inFridge: false, inShelf: true },
  { name: 'Мёд', emoji: '🍯', keys: ['мёд', 'мед'], inFridge: false, inShelf: true },
  { name: 'Мука', emoji: '🌾', keys: ['мука', 'муки', 'крахмал'], inFridge: false, inShelf: true },
  { name: 'Сахар', emoji: '🍬', keys: ['сахар'], inFridge: false, inShelf: true },
  { name: 'Соль', emoji: '🧂', keys: ['соль'], inFridge: false, inShelf: true },
  { name: 'Рис', emoji: '🍚', keys: ['рис'], inFridge: false, inShelf: true },
  { name: 'Гречка', emoji: '🌾', keys: ['гречк'], inFridge: false, inShelf: true },
  { name: 'Киноа', emoji: '🌾', keys: ['киноа'], inFridge: false, inShelf: true },
  { name: 'Паста', emoji: '🍝', keys: ['паста', 'спагетти', 'лапша', 'макарон'], inFridge: false, inShelf: true },
  { name: 'Овсяные хлопья', emoji: '🌾', keys: ['овсян'], inFridge: false, inShelf: true },
  { name: 'Хлеб', emoji: '🥖', keys: ['хлеб', 'булочк', 'круассан', 'тортил', 'лаваш', 'сухар', 'багет', 'чиабатт'], inFridge: false, inShelf: true },
  { name: 'Печенье', emoji: '🍪', keys: ['печенье', 'бисквит', 'песочн'], inFridge: false, inShelf: true },
  { name: 'Сухофрукты', emoji: '🍇', keys: ['изюм', 'курага', 'чернослив', 'цукат', 'финик', 'инжир суш'], inFridge: false, inShelf: true },
  { name: 'Шоколад и какао', emoji: '🍫', keys: ['шоколад', 'какао', 'ганаш', 'нутелла', 'нутэлла'], inFridge: false, inShelf: true },
  { name: 'Тесто', emoji: '🥟', keys: ['тесто'], inFridge: false, inShelf: false },
  { name: 'Нори', emoji: '🥬', keys: ['нори'], inFridge: false, inShelf: true },
  { name: 'Орехи и семечки', emoji: '🥜', keys: ['орех', 'семечк', 'кунжут', 'чиа', 'гранол'], inFridge: false, inShelf: true },
  { name: 'Соевый соус', emoji: '🍶', keys: ['соев'], inFridge: false, inShelf: true },
  { name: 'Соусы и заправки', emoji: '🥫', keys: ['соус', 'кетчуп', 'майонез', 'хумус', 'тахини', 'бальзам', 'паста том', 'том ям', 'тикка', 'горчиц', 'хрен', 'аджик', 'сироп'], inFridge: false, inShelf: true },
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
  return /(соль|чёрн\S* перец|черн\S* перец|перец, |специ|приправ|масл|вода|мускат|лавров|паприк|зира|орегано|тимьян|розмарин|кунжут|имбирь|васаби|хлопья чили|ванил|укроп|петрушк|кинза|мята|лимонн|порошок|сода|разрыхл|дрожж|уксус|бальзам|кориц|куркум|кориандр|сунели|гвоздик|шафран|прованск|итальянск трав)/.test(
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

import { DISHES_MORE } from './dishes-more';

const ALL_DISHES: Dish[] = [
  {
    id: 'cottage-cheese-pancakes',
    nameEn: 'Cottage cheese pancakes with berries',
    nameRu: 'Домашние сырники с ягодами',
    category: 'breakfast',
    kcal: 380,
    bju: { p: 16, f: 13, c: 50 },
    image: '/dishes/cottage-cheese-pancakes.jpg',
    ingredients: [
      { name: 'Творог 9%', qty: 400, unit: 'г' },
      { name: 'Яйцо', qty: 1, unit: 'шт' },
      { name: 'Мука', qty: 3, unit: 'ст. л.' },
      { name: 'Сахар', qty: 2, unit: 'ст. л.' },
      { name: 'Сметана', qty: 2, unit: 'ст. л.' },
      { name: 'Свежие ягоды', note: 'горсть' },
    ],
    steps: [
      'Смешай творог, яйцо, сахар и муку до однородного теста.',
      'Сформируй небольшие сырники и обваляй в муке.',
      'Обжарь по 2–3 минуты с каждой стороны на среднем огне.',
      'Подавай со сметаной и свежими ягодами.',
    ],
  },
  {
    id: 'shakshuka',
    nameEn: 'Shakshuka with eggs and feta',
    nameRu: 'Шакшука с фетой',
    category: 'breakfast',
    kcal: 350,
    bju: { p: 16, f: 13, c: 42 },
    image: '/dishes/shakshuka.jpg',
    ingredients: [
      { name: 'Яйца', qty: 3, unit: 'шт' },
      { name: 'Томаты в собственном соку', qty: 400, unit: 'г' },
      { name: 'Болгарский перец', qty: 1, unit: 'шт' },
      { name: 'Лук', qty: 1, unit: 'шт' },
      { name: 'Фета', qty: 80, unit: 'г' },
      { name: 'Зира и паприка', qty: 0.5, unit: 'ч. л.' },
    ],
    steps: [
      'Обжарь лук и перец до мягкости.',
      'Добавь томаты и специи, туши 10 минут.',
      'Сделай лунки в соусе, влей яйца, накрой крышкой на 5–7 минут.',
      'Посыпь фетой и зеленью, подавай с хлебом.',
    ],
  },
  {
    id: 'avocado-toast',
    nameEn: 'Avocado toast with poached egg',
    nameRu: 'Тост с авокадо и яйцом пашот',
    category: 'breakfast',
    kcal: 320,
    bju: { p: 15, f: 12, c: 38 },
    image: '/dishes/avocado-toast.jpg',
    ingredients: [
      { name: 'Хлеб цельнозерновой', qty: 2, unit: 'ломтика' },
      { name: 'Авокадо', qty: 1, unit: 'шт' },
      { name: 'Яйца', qty: 2, unit: 'шт' },
      { name: 'Лимонный сок', qty: 1, unit: 'ч. л.' },
      { name: 'Соль, перец, хлопья чили' },
    ],
    steps: [
      'Подрумянь хлеб в тостере или на сухой сковороде.',
      'Разомни авокадо с лимонным соком и солью.',
      'Свари яйцо пашот 3 минуты в воде с уксусом.',
      'Собери тост и посыпь перцем и хлопьями чили.',
    ],
  },
  {
    id: 'oatmeal-bowl',
    nameEn: 'Oatmeal bowl with fresh fruits and nuts',
    nameRu: 'Овсяная каша с фруктами и орехами',
    category: 'breakfast',
    kcal: 340,
    bju: { p: 15, f: 12, c: 43 },
    image: '/dishes/oatmeal-bowl.jpg',
    ingredients: [
      { name: 'Овсяные хлопья', qty: 60, unit: 'г' },
      { name: 'Молоко или вода', qty: 250, unit: 'мл' },
      { name: 'Банан', qty: 1, unit: 'шт' },
      { name: 'Яблоко', qty: 1, unit: 'шт' },
      { name: 'Грецкие орехи', qty: 20, unit: 'г' },
      { name: 'Мёд', qty: 1, unit: 'ч. л.' },
    ],
    steps: [
      'Свари овсянку на молоке 5–7 минут, помешивая.',
      'Нарежь фрукты кусочками.',
      'Выложи кашу в боул, укрась фруктами и орехами.',
      'Полей мёдом и подавай сразу.',
    ],
  },
  {
    id: 'cheese-ham-omelette',
    nameEn: 'Cheese and ham omelette',
    nameRu: 'Омлет с сыром и ветчиной',
    category: 'breakfast',
    kcal: 400,
    bju: { p: 19, f: 15, c: 47 },
    image: '/dishes/cheese-ham-omelette.jpg',
    ingredients: [
      { name: 'Яйца', qty: 3, unit: 'шт' },
      { name: 'Молоко', qty: 50, unit: 'мл' },
      { name: 'Ветчина', qty: 60, unit: 'г' },
      { name: 'Сыр твёрдый', qty: 40, unit: 'г' },
      { name: 'Зелень, соль, перец' },
    ],
    steps: [
      'Взбей яйца с молоком и солью.',
      'Обжарь кубики ветчины на сковороде.',
      'Влей яичную смесь, готовь под крышкой 4–5 минут.',
      'Посыпь сыром и зеленью, сложи пополам.',
    ],
  },
  {
    id: 'tuna-sandwich',
    nameEn: 'Tuna salad sandwich on whole wheat bread',
    nameRu: 'Сэндвич с тунцом на зерновом хлебе',
    category: 'breakfast',
    kcal: 380,
    bju: { p: 17, f: 14, c: 47 },
    image: '/dishes/tuna-sandwich.jpg',
    ingredients: [
      { name: 'Хлеб зерновой', qty: 2, unit: 'ломтика' },
      { name: 'Тунец в собственном соку', qty: 1, unit: 'банка' },
      { name: 'Йогурт греческий', qty: 2, unit: 'ст. л.' },
      { name: 'Огурец', qty: 0.5, unit: 'шт' },
      { name: 'Листья салата' },
      { name: 'Соль, перец' },
    ],
    steps: [
      'Слей жидкость с тунца и разомни вилкой.',
      'Смешай тунец с йогуртом, солью и перцем.',
      'Выложи на хлеб с огурцом и салатом.',
      'Накрой вторым ломтиком и разрежь по диагонали.',
    ],
  },
  {
    id: 'greek-yogurt-granola',
    nameEn: 'Greek yogurt with honey and granola',
    nameRu: 'Греческий йогурт с гранолой и мёдом',
    category: 'breakfast',
    kcal: 290,
    bju: { p: 13, f: 11, c: 35 },
    image: '/dishes/greek-yogurt-granola.jpg',
    ingredients: [
      { name: 'Йогурт греческий', qty: 200, unit: 'г' },
      { name: 'Гранола', qty: 40, unit: 'г' },
      { name: 'Мёд', qty: 1, unit: 'ст. л.' },
      { name: 'Ягоды', note: 'горсть' },
      { name: 'Мята для украшения' },
    ],
    steps: [
      'Выложи йогурт в креманку.',
      'Добавь слой гранолы.',
      'Полей мёдом и добавь ягоды.',
      'Укрась мятой и подавай.',
    ],
  },
  {
    id: 'spinach-cheese-pancake',
    nameEn: 'Cheese pancakes with spinach',
    nameRu: 'Сырный блин со шпинатом',
    category: 'breakfast',
    kcal: 330,
    bju: { p: 16, f: 12, c: 40 },
    image: '/dishes/spinach-cheese-pancake.jpg',
    ingredients: [
      { name: 'Сыр твёрдый', qty: 60, unit: 'г' },
      { name: 'Шпинат', qty: 100, unit: 'г' },
      { name: 'Яйца', qty: 2, unit: 'шт' },
      { name: 'Мука', qty: 2, unit: 'ст. л.' },
      { name: 'Молоко', qty: 100, unit: 'мл' },
      { name: 'Соль, мускатный орех' },
    ],
    steps: [
      'Взбей яйца с молоком и мукой до гладкого теста.',
      'Обжарь шпинат 1–2 минуты и вмешай в тесто.',
      'Добавь тёртый сыр и специи.',
      'Выпекай тонкие блины по 1–2 минуты с каждой стороны.',
    ],
  },
  {
    id: 'croissant-salmon',
    nameEn: 'Croissant with salted salmon and cream cheese',
    nameRu: 'Круассан с лососем и творожным сыром',
    category: 'breakfast',
    kcal: 420,
    bju: { p: 19, f: 15, c: 52 },
    image: '/dishes/croissant-salmon.jpg',
    ingredients: [
      { name: 'Круассан', qty: 1, unit: 'шт' },
      { name: 'Слабосолёный лосось', qty: 60, unit: 'г' },
      { name: 'Творожный сыр', qty: 30, unit: 'г' },
      { name: 'Огурец', qty: 3, unit: 'ломтика' },
      { name: 'Укроп, долька лимона' },
    ],
    steps: [
      'Разрежь круассан вдоль, не до конца.',
      'Намажь творожным сыром обе половины.',
      'Выложи лосось, огурец и укроп.',
      'Сбрызни лимоном и подавай.',
    ],
  },
  {
    id: 'smoothie-bowl',
    nameEn: 'Smoothie bowl with chia seeds',
    nameRu: 'Смузи-боул с семенами чиа',
    category: 'breakfast',
    kcal: 280,
    bju: { p: 12, f: 9, c: 38 },
    image: '/dishes/smoothie-bowl.jpg',
    ingredients: [
      { name: 'Замороженные ягоды', qty: 150, unit: 'г' },
      { name: 'Банан', qty: 1, unit: 'шт' },
      { name: 'Йогурт', qty: 100, unit: 'г' },
      { name: 'Семена чиа', qty: 1, unit: 'ст. л.' },
      { name: 'Овсяные хлопья', qty: 1, unit: 'ст. л.' },
    ],
    steps: [
      'Пробей ягоды, банан и йогурт в блендере до густого смузи.',
      'Дай семенам чиа набухнуть в смузи 5 минут.',
      'Перелей смузи в боул.',
      'Укрась чиа, хлопьями и ягодами.',
    ],
  },
  {
    id: 'chicken-teriyaki',
    nameEn: 'Chicken Teriyaki with rice and sesame',
    nameRu: 'Курица Терияки с рисом и кунжутом',
    category: 'chicken',
    kcal: 520,
    bju: { p: 50, f: 19, c: 37 },
    image: '/dishes/chicken-teriyaki.jpg',
    ingredients: [
      { name: 'Куриное бедро', qty: 400, unit: 'г' },
      { name: 'Соевый соус', qty: 4, unit: 'ст. л.' },
      { name: 'Мёд', qty: 2, unit: 'ст. л.' },
      { name: 'Рис', qty: 150, unit: 'г' },
      { name: 'Кунжут', qty: 1, unit: 'ч. л.' },
      { name: 'Чеснок', qty: 2, unit: 'зубчика' },
    ],
    steps: [
      'Отвари рис до готовности.',
      'Обжарь курицу до золотистой корочки.',
      'Влей соевый соус с мёдом и чесноком, туши 5 минут до глазури.',
      'Подавай на рисе, посыпь кунжутом.',
    ],
  },
  {
    id: 'caesar-salad',
    nameEn: 'Caesar salad with grilled chicken breast',
    nameRu: 'Салат Цезарь с курицей гриль',
    category: 'chicken',
    kcal: 450,
    bju: { p: 47, f: 18, c: 25 },
    image: '/dishes/caesar-salad.jpg',
    ingredients: [
      { name: 'Куриная грудка', qty: 200, unit: 'г' },
      { name: 'Салат романо', qty: 1, unit: 'пучок' },
      { name: 'Пармезан', qty: 30, unit: 'г' },
      { name: 'Сухарики', note: 'горсть' },
      { name: 'Соус цезарь', qty: 3, unit: 'ст. л.' },
    ],
    steps: [
      'Обжарь грудку гриль по 4–5 минут с каждой стороны.',
      'Нарви романо и выложи в миску.',
      'Добавь соус и перемешай.',
      'Сверху — ломтики курицы, пармезан и сухарики.',
    ],
  },
  {
    id: 'sweet-sour-chicken',
    nameEn: 'Sweet and sour chicken with bell peppers',
    nameRu: 'Курица в кисло-сладком соусе с перцем',
    category: 'chicken',
    kcal: 540,
    bju: { p: 54, f: 21, c: 34 },
    image: '/dishes/sweet-sour-chicken.jpg',
    ingredients: [
      { name: 'Куриная грудка', qty: 400, unit: 'г' },
      { name: 'Болгарский перец', qty: 2, unit: 'шт' },
      { name: 'Ананас', qty: 150, unit: 'г' },
      { name: 'Кетчуп', qty: 3, unit: 'ст. л.' },
      { name: 'Соевый соус', qty: 2, unit: 'ст. л.' },
      { name: 'Крахмал', qty: 1, unit: 'ст. л.' },
    ],
    steps: [
      'Нарежь курицу кубиками и обваляй в крахмале.',
      'Обжарь до румяной корочки.',
      'Добавь перец и ананас, жарь 3 минуты.',
      'Влей смесь кетчупа и соевого соуса, туши до загустения.',
    ],
  },
  {
    id: 'chicken-mushroom-pasta',
    nameEn: 'Creamy mushroom and chicken pasta',
    nameRu: 'Паста с курицей и грибами в сливках',
    category: 'chicken',
    kcal: 610,
    bju: { p: 62, f: 24, c: 37 },
    image: '/dishes/chicken-mushroom-pasta.jpg',
    ingredients: [
      { name: 'Паста', qty: 120, unit: 'г' },
      { name: 'Куриная грудка', qty: 200, unit: 'г' },
      { name: 'Шампиньоны', qty: 200, unit: 'г' },
      { name: 'Сливки 20%', qty: 150, unit: 'мл' },
      { name: 'Пармезан', qty: 20, unit: 'г' },
      { name: 'Чеснок', qty: 1, unit: 'зубчик' },
    ],
    steps: [
      'Отвари пасту до аль денте.',
      'Обжарь курицу кубиками, добавь грибы и чеснок.',
      'Влей сливки, туши 3–4 минуты.',
      'Смешай с пастой и посыпь пармезаном.',
    ],
  },
  {
    id: 'bbq-chicken-wings',
    nameEn: 'Baked chicken wings with BBQ sauce',
    nameRu: 'Запечённые куриные крылышки BBQ',
    category: 'chicken',
    kcal: 560,
    bju: { p: 58, f: 23, c: 30 },
    image: '/dishes/bbq-chicken-wings.jpg',
    ingredients: [
      { name: 'Крылышки', qty: 600, unit: 'г' },
      { name: 'Соус BBQ', qty: 5, unit: 'ст. л.' },
      { name: 'Паприка', qty: 1, unit: 'ч. л.' },
      { name: 'Чесночный порошок', qty: 1, unit: 'ч. л.' },
      { name: 'Масло', qty: 1, unit: 'ст. л.' },
    ],
    steps: [
      'Замаринуй крылышки в специях и масле на 20 минут.',
      'Запекай при 200°C 25 минут.',
      'Обмажь соусом BBQ.',
      'Верни в духовку ещё на 10 минут до глазури.',
    ],
  },
  {
    id: 'chicken-noodle-soup',
    nameEn: 'Chicken noodle soup',
    nameRu: 'Куриный суп с лапшой',
    category: 'chicken',
    kcal: 350,
    bju: { p: 33, f: 13, c: 25 },
    image: '/dishes/chicken-noodle-soup.jpg',
    ingredients: [
      { name: 'Куриные бёдра', qty: 300, unit: 'г' },
      { name: 'Лапша', qty: 80, unit: 'г' },
      { name: 'Морковь', qty: 1, unit: 'шт' },
      { name: 'Лук', qty: 1, unit: 'шт' },
      { name: 'Лавровый лист, зелень' },
    ],
    steps: [
      'Свари бульон из курицы 30 минут, снимая пену.',
      'Добавь морковь и лук, вари 10 минут.',
      'Всыпь лапшу, готовь 5–7 минут.',
      'Добавь зелень и подавай.',
    ],
  },
  {
    id: 'grilled-chicken-broccoli',
    nameEn: 'Grilled chicken breast with steamed broccoli',
    nameRu: 'Куриная грудка гриль с брокколи',
    category: 'chicken',
    kcal: 320,
    bju: { p: 33, f: 13, c: 18 },
    image: '/dishes/grilled-chicken-broccoli.jpg',
    ingredients: [
      { name: 'Куриная грудка', qty: 250, unit: 'г' },
      { name: 'Брокколи', qty: 200, unit: 'г' },
      { name: 'Оливковое масло', qty: 1, unit: 'ст. л.' },
      { name: 'Паприка, соль, перец' },
      { name: 'Лимон', qty: 0.5, unit: 'шт' },
    ],
    steps: [
      'Замаринуй грудку в масле и специях на 15 минут.',
      'Обжарь на гриль-сковороде по 5 минут с каждой стороны.',
      'Брокколи готовь на пару 5 минут.',
      'Подавай с долькой лимона.',
    ],
  },
  {
    id: 'chicken-tikka-masala',
    nameEn: 'Chicken Tikka Masala with rice',
    nameRu: 'Курица Тикка Масала с рисом',
    category: 'chicken',
    kcal: 580,
    bju: { p: 61, f: 24, c: 30 },
    image: '/dishes/chicken-tikka-masala.jpg',
    ingredients: [
      { name: 'Куриные бёдра', qty: 400, unit: 'г' },
      { name: 'Томаты', qty: 300, unit: 'г' },
      { name: 'Сливки', qty: 100, unit: 'мл' },
      { name: 'Паста тикка масала', qty: 2, unit: 'ст. л.' },
      { name: 'Рис басмати', qty: 150, unit: 'г' },
      { name: 'Имбирь, чеснок' },
    ],
    steps: [
      'Замаринуй курицу в пасте тикка на 30 минут.',
      'Обжарь до румяности.',
      'Добавь томаты и туши 15 минут.',
      'Влей сливки и подавай с рисом басмати.',
    ],
  },
  {
    id: 'chicken-fajitas',
    nameEn: 'Chicken fajitas with tortillas',
    nameRu: 'Куриный фахитас с тортильями',
    category: 'chicken',
    kcal: 510,
    bju: { p: 51, f: 20, c: 32 },
    image: '/dishes/chicken-fajitas.jpg',
    ingredients: [
      { name: 'Куриная грудка', qty: 300, unit: 'г' },
      { name: 'Тортильи', qty: 4, unit: 'шт' },
      { name: 'Болгарский перец', qty: 2, unit: 'шт' },
      { name: 'Лук', qty: 1, unit: 'шт' },
      { name: 'Специи фахита', qty: 1, unit: 'ст. л.' },
      { name: 'Лайм, сметана' },
    ],
    steps: [
      'Нарежь курицу полосками и замаринуй в специях с лаймом.',
      'Обжарь на сильном огне 5–7 минут.',
      'Добавь перец и лук, жарь ещё 3–4 минуты.',
      'Заверни в тортильи со сметаной.',
    ],
  },
  {
    id: 'chicken-stir-fry',
    nameEn: 'Chicken and vegetable stir fry',
    nameRu: 'Курица вок с овощами',
    category: 'chicken',
    kcal: 470,
    bju: { p: 49, f: 19, c: 26 },
    image: '/dishes/chicken-stir-fry.jpg',
    ingredients: [
      { name: 'Куриная грудка', qty: 300, unit: 'г' },
      { name: 'Овощная смесь вок', qty: 400, unit: 'г' },
      { name: 'Соевый соус', qty: 3, unit: 'ст. л.' },
      { name: 'Кунжутное масло', qty: 1, unit: 'ч. л.' },
      { name: 'Имбирь', qty: 20, unit: 'г' },
      { name: 'Чеснок', qty: 2, unit: 'зубчика' },
    ],
    steps: [
      'Раскали вок с маслом.',
      'Обжарь курицу полосками 4–5 минут.',
      'Добавь овощи, имбирь и чеснок, жарь 3 минуты, помешивая.',
      'Влей соевый соус и прогрей 1 минуту.',
    ],
  },
  {
    id: 'pasta-carbonara',
    nameEn: 'Pasta Carbonara with crispy bacon',
    nameRu: 'Паста Карбонара с хрустящим беконом',
    category: 'meat',
    kcal: 650,
    bju: { p: 59, f: 28, c: 41 },
    image: '/dishes/pasta-carbonara.jpg',
    ingredients: [
      { name: 'Спагетти', qty: 120, unit: 'г' },
      { name: 'Бекон', qty: 100, unit: 'г' },
      { name: 'Яичные желтки', qty: 2, unit: 'шт' },
      { name: 'Пармезан', qty: 40, unit: 'г' },
      { name: 'Чёрный перец, чеснок' },
    ],
    steps: [
      'Отвари спагетти до аль денте.',
      'Обжарь бекон до хрустящей корочки.',
      'Взбей желтки с тёртым пармезаном и перцем.',
      'Смешай горячую пасту с беконом и соусом — желтки дойдут от температуры.',
    ],
  },
  {
    id: 'beef-steak',
    nameEn: 'Juicy beef steak with rosemary and garlic',
    nameRu: 'Стейк из говядины с розмарином',
    category: 'meat',
    kcal: 680,
    bju: { p: 62, f: 29, c: 43 },
    image: '/dishes/beef-steak.jpg',
    ingredients: [
      { name: 'Стейк рибай', qty: 300, unit: 'г' },
      { name: 'Розмарин', qty: 2, unit: 'веточки' },
      { name: 'Чеснок', qty: 3, unit: 'зубчика' },
      { name: 'Сливочное масло', qty: 30, unit: 'г' },
      { name: 'Соль крупная, перец' },
    ],
    steps: [
      'Дай стейку согреться до комнатной температуры 30 минут.',
      'Жарь на раскалённой сковороде по 2–3 минуты с каждой стороны.',
      'Добавь масло, розмарин и чеснок, поливай стейк ароматным маслом.',
      'Дай отдохнуть 5 минут под фольгой.',
    ],
  },
  {
    id: 'soba-beef',
    nameEn: 'Soba noodles with beef and vegetables',
    nameRu: 'Лапша соба с говядиной и овощами',
    category: 'meat',
    kcal: 520,
    bju: { p: 50, f: 23, c: 28 },
    image: '/dishes/soba-beef.jpg',
    ingredients: [
      { name: 'Лапша соба', qty: 100, unit: 'г' },
      { name: 'Говядина', qty: 200, unit: 'г' },
      { name: 'Болгарский перец', qty: 1, unit: 'шт' },
      { name: 'Морковь', qty: 1, unit: 'шт' },
      { name: 'Соевый соус', qty: 3, unit: 'ст. л.' },
      { name: 'Кунжут' },
    ],
    steps: [
      'Отвари собу 4 минуты и промой холодной водой.',
      'Обжарь тонкие ломтики говядины на сильном огне.',
      'Добавь овощи, жарь 3 минуты.',
      'Смешай с собой и соевым соусом, посыпь кунжутом.',
    ],
  },
  {
    id: 'beef-burger',
    nameEn: 'Classic beef burger with melted cheese',
    nameRu: 'Классический бургер с говядиной',
    category: 'meat',
    kcal: 750,
    bju: { p: 76, f: 36, c: 31 },
    image: '/dishes/beef-burger.jpg',
    ingredients: [
      { name: 'Булочка бриошь', qty: 1, unit: 'шт' },
      { name: 'Котлета из говядины', qty: 150, unit: 'г' },
      { name: 'Чеддер', qty: 2, unit: 'ломтика' },
      { name: 'Помидор, маринованный огурец' },
      { name: 'Бургерный соус, салат' },
    ],
    steps: [
      'Сформируй котлету и посоли снаружи.',
      'Жарь по 3–4 минуты с каждой стороны, в конце накрой сыром.',
      'Подрумянь булочку на сковороде.',
      'Собери бургер с соусом и овощами.',
    ],
  },
  {
    id: 'spaghetti-bolognese',
    nameEn: 'Spaghetti Bolognese with parmesan',
    nameRu: 'Спагетти Болоньезе с пармезаном',
    category: 'meat',
    kcal: 640,
    bju: { p: 59, f: 27, c: 40 },
    image: '/dishes/spaghetti-bolognese.jpg',
    ingredients: [
      { name: 'Спагетти', qty: 120, unit: 'г' },
      { name: 'Фарш говяжий', qty: 250, unit: 'г' },
      { name: 'Томаты в соку', qty: 400, unit: 'г' },
      { name: 'Лук, морковь, сельдерей', qty: 1, unit: 'шт' },
      { name: 'Пармезан', qty: 30, unit: 'г' },
      { name: 'Базилик' },
    ],
    steps: [
      'Обжарь мелко нарезанные овощи 5 минут.',
      'Добавь фарш, разбивай комочки, жарь 7 минут.',
      'Влей томаты и туши соус 20–30 минут.',
      'Смешай со спагетти и посыпь пармезаном.',
    ],
  },
  {
    id: 'bbq-pork-ribs',
    nameEn: 'Pork ribs with BBQ glaze',
    nameRu: 'Свиные рёбрышки барбекю',
    category: 'meat',
    kcal: 820,
    bju: { p: 77, f: 36, c: 47 },
    image: '/dishes/bbq-pork-ribs.jpg',
    ingredients: [
      { name: 'Свиные рёбра', qty: 800, unit: 'г' },
      { name: 'Соус BBQ', qty: 6, unit: 'ст. л.' },
      { name: 'Паприка копчёная', qty: 1, unit: 'ст. л.' },
      { name: 'Чесночный порошок', qty: 1, unit: 'ч. л.' },
      { name: 'Мёд', qty: 1, unit: 'ст. л.' },
    ],
    steps: [
      'Натри рёбра специями и заверни в фольгу.',
      'Запекай при 160°C 2 часа.',
      'Разверни и обмажь BBQ-соусом.',
      'Верни в духовку на 200°C на 15 минут до глазури.',
    ],
  },
  {
    id: 'beef-stroganoff',
    nameEn: 'Beef Stroganoff with mashed potatoes',
    nameRu: 'Бефстроганов с картофельным пюре',
    category: 'meat',
    kcal: 620,
    bju: { p: 57, f: 26, c: 40 },
    image: '/dishes/beef-stroganoff.jpg',
    ingredients: [
      { name: 'Говяжья вырезка', qty: 300, unit: 'г' },
      { name: 'Шампиньоны', qty: 200, unit: 'г' },
      { name: 'Лук', qty: 1, unit: 'шт' },
      { name: 'Сметана', qty: 3, unit: 'ст. л.' },
      { name: 'Картофель', qty: 500, unit: 'г' },
      { name: 'Молоко, масло' },
    ],
    steps: [
      'Отвари картофель и сделай пюре с молоком.',
      'Обжарь полоски говядины на сильном огне 3 минуты.',
      'Добавь лук и грибы, жарь до мягкости.',
      'Влей сметану, туши 5 минут и подавай с пюре.',
    ],
  },
  {
    id: 'pork-chops',
    nameEn: 'Pork chops with roasted potatoes',
    nameRu: 'Свиная отбивная с запечённым картофелем',
    category: 'meat',
    kcal: 700,
    bju: { p: 64, f: 30, c: 44 },
    image: '/dishes/pork-chops.jpg',
    ingredients: [
      { name: 'Свиные отбивные', qty: 2, unit: 'шт' },
      { name: 'Картофель', qty: 400, unit: 'г' },
      { name: 'Розмарин', qty: 2, unit: 'веточки' },
      { name: 'Оливковое масло', qty: 2, unit: 'ст. л.' },
      { name: 'Чеснок', qty: 3, unit: 'зубчика' },
    ],
    steps: [
      'Отбей отбивные, посоли и поперчи.',
      'Картофель нарежь дольками и запекай с розмарином 35 минут при 200°C.',
      'Жарь отбивные по 4 минуты с каждой стороны.',
      'Дай отдохнуть 3 минуты и подавай с картофелем.',
    ],
  },
  {
    id: 'meatballs-tomato',
    nameEn: 'Meatballs in tomato sauce',
    nameRu: 'Мясные тефтели в томатном соусе',
    category: 'meat',
    kcal: 540,
    bju: { p: 50, f: 23, c: 33 },
    image: '/dishes/meatballs-tomato.jpg',
    ingredients: [
      { name: 'Фарш смешанный', qty: 400, unit: 'г' },
      { name: 'Рис', qty: 60, unit: 'г' },
      { name: 'Лук', qty: 1, unit: 'шт' },
      { name: 'Томаты в соку', qty: 400, unit: 'г' },
      { name: 'Сметана', qty: 2, unit: 'ст. л.' },
      { name: 'Лавровый лист' },
    ],
    steps: [
      'Смешай фарш с полуготовым рисом и луком.',
      'Сформируй тефтели.',
      'Слегка обжарь и залей томатным соусом.',
      'Туши 25 минут под крышкой на медленном огне.',
    ],
  },
  {
    id: 'beef-tacos',
    nameEn: 'Beef tacos with fresh salsa',
    nameRu: 'Тако с говядиной и сальсой',
    category: 'meat',
    kcal: 560,
    bju: { p: 51, f: 24, c: 35 },
    image: '/dishes/beef-tacos.jpg',
    ingredients: [
      { name: 'Кукурузные тортильи', qty: 6, unit: 'шт' },
      { name: 'Говяжий фарш', qty: 300, unit: 'г' },
      { name: 'Помидоры', qty: 2, unit: 'шт' },
      { name: 'Лук красный', qty: 0.5, unit: 'шт' },
      { name: 'Кинза, лайм' },
      { name: 'Специи тако' },
    ],
    steps: [
      'Обжарь фарш со специями тако 7–8 минут.',
      'Сделай сальсу: помидоры, лук, кинза и сок лайма.',
      'Прогрей тортильи на сухой сковороде.',
      'Собери тако: фарш, сальса и долька лайма.',
    ],
  },
  {
    id: 'baked-salmon-quinoa',
    nameEn: 'Baked salmon with quinoa and lemon',
    nameRu: 'Запечённый лосось с киноа и лимоном',
    category: 'fish',
    kcal: 520,
    bju: { p: 53, f: 18, c: 37 },
    image: '/dishes/baked-salmon-quinoa.jpg',
    ingredients: [
      { name: 'Филе лосося', qty: 250, unit: 'г' },
      { name: 'Киноа', qty: 100, unit: 'г' },
      { name: 'Лимон', qty: 0.5, unit: 'шт' },
      { name: 'Оливковое масло', qty: 1, unit: 'ст. л.' },
      { name: 'Чеснок, укроп' },
      { name: 'Спаржа', qty: 100, unit: 'г' },
    ],
    steps: [
      'Отвари киноа 15 минут.',
      'Филе сбрызни маслом и лимоном, посыпь чесноком.',
      'Запекай лосося при 200°C 12–15 минут.',
      'Подавай с киноа и спаржей.',
    ],
  },
  {
    id: 'baked-dorado',
    nameEn: 'Baked Dorado fish with herbs and lemon',
    nameRu: 'Запечённая дорадо с травами',
    category: 'fish',
    kcal: 380,
    bju: { p: 40, f: 13, c: 26 },
    image: '/dishes/baked-dorado.jpg',
    ingredients: [
      { name: 'Дорадо', qty: 1, unit: 'шт', note: '400 г' },
      { name: 'Лимон', qty: 1, unit: 'шт' },
      { name: 'Тимьян и розмарин', qty: 2, unit: 'веточки' },
      { name: 'Оливковое масло', qty: 1, unit: 'ст. л.' },
      { name: 'Соль крупная' },
    ],
    steps: [
      'Почисти рыбу и сделай надрезы на коже.',
      'Нафаршируй лимоном и травами.',
      'Сбрызни маслом и запекай при 200°C 20–25 минут.',
      'Подавай целиком с запечённым лимоном.',
    ],
  },
  {
    id: 'shrimp-pasta',
    nameEn: 'Shrimp pasta in garlic butter sauce',
    nameRu: 'Паста с креветками в чесночном соусе',
    category: 'fish',
    kcal: 640,
    bju: { p: 64, f: 21, c: 49 },
    image: '/dishes/shrimp-pasta.jpg',
    ingredients: [
      { name: 'Паста', qty: 120, unit: 'г' },
      { name: 'Креветки', qty: 200, unit: 'г' },
      { name: 'Сливочное масло', qty: 40, unit: 'г' },
      { name: 'Чеснок', qty: 3, unit: 'зубчика' },
      { name: 'Сливки', qty: 100, unit: 'мл' },
      { name: 'Петрушка, лимон' },
    ],
    steps: [
      'Отвари пасту до аль денте.',
      'Растопи масло и обжарь чеснок 1 минуту.',
      'Добавь креветки, жарь по 2 минуты с каждой стороны.',
      'Влей сливки, смешай с пастой и петрушкой.',
    ],
  },
  {
    id: 'sushi-set',
    nameEn: 'Sushi rolls set on a dark slate',
    nameRu: 'Сет суши-роллов',
    category: 'fish',
    kcal: 450,
    bju: { p: 43, f: 14, c: 38 },
    image: '/dishes/sushi-set.jpg',
    ingredients: [
      { name: 'Рис для суши', qty: 300, unit: 'г' },
      { name: 'Нори', qty: 4, unit: 'листа' },
      { name: 'Лосось', qty: 150, unit: 'г' },
      { name: 'Огурец, авокадо' },
      { name: 'Сливочный сыр', qty: 60, unit: 'г' },
      { name: 'Соевый соус, васаби, имбирь' },
    ],
    steps: [
      'Свари суши-рис и заправь уксусной смесью.',
      'Распредели рис по нори и выложи начинку.',
      'Скрути роллы с помощью бамбукового коврика.',
      'Нарежь на 8 частей мокрым ножом.',
    ],
  },
  {
    id: 'poke-bowl',
    nameEn: 'Poke bowl with fresh raw salmon',
    nameRu: 'Поке-боул с лососем',
    category: 'fish',
    kcal: 480,
    bju: { p: 51, f: 17, c: 31 },
    image: '/dishes/poke-bowl.jpg',
    ingredients: [
      { name: 'Лосось суши-класса', qty: 150, unit: 'г' },
      { name: 'Рис', qty: 150, unit: 'г' },
      { name: 'Авокадо', qty: 0.5, unit: 'шт' },
      { name: 'Эдамаме', qty: 50, unit: 'г' },
      { name: 'Соевый соус, кунжутное масло' },
      { name: 'Кунжут, нори' },
    ],
    steps: [
      'Отвари рис и остуди.',
      'Нарежь лосось кубиками и маринуй в соевом соусе с маслом 10 минут.',
      'Выложи рис в боул, сверху — ингредиенты секторами.',
      'Посыпь кунжутом и полей заправкой.',
    ],
  },
  {
    id: 'fried-calamari',
    nameEn: 'Fried calamari rings with sauce',
    nameRu: 'Жареные кольца кальмара с соусом',
    category: 'fish',
    kcal: 390,
    bju: { p: 36, f: 12, c: 35 },
    image: '/dishes/fried-calamari.jpg',
    ingredients: [
      { name: 'Кальмары', qty: 400, unit: 'г' },
      { name: 'Мука', qty: 4, unit: 'ст. л.' },
      { name: 'Крахмал', qty: 2, unit: 'ст. л.' },
      { name: 'Масло для фритюра' },
      { name: 'Лимон' },
      { name: 'Чесночный соус' },
    ],
    steps: [
      'Нарежь кальмаров кольцами и обсуши.',
      'Смешай муку с крахмалом и солью.',
      'Обваляй кольца и жарь во фритюре 1–2 минуты до золотистости.',
      'Подавай с лимоном и соусом.',
    ],
  },
  {
    id: 'tuna-steak-sesame',
    nameEn: 'Grilled tuna steak with sesame crust',
    nameRu: 'Стейк тунца в кунжутной корочке',
    category: 'fish',
    kcal: 410,
    bju: { p: 43, f: 14, c: 28 },
    image: '/dishes/tuna-steak-sesame.jpg',
    ingredients: [
      { name: 'Стейк тунца', qty: 250, unit: 'г' },
      { name: 'Кунжут белый и чёрный', qty: 3, unit: 'ст. л.' },
      { name: 'Соевый соус', qty: 2, unit: 'ст. л.' },
      { name: 'Кунжутное масло', qty: 1, unit: 'ч. л.' },
      { name: 'Васаби-майонез' },
    ],
    steps: [
      'Обмакни стейк в соевый соус.',
      'Обваляй в смеси кунжута со всех сторон.',
      'Жарь на сильном огне по 1–2 минуты с каждой стороны — внутри пусть остаётся розовым.',
      'Подавай с васаби-майонезом.',
    ],
  },
  {
    id: 'mussels-cream',
    nameEn: 'Mussels in creamy white wine sauce',
    nameRu: 'Мидии в сливочном соусе с вином',
    category: 'fish',
    kcal: 380,
    bju: { p: 40, f: 13, c: 26 },
    image: '/dishes/mussels-cream.jpg',
    ingredients: [
      { name: 'Мидии', qty: 500, unit: 'г' },
      { name: 'Белое сухое вино', qty: 150, unit: 'мл' },
      { name: 'Сливки', qty: 150, unit: 'мл' },
      { name: 'Чеснок', qty: 3, unit: 'зубчика' },
      { name: 'Шалот', qty: 1, unit: 'шт' },
      { name: 'Петрушка' },
    ],
    steps: [
      'Обжарь шалот и чеснок в масле.',
      'Влей вино и доведи до кипения.',
      'Добавь мидии, готовь под крышкой 5 минут до раскрытия створок.',
      'Влей сливки и посыпь петрушкой. Нераскрывшиеся мидии выброси.',
    ],
  },
  {
    id: 'tom-yum',
    nameEn: 'Tom Yum soup with shrimps',
    nameRu: 'Суп Том Ям с креветками',
    category: 'fish',
    kcal: 350,
    bju: { p: 33, f: 11, c: 30 },
    image: '/dishes/tom-yum.jpg',
    ingredients: [
      { name: 'Креветки', qty: 200, unit: 'г' },
      { name: 'Паста том ям', qty: 2, unit: 'ст. л.' },
      { name: 'Кокосовое молоко', qty: 200, unit: 'мл' },
      { name: 'Лемонграсс', qty: 1, unit: 'стебель' },
      { name: 'Шампиньоны', qty: 100, unit: 'г' },
      { name: 'Лайм, рыбный соус' },
    ],
    steps: [
      'Вскипяти 500 мл воды с лемонграссом и пастой том ям.',
      'Добавь грибы и вари 3 минуты.',
      'Влей кокосовое молоко и добавь креветки.',
      'Вари 2–3 минуты, заправь соком лайма и рыбным соусом.',
    ],
  },
  {
    id: 'fish-and-chips',
    nameEn: 'Fish and chips with tartar sauce',
    nameRu: 'Фиш-энд-чипс с тартаром',
    category: 'fish',
    kcal: 780,
    bju: { p: 75, f: 25, c: 64 },
    image: '/dishes/fish-and-chips.jpg',
    ingredients: [
      { name: 'Треска', qty: 300, unit: 'г' },
      { name: 'Картофель', qty: 500, unit: 'г' },
      { name: 'Мука', qty: 100, unit: 'г' },
      { name: 'Пиво светлое', qty: 150, unit: 'мл' },
      { name: 'Масло для фритюра' },
      { name: 'Тартар: майонез, огурец, каперсы' },
    ],
    steps: [
      'Нарежь картофель и обжарь во фритюре до золотистости.',
      'Сделай кляр из муки и ледяного пива.',
      'Обмакни филе в кляр и жарь 4–5 минут.',
      'Подавай с домашним тартаром и долькой лимона.',
    ],
  },
  {
    id: 'crispy-tofu',
    nameEn: 'Asian style crispy tofu with rice',
    nameRu: 'Тофу в азиатском стиле с рисом',
    category: 'veg',
    kcal: 440,
    bju: { p: 17, f: 18, c: 53 },
    image: '/dishes/crispy-tofu.jpg',
    ingredients: [
      { name: 'Тофу плотный', qty: 300, unit: 'г' },
      { name: 'Рис', qty: 150, unit: 'г' },
      { name: 'Соевый соус', qty: 3, unit: 'ст. л.' },
      { name: 'Крахмал кукурузный', qty: 3, unit: 'ст. л.' },
      { name: 'Кунжутное масло, чеснок' },
      { name: 'Зелёный лук, кунжут' },
    ],
    steps: [
      'Нарежь тофу кубиками и обваляй в крахмале.',
      'Обжарь до хрустящей корочки со всех сторон.',
      'Влей соус из сои, чеснока и кунжутного масла, перемешай 30 секунд.',
      'Подавай с рисом, зелёным луком и кунжутом.',
    ],
  },
  {
    id: 'pumpkin-soup',
    nameEn: 'Creamy pumpkin soup with pumpkin seeds',
    nameRu: 'Крем-суп из тыквы с семечками',
    category: 'veg',
    kcal: 230,
    bju: { p: 9, f: 9, c: 28 },
    image: '/dishes/pumpkin-soup.jpg',
    ingredients: [
      { name: 'Тыква', qty: 600, unit: 'г' },
      { name: 'Лук', qty: 1, unit: 'шт' },
      { name: 'Сливки', qty: 100, unit: 'мл' },
      { name: 'Овощной бульон', qty: 400, unit: 'мл' },
      { name: 'Тыквенные семечки', qty: 2, unit: 'ст. л.' },
      { name: 'Мускатный орех' },
    ],
    steps: [
      'Обжарь лук, добавь кубики тыквы.',
      'Влей бульон и вари 20 минут до мягкости.',
      'Пробей блендером со сливками до кремовости.',
      'Подавай с семечками и каплей сливок.',
    ],
  },
  {
    id: 'greek-salad',
    nameEn: 'Greek salad with feta cheese and olives',
    nameRu: 'Греческий салат с фетой',
    category: 'veg',
    kcal: 280,
    bju: { p: 10, f: 10, c: 38 },
    image: '/dishes/greek-salad.jpg',
    ingredients: [
      { name: 'Помидоры', qty: 3, unit: 'шт' },
      { name: 'Огурец', qty: 1, unit: 'шт' },
      { name: 'Фета', qty: 100, unit: 'г' },
      { name: 'Оливки', note: 'горсть' },
      { name: 'Красный лук', qty: 0.25, unit: 'шт' },
      { name: 'Оливковое масло, орегано' },
    ],
    steps: [
      'Нарежь помидоры и огурец крупными кусками.',
      'Добавь лук полукольцами и оливки.',
      'Полей оливковым маслом и посыпь орегано.',
      'Сверху положи целый пласт феты.',
    ],
  },
  {
    id: 'margherita-pizza',
    nameEn: 'Margherita pizza with fresh basil',
    nameRu: 'Пицца Маргарита с базиликом',
    category: 'veg',
    kcal: 580,
    bju: { p: 23, f: 24, c: 68 },
    image: '/dishes/margherita-pizza.jpg',
    ingredients: [
      { name: 'Тесто для пиццы', qty: 250, unit: 'г' },
      { name: 'Томаты в соку', qty: 150, unit: 'г' },
      { name: 'Моцарелла', qty: 150, unit: 'г' },
      { name: 'Базилик', note: 'пучок' },
      { name: 'Оливковое масло', qty: 1, unit: 'ст. л.' },
    ],
    steps: [
      'Разогрей духовку с противнем до 250°C.',
      'Раскатай тесто и смажь томатным соусом.',
      'Выложи моцареллу и запекай 8–10 минут.',
      'Укрась базиликом и оливковым маслом.',
    ],
  },
  {
    id: 'falafel-wrap',
    nameEn: 'Falafel wrap with fresh vegetables',
    nameRu: 'Ролл с фалафелем и овощами',
    category: 'veg',
    kcal: 460,
    bju: { p: 18, f: 19, c: 54 },
    image: '/dishes/falafel-wrap.jpg',
    ingredients: [
      { name: 'Фалафель', qty: 6, unit: 'шт' },
      { name: 'Лаваш или тортилья', qty: 2, unit: 'шт' },
      { name: 'Хумус', qty: 3, unit: 'ст. л.' },
      { name: 'Помидор, огурец, салат' },
      { name: 'Тахини-соус', qty: 2, unit: 'ст. л.' },
    ],
    steps: [
      'Разогрей фалафель в духовке 8 минут.',
      'Смажь лаваш хумусом.',
      'Выложи фалафель и нарезанные овощи.',
      'Полей тахини-соусом и заверни ролл.',
    ],
  },
  {
    id: 'mushroom-risotto',
    nameEn: 'Mushroom risotto with parmesan',
    nameRu: 'Грибное ризотто с пармезаном',
    category: 'veg',
    kcal: 540,
    bju: { p: 21, f: 22, c: 65 },
    image: '/dishes/mushroom-risotto.jpg',
    ingredients: [
      { name: 'Рис арборио', qty: 150, unit: 'г' },
      { name: 'Шампиньоны', qty: 250, unit: 'г' },
      { name: 'Белое вино', qty: 80, unit: 'мл' },
      { name: 'Овощной бульон', qty: 600, unit: 'мл' },
      { name: 'Пармезан', qty: 30, unit: 'г' },
      { name: 'Сливочное масло, шалот' },
    ],
    steps: [
      'Обжарь грибы до золотистости и отложи.',
      'Пассеруй шалот, добавь рис и обжарь 1 минуту.',
      'Влей вино, затем добавляй бульон по половнику, помешивая, 18 минут.',
      'Вмешай грибы, пармезан и кусочек масла.',
    ],
  },
  {
    id: 'roasted-roots',
    nameEn: 'Roasted root vegetables with thyme',
    nameRu: 'Запечённые корнеплоды с тимьяном',
    category: 'veg',
    kcal: 260,
    bju: { p: 10, f: 11, c: 30 },
    image: '/dishes/roasted-roots.jpg',
    ingredients: [
      { name: 'Морковь', qty: 3, unit: 'шт' },
      { name: 'Свёкла', qty: 2, unit: 'шт' },
      { name: 'Пастернак', qty: 2, unit: 'шт' },
      { name: 'Оливковое масло', qty: 2, unit: 'ст. л.' },
      { name: 'Тимьян', qty: 4, unit: 'веточки' },
      { name: 'Мёд', qty: 1, unit: 'ч. л.' },
    ],
    steps: [
      'Нарежь корнеплоды крупными брусками.',
      'Смешай с маслом, тимьяном и солью.',
      'Запекай при 200°C 35–40 минут.',
      'Сбрызни мёдом перед подачей.',
    ],
  },
  {
    id: 'caprese-salad',
    nameEn: 'Caprese salad with tomatoes and mozzarella',
    nameRu: 'Салат Капрезе с моцареллой',
    category: 'veg',
    kcal: 300,
    bju: { p: 11, f: 11, c: 39 },
    image: '/dishes/caprese-salad.jpg',
    ingredients: [
      { name: 'Помидоры', qty: 3, unit: 'шт' },
      { name: 'Моцарелла', qty: 200, unit: 'г' },
      { name: 'Базилик свежий', note: 'пучок' },
      { name: 'Оливковое масло', qty: 2, unit: 'ст. л.' },
      { name: 'Бальзамический крем' },
    ],
    steps: [
      'Нарежь помидоры и моцареллу кружками по 5 мм.',
      'Выложи в шахматном порядке с листьями базилика.',
      'Полей оливковым маслом первого отжима.',
      'Укрась бальзамическим кремом.',
    ],
  },
  {
    id: 'eggplant-parmesan',
    nameEn: 'Eggplant parmesan baked with cheese',
    nameRu: 'Баклажаны пармиджано',
    category: 'veg',
    kcal: 420,
    bju: { p: 16, f: 17, c: 51 },
    image: '/dishes/eggplant-parmesan.jpg',
    ingredients: [
      { name: 'Баклажаны', qty: 2, unit: 'шт' },
      { name: 'Томаты в соку', qty: 400, unit: 'г' },
      { name: 'Моцарелла', qty: 150, unit: 'г' },
      { name: 'Пармезан', qty: 40, unit: 'г' },
      { name: 'Базилик, чеснок' },
      { name: 'Мука для панировки' },
    ],
    steps: [
      'Нарежь баклажаны пластами, посоли на 20 минут и обсуши.',
      'Обваляй в муке и обжарь до румяности.',
      'Выложи слоями с томатным соусом и сырами.',
      'Запекай при 190°C 25 минут до корочки.',
    ],
  },
  {
    id: 'buddha-bowl',
    nameEn: 'Buddha bowl with chickpeas and sweet potato',
    nameRu: 'Боул с нутом и бататом',
    category: 'veg',
    kcal: 470,
    bju: { p: 18, f: 18, c: 59 },
    image: '/dishes/buddha-bowl.jpg',
    ingredients: [
      { name: 'Нут отварной', qty: 200, unit: 'г' },
      { name: 'Батат', qty: 200, unit: 'г' },
      { name: 'Киноа', qty: 80, unit: 'г' },
      { name: 'Авокадо', qty: 0.5, unit: 'шт' },
      { name: 'Шпинат', note: 'горсть' },
      { name: 'Тахини-заправка, паприка' },
    ],
    steps: [
      'Запеки кубики батата со специями 25 минут.',
      'Отвари киноа.',
      'Обжарь нут с паприкой 5 минут.',
      'Собери боул секторами и полей тахини-заправкой.',
    ],
  },
  // ==================== v3: +50 оригинальных домашних рецептов ====================
  ...DISHES_MORE,
];

/**
 * PRO-коллекция — 40 авторских/ресторанных блюд.
 * Видны в каталоге всем (фото, название, ккал), но ингредиенты и шаги — с PRO.
 * Остальные 60 блюд классической домашней кухни — бесплатные.
 */
export const PRO_DISH_IDS: ReadonlySet<string> = new Set([
  // Азия и поке
  'tom-yum',
  'poke-bowl',
  'sushi-set',
  'crispy-tofu',
  'chicken-tikka-masala',
  'soba-beef',
  'chicken-teriyaki',
  'chicken-stir-fry',
  'sweet-sour-chicken',
  // Рыба и морепродукты
  'mussels-cream',
  'tuna-steak-sesame',
  'fried-calamari',
  'baked-dorado',
  'baked-salmon-quinoa',
  'shrimp-pasta',
  'garlic-shrimp',
  // Ресторанная классика
  'beef-steak',
  'mushroom-risotto',
  'eggplant-parmesan',
  'julienne',
  'pork-french',
  'lyulya-kebab',
  'ratatouille',
  'buddha-bowl',
  // Фастфуд и уличная еда
  'beef-burger',
  'fish-and-chips',
  'beef-tacos',
  'chicken-fajitas',
  'bbq-pork-ribs',
  'bbq-chicken-wings',
  'pepperoni-pizza',
  'falafel-wrap',
  // Завтраки и закуски
  'croissant-salmon',
  'avocado-toast',
  'smoothie-bowl',
  'spinach-cheese-pancake',
  'bruschetta',
  'caprese-salad',
  // Выпечка и десерты
  'adjarian-khachapuri',
  'ny-cheesecake',
]);

export const PRO_DISHES_COUNT = PRO_DISH_IDS.size;

/** Итоговая база: 100 блюд, авторские помечены tier: 'pro' */
export const DISHES: Dish[] = ALL_DISHES.map((d) =>
  PRO_DISH_IDS.has(d.id) ? { ...d, tier: 'pro' as const } : d,
);
