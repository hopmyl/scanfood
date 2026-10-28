/**
 * Индекс новых блюд v3: 50 оригинальных рецептов домашней кухни.
 * Итого база СканРецепт: 100 блюд.
 */
import type { Dish } from './dishes';
import { DISHES_EXTRA_A } from './dishes-extra-a';
import { DISHES_EXTRA_B } from './dishes-extra-b';
import { DISHES_EXTRA_C } from './dishes-extra-c';

export const DISHES_MORE: Dish[] = [
  ...DISHES_EXTRA_A,
  ...DISHES_EXTRA_B,
  ...DISHES_EXTRA_C,
];
