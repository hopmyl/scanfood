import { useMemo, useState } from 'react';
import { ChefHat, Clock, Crown, Flame, RotateCcw, Search } from 'lucide-react';
import {
  CATEGORY_FILTERS,
  CUISINE_META,
  DIFFICULTY_META,
  DISHES,
  KCAL_RANGES,
  TIME_RANGES,
  type CuisineId,
  type DishCategory,
} from '../data/dishes';
import DishCard from '../components/DishCard';
import { useAppStore } from '../store/useAppStore';
import { cn, pluralRu } from '../lib/utils';

export default function CatalogScreen() {
  const isPro = useAppStore((s) => s.userProfile.isPro);

  const [category, setCategory] = useState<DishCategory | 'all'>('all');
  const [kcalId, setKcalId] = useState('any');
  const [query, setQuery] = useState('');
  /** Сложность: 'any' | 'easy' | 'medium' | 'hard' */
  const [difficultyId, setDifficultyId] = useState('any');
  /** Время: 'any' | 'le15' | 'le30' | 'le60' */
  const [timeId, setTimeId] = useState('any');
  /** Выбранные кухни: пустой набор = все кухни; несколько = объединение */
  const [cuisines, setCuisines] = useState<Set<CuisineId>>(new Set());

  const toggleCuisine = (c: CuisineId) => {
    setCuisines((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const range = KCAL_RANGES.find((r) => r.id === kcalId);
    const timeRange = TIME_RANGES.find((r) => r.id === timeId);
    const q = query.trim().toLowerCase();

    return DISHES.filter((d) => {
      if (category !== 'all' && d.category !== category) return false;
      if (cuisines.size > 0 && !cuisines.has(d.cuisine ?? 'russian')) return false;
      if (range?.min !== undefined && d.kcal < range.min) return false;
      if (range?.max !== undefined && d.kcal > range.max) return false;
      if (difficultyId !== 'any' && d.difficulty !== difficultyId) return false;
      if (timeRange?.max !== undefined && (d.timeMin ?? Infinity) > timeRange.max) return false;
      if (q && !d.nameEn.toLowerCase().includes(q) && !d.nameRu.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [category, kcalId, query, cuisines, difficultyId, timeId]);

  const hasActiveFilters =
    category !== 'all' ||
    kcalId !== 'any' ||
    query.trim() !== '' ||
    cuisines.size > 0 ||
    difficultyId !== 'any' ||
    timeId !== 'any';

  const reset = () => {
    setCategory('all');
    setKcalId('any');
    setQuery('');
    setCuisines(new Set());
    setDifficultyId('any');
    setTimeId('any');
  };

  return (
    <div>
      {/* Шапка */}
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">СканРецепт</h1>
          <p className="text-xs text-ink-2">Из того, что есть — в то, что вкусно</p>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
            isPro ? 'bg-pro/10 text-pro-ink' : 'bg-soft text-ink-2',
          )}
        >
          <Crown size={13} className={cn(isPro && 'fill-current')} />
          {isPro ? 'PRO' : 'Лайт'}
        </span>
      </header>

      {/* Поиск */}
      <div className="relative mb-3">
        <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти блюдо: борщ, сырники…"
          className="w-full rounded-2xl border border-line bg-card py-2.5 pr-4 pl-10 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
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
                ? 'border-accent bg-accent text-on-accent'
                : 'border-line bg-card text-ink-2 hover:border-ink-3',
            )}
          >
            <span aria-hidden>{c.emoji}</span>
            {c.labelRu}
          </button>
        ))}
      </div>

      {/* Чипсы кухонь (мультивыбор: русская + тайская = обе сразу) */}
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {(Object.keys(CUISINE_META) as CuisineId[]).map((c) => {
          const active = cuisines.has(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggleCuisine(c)}
              aria-pressed={active}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                active
                  ? 'border-ink bg-ink text-app'
                  : 'border-line bg-card text-ink-2 hover:border-ink-3',
              )}
            >
              <span aria-hidden>{CUISINE_META[c].emoji}</span>
              {CUISINE_META[c].labelRu}
            </button>
          );
        })}
      </div>

      {/* Чипсы калорийности */}
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {KCAL_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setKcalId(r.id)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              kcalId === r.id
                ? 'border-ink bg-ink text-app'
                : 'border-line bg-card text-ink-2 hover:border-ink-3',
            )}
          >
            <span className="inline-flex items-center gap-1">
              <Flame size={13} aria-hidden />
              {r.id === 'any' ? r.labelRu : `${r.labelRu} ккал`}
            </span>
          </button>
        ))}
      </div>

      {/* Чипсы сложности */}
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {(
          [
            { id: 'any', labelRu: 'Любая' },
            ...Object.entries(DIFFICULTY_META).map(([id, m]) => ({ id, labelRu: m.labelRu })),
          ] as Array<{ id: string; labelRu: string }>
        ).map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setDifficultyId(r.id)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              difficultyId === r.id
                ? 'border-ink bg-ink text-app'
                : 'border-line bg-card text-ink-2 hover:border-ink-3',
            )}
          >
            <span className="inline-flex items-center gap-1">
              <ChefHat size={13} aria-hidden />
              {r.labelRu}
            </span>
          </button>
        ))}
      </div>

      {/* Чипсы времени приготовления */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setTimeId(r.id)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              timeId === r.id
                ? 'border-ink bg-ink text-app'
                : 'border-line bg-card text-ink-2 hover:border-ink-3',
            )}
          >
            <span className="inline-flex items-center gap-1">
              <Clock size={13} aria-hidden />
              {r.labelRu}
            </span>
          </button>
        ))}
      </div>

      {/* Счётчик результатов */}
      <p className="mb-3 text-xs text-ink-2">
        Найдено: {filtered.length} {pluralRu(filtered.length, 'блюдо', 'блюда', 'блюд')}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={reset}
            className="ml-2 font-medium text-accent hover:underline"
          >
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
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-soft/50 py-12 text-center">
          <span className="mb-2 text-4xl" aria-hidden>
            🍳
          </span>
          <p className="text-sm font-medium text-ink">Ничего не нашлось</p>
          <p className="mt-1 mb-4 text-xs text-ink-2">Попробуй изменить фильтры или запрос</p>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-strong"
          >
            <RotateCcw size={13} />
            Сбросить фильтры
          </button>
        </div>
      )}
    </div>
  );
}
