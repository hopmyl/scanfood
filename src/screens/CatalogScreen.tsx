import { useMemo, useState } from 'react';
import { Crown, Flame, RotateCcw, Search } from 'lucide-react';
import { CATEGORY_FILTERS, DISHES, KCAL_RANGES, type DishCategory } from '../data/dishes';
import DishCard from '../components/DishCard';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

export default function CatalogScreen() {
  const isPro = useAppStore((s) => s.userProfile.isPro);

  const [category, setCategory] = useState<DishCategory | 'all'>('all');
  const [kcalId, setKcalId] = useState('any');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const range = KCAL_RANGES.find((r) => r.id === kcalId);
    const q = query.trim().toLowerCase();

    return DISHES.filter((d) => {
      if (category !== 'all' && d.category !== category) return false;
      if (range?.min !== undefined && d.kcal < range.min) return false;
      if (range?.max !== undefined && d.kcal > range.max) return false;
      if (q && !d.nameEn.toLowerCase().includes(q) && !d.nameRu.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [category, kcalId, query]);

  const hasActiveFilters = category !== 'all' || kcalId !== 'any' || query.trim() !== '';

  const reset = () => {
    setCategory('all');
    setKcalId('any');
    setQuery('');
  };

  return (
    <div>
      {/* Шапка */}
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">СканРецепт</h1>
          <p className="text-xs text-stone-500">{DISHES.length} рецептов от ИИ</p>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
            isPro ? 'bg-pro-500/10 text-pro-600' : 'bg-stone-200/70 text-stone-600',
          )}
        >
          <Crown size={13} className={cn(isPro && 'fill-current')} />
          {isPro ? 'PRO' : 'Лайт'}
        </span>
      </header>

      {/* Поиск */}
      <div className="relative mb-3">
        <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти блюдо: карбонара, сырники…"
          className="w-full rounded-2xl border border-stone-200 bg-white py-2.5 pr-4 pl-10 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 focus:outline-none"
        />
      </div>

      {/* Чипсы категорий */}
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              category === c.id
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300',
            )}
          >
            <span aria-hidden>{c.emoji}</span>
            {c.labelRu}
          </button>
        ))}
      </div>

      {/* Чипсы калорийности */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {KCAL_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setKcalId(r.id)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              kcalId === r.id
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300',
            )}
          >
            <span className="inline-flex items-center gap-1">
              <Flame size={13} aria-hidden />
              {r.id === 'any' ? r.labelRu : `${r.labelRu} ккал`}
            </span>
          </button>
        ))}
      </div>

      {/* Счётчик результатов */}
      <p className="mb-3 text-xs text-stone-500">
        Найдено: {filtered.length} {plural(filtered.length)}
        {hasActiveFilters && (
          <button type="button" onClick={reset} className="ml-2 font-medium text-brand-600 hover:underline">
            сбросить
          </button>
        )}
      </p>

      {/* Сетка блюд */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white/60 py-12 text-center">
          <span className="mb-2 text-4xl" aria-hidden>
            🍳
          </span>
          <p className="text-sm font-medium text-stone-700">Ничего не нашлось</p>
          <p className="mt-1 mb-4 text-xs text-stone-500">Попробуй изменить фильтры или запрос</p>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
          >
            <RotateCcw size={13} />
            Сбросить фильтры
          </button>
        </div>
      )}
    </div>
  );
}

/** Русская плюрализация слова «блюдо» */
function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'блюдо';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 > 20)) return 'блюда';
  return 'блюд';
}
