/**
 * Подбор рецептов по имеющимся продуктам.
 * Используется на экране сканирования («что приготовить из фото холодильника»)
 * и на экране запасов («что приготовить из шкафчика»).
 */
import {
  DISHES,
  FRIDGE_PRODUCTS,
  PRODUCT_BY_NAME,
  isBaseIngredient,
  type Dish,
} from '../data/dishes';

/**
 * Покрыт ли ингредиент набором доступных продуктов.
 * available — канонические имена продуктов (FRIDGE_PRODUCTS) либо сырые строки
 * (например, ингредиент, добавленный из блока «добавь X»).
 */
export function coveredBy(ingredientName: string, available: string[]): boolean {
  const n = ingredientName.toLowerCase();
  return available.some((a) => {
    const prod = PRODUCT_BY_NAME.get(a.toLowerCase());
    if (prod) return prod.keys.some((k) => n.includes(k));
    const an = a.toLowerCase();
    return n.includes(an) || an.includes(n);
  });
}

/** Ингредиенты, участвующие в подборе (без соли/специй/масла) */
export function realIngredients(dish: Dish) {
  return dish.ingredients.filter((ing) => !isBaseIngredient(ing.name));
}

export interface MissingGroup {
  /** какого продукта не хватает (имя ингредиента рецепта) */
  ingredient: string;
  emoji: string;
  dishes: Dish[];
}

export interface MatchResult {
  /** блюда, которые можно приготовить прямо сейчас */
  canCook: Dish[];
  /** «добавь X — и приготовь N блюд» */
  missingGroups: MissingGroup[];
  /** блюд, которым не хватает 2+ продуктов */
  far: number;
}

/** Сопоставить все блюда базы с доступными продуктами */
export function matchDishes(available: string[]): MatchResult {
  const canCook: Dish[] = [];
  const missingMap = new Map<string, Dish[]>();
  let far = 0;

  for (const dish of DISHES) {
    const missing: string[] = [];
    for (const ing of realIngredients(dish)) {
      if (!coveredBy(ing.name, available)) missing.push(ing.name);
    }
    if (missing.length === 0) {
      canCook.push(dish);
    } else if (missing.length === 1) {
      const arr = missingMap.get(missing[0]) ?? [];
      arr.push(dish);
      missingMap.set(missing[0], arr);
    } else {
      far++;
    }
  }

  const missingGroups: MissingGroup[] = [...missingMap.entries()]
    .map(([ingredient, dishes]) => ({
      ingredient,
      emoji: emojiFor(ingredient),
      dishes: [...dishes].sort((a, b) => a.kcal - b.kcal),
    }))
    .sort((a, b) => b.dishes.length - a.dishes.length);

  return { canCook, missingGroups, far };
}

/** Можно ли приготовить блюдо целиком из available */
export function canCookFrom(dish: Dish, available: string[]): boolean {
  return realIngredients(dish).every((ing) => coveredBy(ing.name, available));
}

/** Эмодзи для произвольного ингредиента (по справочнику продуктов) */
export function emojiFor(ingredientName: string): string {
  const n = ingredientName.toLowerCase();
  for (const p of FRIDGE_PRODUCTS) {
    if (p.keys.some((k) => n.includes(k))) return p.emoji;
  }
  return '🥫';
}
