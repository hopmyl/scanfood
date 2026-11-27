import { useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock, CookingPot, Crown, Flame, Globe, RotateCcw, Search } from 'lucide-react';
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
import { COLLECTIONS, COLLECTION_BY_ID } from '../data/collections';
import DishCard from '../components/DishCard';
import { canCookFrom } from '../lib/match';
import { useAppStore } from '../store/useAppStore';
import { cn, pluralRu } from '../lib/utils';

/** Сколько карточек показываем сразу (остальные — кнопкой «Показать ещё») */
const PAGE_SIZE = 24;

/** Строка фильтров: подпись группы + лента чипсов (на десктопе переносятся, не режутся) */
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="w-[74px] shrink-0 text-[11px] leading-tight font-bold tracking-wide text-ink-3 uppercase">
        {label}
      </span>
      <div className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 md:flex-wrap">
        {children}
      </div>
    </div>
  );
}

const chipClass = (active: boolean, dark: boolean = true) =>
  cn(
    'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
    active
      ? dark
        ? 'border-ink bg-ink text-app'
        : 'border-accent bg-accent text-on-accent'
      : 'border-line bg-card text-ink-2 hover:border-ink-3',
  );

export default function CatalogScreen() {
  const isPro = useAppStore((s) => s.userProfile.isPro);
  const pantry = useAppStore((s) => s.pantry);

  const [category, setCategory] = useState<DishCategory | 'all'>('all');
  const [kcalId, setKcalId] = useState('any');
  const [query, setQuery] = useState('');
  /** Сложность: 'any' | 'easy' | 'medium' | 'hard' */
  const [difficultyId, setDifficultyId] = useState('any');
  /** Время: 'any' | 'le15' | 'le30' | 'le60' */
  const [timeId, setTimeId] = useState('any');
  /** Выбранные кухни: пустой набор = все кухни; несколько = объединение */
  const [cuisines, setCuisines] = useState<Set<CuisineId>>(new Set());
  /** Быстрые фильтры: можно приготовить из кладовой / без PRO */
  const [onlyStock, setOnlyStock] = useState(false);
  const [onlyFree, setOnlyFree] = useState(false);
  /** PRO-подборка (высокобелковое, без глютена, до 300 ₽…) — null = все блюда */
  const [collectionId, setCollectionId] = useState<string | null>(null);
  /** Пагинация: сколько карточек показано */
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
      if (collectionId && !COLLECTION_BY_ID.get(collectionId)?.ids.has(d.id)) return false;
      if (category !== 'all' && d.category !== category) return false;
      if (cuisines.size > 0 && !cuisines.has(d.cuisine ?? 'russian')) return false;
      if (range?.min !== undefined && d.kcal < range.min) return false;
      if (range?.max !== undefined && d.kcal > range.max) return false;
      if (difficultyId !== 'any' && d.difficulty !== difficultyId) return false;
      if (timeRange?.max !== undefined && (d.timeMin ?? Infinity) > timeRange.max) return false;
      if (onlyStock && !canCookFrom(d, pantry)) return false;
      if (onlyFree && d.tier === 'pro') return false;
      if (q && !d.nameEn.toLowerCase().includes(q) && !d.nameRu.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [category, kcalId, query, cuisines, difficultyId, timeId, onlyStock, onlyFree, collectionId, pantry]);

  // Любое изменение фильтров — показываем снова первую страницу
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, kcalId, query, cuisines, difficultyId, timeId, onlyStock, onlyFree, collectionId]);

  const hasActiveFilters =
    category !== 'all' ||
    kcalId !== 'any' ||
    query.trim() !== '' ||
    cuisines.size > 0 ||
    difficultyId !== 'any' ||
    timeId !== 'any' ||
    onlyStock ||
    onlyFree ||
    collectionId !== null;

  const reset = () => {
    setCategory('all');
    setKcalId('any');
    setQuery('');
    setCuisines(new Set());
    setDifficultyId('any');
    setTimeId('any');
    setOnlyStock(false);
    setOnlyFree(false);
    setCollectionId(null);
  };

  const visible = filtered.slice(0, visibleCount);
  const restCount = filtered.length - visibleCount;

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

      {/* Быстрые фильтры — раньше прятались среди 260 карточек */}
      <FilterRow label="Быстро">
        <button
          type="button"
          onClick={() => setOnlyStock((v) => !v)}
          aria-pressed={onlyStock}
          className={chipClass(onlyStock, false)}
        >
          <CookingPot size={13} aria-hidden />
          Из запасов
        </button>
        <button
          type="button"
          onClick={() => setOnlyFree((v) => !v)}
          aria-pressed={onlyFree}
          className={chipClass(onlyFree, false)}
        >
          <Crown size={13} aria-hidden />
          Без PRO
        </button>
      </FilterRow>

      {/* Чипсы категорий */}
      <FilterRow label="Категории">
        {CATEGORY_FILTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategory(c.id)}
            className={chipClass(category === c.id, false)}
          >
            <span aria-hidden>{c.emoji}</span>
            {c.labelRu}
          </button>
        ))}
      </FilterRow>

      {/* PRO-подборки под конкретные цели: белок, детское, без глютена, до 300 ₽… */}
      <FilterRow label="Подборки">
        {COLLECTIONS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCollectionId((prev) => (prev === c.id ? null : c.id))}
            aria-pressed={collectionId === c.id}
            className={chipClass(collectionId === c.id, false)}
          >
            <span aria-hidden>{c.emoji}</span>
            {c.titleRu}
            <span className="text-[11px] text-ink-3">{c.ids.size}</span>
          </button>
        ))}
      </FilterRow>

      {/* Чипсы кухонь (мультивыбор: русская + тайская = обе сразу) */}
      <FilterRow label="Кухня">
        {(Object.keys(CUISINE_META) as CuisineId[]).map((c) => {
          const active = cuisines.has(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggleCuisine(c)}
              aria-pressed={active}
              className={chipClass(active, true)}
            >
              <span aria-hidden>{CUISINE_META[c].emoji}</span>
              {CUISINE_META[c].labelRu}
            </button>
          );
        })}
      </FilterRow>

      {/* Чипсы калорийности — раньше ряды «Любая» без подписей путались между собой */}
      <FilterRow label="Калории">
        {KCAL_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setKcalId(r.id)}
            className={cn(chipClass(kcalId === r.id, true), 'gap-1')}
          >
            <Flame size={13} aria-hidden />
            {r.id === 'any' ? r.labelRu : `${r.labelRu} ккал`}
          </button>
        ))}
      </FilterRow>

      {/* Чипсы сложности */}
      <FilterRow label="Сложность">
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
            className={cn(chipClass(difficultyId === r.id, true), 'gap-1')}
          >
            <ChefHat size={13} aria-hidden />
            {r.labelRu}
          </button>
        ))}
      </FilterRow>

      {/* Чипсы времени приготовления */}
      <FilterRow label="Время">
        {TIME_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setTimeId(r.id)}
            className={cn(chipClass(timeId === r.id, true), 'gap-1')}
          >
            <Clock size={13} aria-hidden />
            {r.labelRu}
          </button>
        ))}
      </FilterRow>

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

      {/* Сетка блюд: 2 колонки на телефоне, 3 на планшете, 4 на десктопе */}
      {filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {visible.map((dish) => (
              <DishCard key={dish.id} dish={dish} />
            ))}
          </div>
          {restCount > 0 && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-card py-3 text-sm font-semibold text-ink transition-colors hover:bg-soft"
            >
              <Globe size={15} className="text-accent" aria-hidden />
              Показать ещё {Math.min(PAGE_SIZE, restCount)} из {restCount}{' '}
              {pluralRu(restCount, 'блюдо', 'блюда', 'блюд')}
            </button>
          )}
        </>
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
