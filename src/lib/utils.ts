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

/**
 * Сколько дней осталось до даты «YYYY-MM-DD» (локальная таймзона).
 * 0 = истекает сегодня, −1 = уже просрочено. Некорректная дата → null.
 */
export function daysLeft(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

/** ISO-дата «YYYY-MM-DD» через n дней от сегодня (локальная таймзона) */
export function isoInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Версия статики фото блюд. Увеличиваем при перегенерации фото —
 * меняющийся ?v= сбрасывает HTTP-кэш телефонов, иначе браузер показывает старьё.
 */
export const DISH_IMG_V = 3;

/**
 * Путь к фото блюда с кэш-бастингом и учётом базы Vite:
 * '/dishes/x.jpg' → '/dishes/x.jpg?v=3' на Vercel (base '/'),
 * '/scanfood/dishes/x.jpg?v=3' на зеркале GitHub Pages (base '/scanfood/').
 */
export function dishImgUrl(src: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const clean = src.startsWith('/') ? src.slice(1) : src;
  return `${base}${clean}?v=${DISH_IMG_V}`;
}
