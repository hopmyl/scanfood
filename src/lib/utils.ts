/** Склейка классов без внешних зависимостей */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Формат калорий: «~420 ккал» */
export function formatKcal(kcal: number): string {
  return `~${kcal} ккал`;
}

/**
 * Количество с учётом порций: 0,5-шаги до 10, дальше целые.
 * Десятичный разделитель — запятая (русская локаль).
 */
export function formatAmount(qty: number): string {
  const half = Math.round(qty * 2) / 2;
  if (half >= 10) return String(Math.round(half));
  const s = Number.isInteger(half) ? String(half) : half.toFixed(1);
  return s.replace('.', ',');
}

/** Количество для списка покупок: «400 г», «1 шт», «по вкусу» */
export function formatIngredientAmount(ing: { qty?: number; unit?: string; note?: string }): string {
  if (ing.qty === undefined) return ing.note ?? '';
  return [formatAmount(ing.qty), ing.unit].filter(Boolean).join(' ');
}

/** Русская плюрализация: pluralRu(3, 'рецепт', 'рецепта', 'рецептов') → «рецепта» */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 > 20)) return few;
  return many;
}
