/** Склейка классов без внешних зависимостей */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Формат калорий: «~420 ккал» */
export function formatKcal(kcal: number): string {
  return `~${kcal} ккал`;
}
