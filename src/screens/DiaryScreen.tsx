import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  ShoppingBasket,
  Sparkles,
  X,
} from 'lucide-react';
import { DISHES, type Dish } from '../data/dishes';
import { coveredBy } from '../lib/match';
import { useAppStore, type DiaryEntry, type MealSlot } from '../store/useAppStore';
import { cn, formatAmount, pluralRu } from '../lib/utils';

// ============================================================================
// Хелперы дат (локальная таймзона, ISO «YYYY-MM-DD»)
// ============================================================================

const WD_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function isoOf(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDaysIso(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

/** Неделя (Пн-Вс), в которую попадает дата */
function weekOf(iso: string): string[] {
  const d = parseIso(iso);
  const monday = addDaysIso(iso, -((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
}

const wdShort = (iso: string) => WD_SHORT[parseIso(iso).getDay()];
const dayNum = (iso: string) => parseIso(iso).getDate();

/** Слот приёма пищи по текущему часу */
function currentMeal(): MealSlot {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 22) return 'dinner';
  return 'snack';
}

const MEALS: Array<{ id: MealSlot; labelRu: string; emoji: string }> = [
  { id: 'breakfast', labelRu: 'Завтрак', emoji: '🌅' },
  { id: 'lunch', labelRu: 'Обед', emoji: '☀️' },
  { id: 'dinner', labelRu: 'Ужин', emoji: '🌙' },
  { id: 'snack', labelRu: 'Перекус', emoji: '🍏' },
];

const mealMeta = (m: MealSlot) => MEALS.find((x) => x.id === m) ?? MEALS[3];

// ============================================================================
// Пикер блюд: каталог + ручной ввод (для дневника и плана)
// ============================================================================

function DishPicker({
  open,
  date,
  kind,
  onClose,
}: {
  open: boolean;
  date: string;
  kind: 'eaten' | 'planned';
  onClose: () => void;
}) {
  const addDiaryEntry = useAppStore((s) => s.addDiaryEntry);
  const [meal, setMeal] = useState<MealSlot>('breakfast');
  const [q, setQ] = useState('');
  const [customName, setCustomName] = useState('');
  const [customKcal, setCustomKcal] = useState('');

  useEffect(() => {
    if (open) {
      setMeal(kind === 'planned' ? 'breakfast' : currentMeal());
      setQ('');
      setCustomName('');
      setCustomKcal('');
    }
  }, [open, kind]);

  if (!open) return null;

  const query = q.trim().toLowerCase();
  const results = query
    ? DISHES.filter(
        (d) => d.nameRu.toLowerCase().includes(query) || d.nameEn.toLowerCase().includes(query),
      ).slice(0, 8)
    : DISHES.slice(0, 8);

  const add = (e: Omit<DiaryEntry, 'id'>) => {
    addDiaryEntry(e);
    onClose();
  };

  const kcalNum = Number(customKcal);
  const customValid = customName.trim().length >= 2 && Number.isFinite(kcalNum) && kcalNum > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-6 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={kind === 'planned' ? 'Запланировать блюдо' : 'Записать блюдо'}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-card p-4 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">
            {kind === 'planned' ? 'Запланировать блюдо' : 'Записать блюдо'}
            <span className="ml-1.5 text-xs font-normal text-ink-2">
              · {wdShort(date)}, {dayNum(date)}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 hover:bg-soft hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {/* Слот приёма пищи */}
        <div className="mb-3 grid grid-cols-4 gap-1 rounded-2xl bg-soft p-1">
          {MEALS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMeal(m.id)}
              aria-pressed={meal === m.id}
              className={cn(
                'rounded-xl px-1 py-1.5 text-[11px] font-semibold transition-colors',
                meal === m.id ? 'bg-card text-ink shadow-sm' : 'text-ink-2',
              )}
            >
              <span aria-hidden className="mr-0.5">
                {m.emoji}
              </span>
              {m.labelRu}
            </button>
          ))}
        </div>

        {/* Поиск по каталогу */}
        <div className="relative mb-2">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Найти блюдо в каталоге…"
            autoFocus
            className="w-full rounded-2xl border border-line bg-card py-2.5 pr-3 pl-9 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
        </div>

        <ul className="mb-3 space-y-1">
          {results.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() =>
                  add({
                    date,
                    meal,
                    kind,
                    dishId: d.id,
                    name: d.nameRu,
                    kcal: d.kcal,
                    p: d.bju.p,
                    f: d.bju.f,
                    c: d.bju.c,
                  })
                }
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-soft"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{d.nameRu}</span>
                <span className="text-xs text-ink-3">{d.kcal} ккал</span>
                <Plus size={15} className="shrink-0 text-accent" />
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="rounded-xl bg-soft px-3 py-2 text-xs text-ink-2">
              В каталоге ничего не нашлось — добавь вручную ниже
            </li>
          )}
        </ul>

        {/* Ручной ввод (свой продукт или блюдо без рецепта) */}
        <div className="rounded-2xl border border-line bg-soft/50 p-3">
          <p className="mb-2 text-xs font-semibold text-ink-2">Своё блюдо или продукт:</p>
          <div className="flex gap-2">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Название"
              className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
            <input
              value={customKcal}
              onChange={(e) => setCustomKcal(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="ккал"
              className="w-20 shrink-0 rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={!customValid}
            onClick={() => add({ date, meal, kind, name: customName.trim(), kcal: kcalNum })}
            className="mt-2 w-full rounded-xl bg-accent py-2 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-40"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Экран: Дневник + План
// ============================================================================

export default function DiaryScreen() {
  const diary = useAppStore((s) => s.diary);
  const kcalTarget = useAppStore((s) => s.kcalTarget);
  const setKcalTarget = useAppStore((s) => s.setKcalTarget);
  const removeDiaryEntry = useAppStore((s) => s.removeDiaryEntry);
  const planToDiary = useAppStore((s) => s.planToDiary);
  const addDiaryEntry = useAppStore((s) => s.addDiaryEntry);
  const addToShoppingList = useAppStore((s) => s.addToShoppingList);
  const isPro = useAppStore((s) => s.userProfile.isPro);
  const togglePro = useAppStore((s) => s.togglePro);
  const pantry = useAppStore((s) => s.pantry);

  const [tab, setTab] = useState<'diary' | 'plan'>('diary');
  const [selectedDate, setSelectedDate] = useState(() => isoOf(new Date()));
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetDraft, setTargetDraft] = useState('');
  const [picker, setPicker] = useState<{ open: boolean; date: string; kind: 'eaten' | 'planned' }>({
    open: false,
    date: '',
    kind: 'eaten',
  });

  const todayIso = isoOf(new Date());
  const week = useMemo(() => weekOf(selectedDate), [selectedDate]);

  const eatenToday = useMemo(
    () => diary.filter((e) => e.kind === 'eaten' && e.date === selectedDate),
    [diary, selectedDate],
  );
  const kcalToday = eatenToday.reduce((a, e) => a + e.kcal, 0);
  const pToday = eatenToday.reduce((a, e) => a + (e.p ?? 0), 0);
  const fToday = eatenToday.reduce((a, e) => a + (e.f ?? 0), 0);
  const cToday = eatenToday.reduce((a, e) => a + (e.c ?? 0), 0);

  const dayKcal = (iso: string, kind: 'eaten' | 'planned') =>
    diary.filter((e) => e.kind === kind && e.date === iso).reduce((a, e) => a + e.kcal, 0);

  const weekEaten = week.map((iso) => dayKcal(iso, 'eaten'));
  const chartScale = Math.max(kcalTarget, ...weekEaten, 1);
  const targetPct = Math.round((kcalTarget / chartScale) * 100);
  const progressPct = Math.min(100, Math.round((kcalToday / Math.max(kcalTarget, 1)) * 100));
  const overTarget = kcalToday > kcalTarget;
  const leftToday = kcalTarget - kcalToday;

  const openPicker = (date: string, kind: 'eaten' | 'planned') => setPicker({ open: true, date, kind });

  const saveTarget = () => {
    const n = Number(targetDraft);
    if (Number.isFinite(n) && n > 0) setKcalTarget(n);
    setEditingTarget(false);
  };

  const plannedFor = (iso: string) => diary.filter((e) => e.kind === 'planned' && e.date === iso);

  // ================= Автоплан недели (PRO) и авто-корзина =================
  const [planInfo, setPlanInfo] = useState<string | null>(null);
  const [showPlannerPitch, setShowPlannerPitch] = useState(false);

  /** Заполнить пустые слоты недели: завтрак ~25%, обед ~35%, ужин ~40% от цели */
  const autoPlanWeek = () => {
    setShowPlannerPitch(false);
    const used = new Set(
      diary
        .filter((e) => e.kind === 'planned' && week.includes(e.date) && e.dishId)
        .map((e) => e.dishId as string),
    );
    // В план попадают только бесплатные рецепты: у Лайта они должны открываться
    const pool = DISHES.filter((d) => d.tier !== 'pro');
    const pickBest = (cats: Dish['category'][], targetKcal: number): Dish | null => {
      const candidates = pool.filter((d) => cats.includes(d.category) && !used.has(d.id));
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => Math.abs(a.kcal - targetKcal) - Math.abs(b.kcal - targetKcal));
      const top = candidates.slice(0, Math.min(5, candidates.length));
      const chosen = top[Math.floor(Math.random() * top.length)];
      used.add(chosen.id);
      return chosen;
    };
    const entry = (iso: string, meal: MealSlot, d: Dish) =>
      addDiaryEntry({
        date: iso,
        meal,
        kind: 'planned',
        dishId: d.id,
        name: d.nameRu,
        kcal: d.kcal,
        p: d.bju.p,
        f: d.bju.f,
        c: d.bju.c,
      });
    let added = 0;
    for (const iso of week) {
      const planned = plannedFor(iso);
      const has = (m: MealSlot) => planned.some((e) => e.meal === m);
      if (!has('breakfast')) {
        const d = pickBest(['breakfast'], kcalTarget * 0.25);
        if (d) { entry(iso, 'breakfast', d); added++; }
      }
      if (!has('lunch')) {
        const d = pickBest(['chicken', 'meat', 'fish', 'veg', 'soups', 'salads'], kcalTarget * 0.35);
        if (d) { entry(iso, 'lunch', d); added++; }
      }
      if (!has('dinner')) {
        const d = pickBest(['chicken', 'meat', 'fish', 'veg', 'soups', 'salads'], kcalTarget * 0.4);
        if (d) { entry(iso, 'dinner', d); added++; }
      }
    }
    setPlanInfo(
      added > 0
        ? `Неделя заполнена: +${added} ${pluralRu(added, 'блюдо', 'блюда', 'блюд')} под цель ${kcalTarget} ккал. Проверь и поправь руками — план не догма`
        : 'Все слоты недели уже заполнены — сначала очисти то, что не нужно',
    );
    window.setTimeout(() => setPlanInfo(null), 6000);
  };

  /** Авто-корзина: недостающие ингредиенты всего плана → единый список покупок */
  const buildWeekShoppingList = () => {
    const planned = diary.filter(
      (e) => e.kind === 'planned' && week.includes(e.date) && e.dishId,
    );
    const seen = new Set<string>();
    const items: Array<{ name: string; qty?: string; dishId?: string }> = [];
    for (const e of planned) {
      const d = DISHES.find((x) => x.id === e.dishId);
      if (!d) continue;
      for (const ing of d.ingredients) {
        if (coveredBy(ing.name, pantry)) continue; // уже дома — не покупаем
        const key = ing.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({
          name: ing.name,
          qty:
            ing.qty !== undefined
              ? [formatAmount(ing.qty), ing.unit].filter(Boolean).join(' ')
              : ing.note,
          dishId: d.id,
        });
      }
    }
    addToShoppingList(items);
    setPlanInfo(
      items.length > 0
        ? `В список покупок добавлено ${items.length} ${pluralRu(items.length, 'продукт', 'продукта', 'продуктов')} — то, что уже в запасах, вычтено`
        : 'Всё из плана уже есть в запасах — покупки не нужны',
    );
    window.setTimeout(() => setPlanInfo(null), 6000);
  };

  return (
    <div>
      {/* Шапка */}
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink">
          <NotebookPen size={22} className="text-accent" />
          Дневник питания
        </h1>
        <p className="text-xs text-ink-2">Калории по дням и неделям, план на неделю</p>
      </header>

      {/* Переключатель Дневник / План */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-soft p-1">
        <button
          type="button"
          onClick={() => setTab('diary')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors',
            tab === 'diary' ? 'bg-card text-ink shadow-sm' : 'text-ink-2',
          )}
        >
          <NotebookPen size={15} />
          Дневник
        </button>
        <button
          type="button"
          onClick={() => setTab('plan')}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors',
            tab === 'plan' ? 'bg-card text-ink shadow-sm' : 'text-ink-2',
          )}
        >
          <CalendarDays size={15} />
          План
        </button>
      </div>

      {/* Лента недели */}
      <div className="mb-4 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedDate(addDaysIso(selectedDate, -7))}
          aria-label="Предыдущая неделя"
          className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-ink-2 hover:text-ink"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex min-w-0 flex-1 justify-between gap-1">
          {week.map((iso) => (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDate(iso)}
              aria-pressed={iso === selectedDate}
              className={cn(
                'flex flex-1 flex-col items-center rounded-xl border py-1.5 transition-colors',
                iso === selectedDate
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-line bg-card text-ink-2 hover:border-ink-3',
              )}
            >
              <span className="text-[10px] font-medium">{wdShort(iso)}</span>
              <span
                className={cn(
                  'text-sm font-bold',
                  iso === todayIso && iso !== selectedDate && 'text-accent',
                )}
              >
                {dayNum(iso)}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSelectedDate(addDaysIso(selectedDate, 7))}
          aria-label="Следующая неделя"
          className="flex h-9 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-card text-ink-2 hover:text-ink"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {tab === 'diary' ? (
        <>
          {/* Итоги дня */}
          <section className="rounded-3xl border border-line bg-card p-4 shadow-sm" aria-label="Итоги дня">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-ink-2">
                  {selectedDate === todayIso ? 'Сегодня' : `${wdShort(selectedDate)}, ${dayNum(selectedDate)}`} ·
                  съедено
                </p>
                <p className="mt-0.5 text-2xl font-bold text-ink">
                  {kcalToday}
                  <span className="ml-1 text-sm font-medium text-ink-3">/ {kcalTarget} ккал</span>
                </p>
              </div>
              {editingTarget ? (
                <div className="flex items-center gap-1.5">
                  <input
                    value={targetDraft}
                    onChange={(e) => setTargetDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric"
                    aria-label="Новая цель калорий"
                    className="w-20 rounded-xl border border-line bg-soft px-2.5 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={saveTarget}
                    aria-label="Сохранить цель"
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-on-accent hover:bg-accent-strong"
                  >
                    <Check size={14} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTargetDraft(String(kcalTarget));
                    setEditingTarget(true);
                  }}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-soft px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:text-ink"
                >
                  <Pencil size={12} />
                  Цель
                </button>
              )}
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-soft">
              <div
                className={cn('h-full rounded-full transition-all', overTarget ? 'bg-red-400' : 'bg-accent')}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-ink-2">
              {overTarget
                ? `${kcalToday - kcalTarget} ккал больше цели`
                : `${leftToday} ккал осталось до цели`}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: 'Белки', value: `${pToday} г` },
                { label: 'Жиры', value: `${fToday} г` },
                { label: 'Углев.', value: `${cToday} г` },
              ].map((t) => (
                <div key={t.label} className="rounded-xl bg-soft px-2 py-2 text-center">
                  <p className="text-sm font-bold text-ink">{t.value}</p>
                  <p className="text-[10px] text-ink-2">{t.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Недельный график */}
          <section className="mt-4 rounded-3xl border border-line bg-card p-4 shadow-sm" aria-label="Калории за неделю">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
              <Flame size={15} className="text-accent" />
              Неделя: съеденные ккал
            </h2>
            <div className="relative flex h-24 items-end gap-1.5">
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/70"
                style={{ bottom: `${targetPct}%` }}
                title={`Цель: ${kcalTarget} ккал`}
              />
              {week.map((iso, i) => {
                const kcal = weekEaten[i];
                const pct = Math.max(3, Math.round((kcal / chartScale) * 100));
                return (
                  <div key={iso} className="flex h-full flex-1 items-end" title={`${wdShort(iso)}: ${kcal} ккал`}>
                    <div
                      className={cn(
                        'w-full rounded-t-md',
                        iso === selectedDate ? 'bg-accent' : 'bg-accent/40',
                      )}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {week.map((iso) => (
                <span
                  key={iso}
                  className={cn(
                    'flex-1 text-center text-[10px]',
                    iso === selectedDate ? 'font-bold text-ink' : 'text-ink-3',
                  )}
                >
                  {wdShort(iso)}
                </span>
              ))}
            </div>
          </section>

          {/* Приёмы пищи */}
          {MEALS.map((m) => {
            const items = eatenToday.filter((e) => e.meal === m.id);
            const sum = items.reduce((a, e) => a + e.kcal, 0);
            return (
              <section key={m.id} className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
                    <span aria-hidden>{m.emoji}</span>
                    {m.labelRu}
                  </h3>
                  <span className="text-xs text-ink-2">{sum} ккал</span>
                </div>
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-ink-3">
                    Пусто — запиши блюдо кнопкой ниже
                  </p>
                ) : (
                  <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                    {items.map((e) => (
                      <li key={e.id} className="flex items-center gap-2 px-3.5 py-2.5">
                        {e.dishId ? (
                          <Link
                            to={`/dish/${e.dishId}`}
                            className="min-w-0 flex-1 truncate text-sm text-ink hover:text-accent"
                          >
                            {e.name}
                          </Link>
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-sm text-ink">{e.name}</span>
                        )}
                        <span className="shrink-0 text-xs text-ink-3">{e.kcal} ккал</span>
                        <button
                          type="button"
                          onClick={() => removeDiaryEntry(e.id)}
                          aria-label={`Убрать «${e.name}» из дневника`}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-soft hover:text-ink"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          <button
            type="button"
            onClick={() => openPicker(selectedDate, 'eaten')}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong"
          >
            <Plus size={16} />
            Записать блюдо за {wdShort(selectedDate).toLowerCase()}, {dayNum(selectedDate)}
          </button>
        </>
      ) : (
        /* ================= ПЛАН НА НЕДЕЛЮ ================= */
        <>
          <p className="mb-3 text-xs text-ink-2">
            Запланируй блюда на каждый день — потом переноси в дневник одним нажатием ✓
          </p>

          {/* Автоплан (PRO) и единый список покупок на неделю */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => (isPro ? autoPlanWeek() : setShowPlannerPitch(true))}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-semibold transition-colors',
                isPro ? 'bg-accent text-on-accent hover:bg-accent-strong' : 'bg-soft text-ink-2 hover:text-ink',
              )}
            >
              {isPro ? <Sparkles size={14} /> : <Crown size={14} className="fill-current" />}
              {isPro ? 'Заполнить неделю' : 'Автоплан · PRO'}
            </button>
            <button
              type="button"
              onClick={buildWeekShoppingList}
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-line bg-card py-2.5 text-xs font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              <ShoppingBasket size={14} className="text-accent" />
              Список на неделю
            </button>
          </div>
          {planInfo && (
            <p
              className="mb-3 rounded-xl border border-good/30 bg-good/10 px-3 py-2 text-[11px] font-medium text-good"
              role="status"
            >
              {planInfo}
            </p>
          )}
          {showPlannerPitch && (
            <div className="mb-3 rounded-2xl border border-pro/30 bg-card p-4">
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <Crown size={15} className="fill-current text-pro" />
                Автоплан на 7 дней
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">
                Сразу завтрак, обед и ужин на всю неделю под твою цель калорий — а затем одной
                кнопкой единый список покупок с вычетом того, что уже в Кладовой.
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={togglePro}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-pro py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Включить PRO (тест)
                </button>
                <button
                  type="button"
                  onClick={() => setShowPlannerPitch(false)}
                  className="rounded-xl border border-line bg-card py-2 text-xs font-semibold text-ink-2 transition-colors hover:text-ink"
                >
                  Позже
                </button>
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {week.map((iso) => {
              const planned = plannedFor(iso);
              const sum = planned.reduce((a, e) => a + e.kcal, 0);
              return (
                <section
                  key={iso}
                  className={cn(
                    'rounded-2xl border p-3.5',
                    iso === todayIso ? 'border-accent/50 bg-card shadow-sm' : 'border-line bg-card',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-bold text-ink">
                      {wdShort(iso)}, {dayNum(iso)}
                      {iso === todayIso && (
                        <span className="ml-1.5 text-[10px] font-semibold text-accent">сегодня</span>
                      )}
                    </p>
                    <p className="text-xs text-ink-2">{sum} ккал</p>
                  </div>
                  {planned.length === 0 ? (
                    <p className="text-xs text-ink-3">Пока ничего не запланировано</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {planned.map((e) => (
                        <li
                          key={e.id}
                          className="flex items-center gap-1.5 rounded-xl bg-soft px-2.5 py-1.5"
                        >
                          <span aria-hidden className="text-xs">
                            {mealMeta(e.meal).emoji}
                          </span>
                          {e.dishId ? (
                            <Link
                              to={`/dish/${e.dishId}`}
                              className="min-w-0 flex-1 truncate text-xs font-medium text-ink hover:text-accent"
                            >
                              {e.name}
                            </Link>
                          ) : (
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
                              {e.name}
                            </span>
                          )}
                          <span className="shrink-0 text-[11px] text-ink-3">{e.kcal}</span>
                          <button
                            type="button"
                            onClick={() => planToDiary(e.id)}
                            aria-label={`Отметить «${e.name}» съеденным`}
                            title="Съедено — в дневник"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-good/10 text-good transition-colors hover:bg-good hover:text-white"
                          >
                            <Check size={12} strokeWidth={3} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeDiaryEntry(e.id)}
                            aria-label={`Убрать «${e.name}» из плана`}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-red-500/10 hover:text-red-500"
                          >
                            <X size={12} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => openPicker(iso, 'planned')}
                    className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-line py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:border-accent hover:text-accent"
                  >
                    <Plus size={13} />
                    Запланировать
                  </button>
                </section>
              );
            })}
          </div>
        </>
      )}

      <DishPicker
        open={picker.open}
        date={picker.date}
        kind={picker.kind}
        onClose={() => setPicker((p) => ({ ...p, open: false }))}
      />
    </div>
  );
}
