import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, Check, CookingPot, Plus, X } from 'lucide-react';
import { SHELF_POOL } from '../data/dishes';
import { emojiFor, matchDishes } from '../lib/match';
import DishCard from '../components/DishCard';
import { useAppStore } from '../store/useAppStore';
import { cn, daysLeft, pluralRu } from '../lib/utils';

function Jar({
  name,
  expiresIn,
  onRemove,
  onSetExpiry,
}: {
  name: string;
  expiresIn: number | null;
  onRemove: () => void;
  onSetExpiry: () => void;
}) {
  const emoji = emojiFor(name);
  const dotClass =
    expiresIn === null
      ? null
      : expiresIn < 0
        ? 'bg-red-500'
        : expiresIn <= 1
          ? 'bg-red-400'
          : expiresIn <= 7
            ? 'bg-amber-400'
            : 'bg-emerald-400';
  const dotLabel =
    expiresIn === null
      ? ''
      : expiresIn < 0
        ? 'Просрочено'
        : expiresIn === 0
          ? 'Истекает сегодня'
          : expiresIn === 1
            ? '1 день'
            : `${expiresIn} дн.`;

  return (
    <div className="group relative flex w-full max-w-[68px] flex-col items-center">
      {/* крышка */}
      <span className="h-2 w-11 rounded-t-md bg-gradient-to-b from-zinc-200 to-zinc-500 shadow-sm" />
      {/* корпус */}
      <button
        type="button"
        onClick={onSetExpiry}
        aria-label={`Срок годности «${name}»`}
        className={cn(
          'relative flex h-14 w-14 flex-col items-center justify-center rounded-b-lg rounded-t-sm',
          'bg-gradient-to-b from-white/25 to-white/5 ring-1 ring-white/25',
          'shadow-[inset_0_-6px_12px_rgba(0,0,0,0.25)] transition-transform active:scale-95',
        )}
      >
        <span className="text-xl leading-none drop-shadow" aria-hidden>
          {emoji}
        </span>
        {/* Фиксированный слот под 2 строки: баночки строго одинаковые,
            длинные названия («Крабовые палочки») переносятся, а не обрезаются */}
        <span className="mt-1 flex h-[22px] w-[54px] items-center justify-center">
          <span
            title={name}
            className="line-clamp-2 rounded-sm bg-amber-100/95 px-1 text-center text-[8px] leading-[1.25] font-semibold text-amber-900"
          >
            {name}
          </span>
        </span>
        {dotClass && (
          <span
            title={`Срок годности: ${dotLabel}`}
            className={cn('absolute top-1 left-1 h-2 w-2 rounded-full shadow', dotClass)}
          />
        )}
      </button>
      {/* убрать из запасов */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Убрать «${name}» из запасов`}
        className="absolute -top-1.5 -right-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800/85 text-zinc-200 opacity-70 transition-opacity hover:opacity-100"
      >
        <X size={11} strokeWidth={3} />
      </button>
    </div>
  );
}

export default function PantryScreen() {
  const pantry = useAppStore((s) => s.pantry);
  const pantryExpiry = useAppStore((s) => s.pantryExpiry);
  const setPantryExpiry = useAppStore((s) => s.setPantryExpiry);
  const addToPantry = useAppStore((s) => s.addToPantry);
  const removeFromPantry = useAppStore((s) => s.removeFromPantry);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [addedNames, setAddedNames] = useState<string[]>([]);
  /** Продукт, для которого открыт диалог срока годности */
  const [expiryFor, setExpiryFor] = useState<string | null>(null);
  const [expiryDraft, setExpiryDraft] = useState('');

  const match = useMemo(() => matchDishes(pantry), [pantry]);

  /** Скоропорт: продукт → дней осталось (только <= 7 дней, сортировка по срочности) */
  const expiringSoon = useMemo(
    () =>
      Object.entries(pantryExpiry)
        .filter(([name]) => pantry.includes(name))
        .map(([name, iso]) => ({ name, days: daysLeft(iso) }))
        .filter((e): e is { name: string; days: number } => e.days !== null && e.days <= 7)
        .sort((a, b) => a.days - b.days),
    [pantryExpiry, pantry],
  );

  /** Блюда из запасов, в которых участвует скоропорт */
  const useFirstDishes = useMemo(() => {
    if (expiringSoon.length === 0) return [];
    const soon = new Set(expiringSoon.map((e) => e.name.toLowerCase()));
    return match.canCook
      .filter((d) => d.ingredients.some((i) => soon.has(i.name.toLowerCase())))
      .slice(0, 4);
  }, [match, expiringSoon]);

  const openExpiryDialog = (name: string) => {
    setExpiryFor(name);
    setExpiryDraft(pantryExpiry[name] ?? '');
  };

  const saveExpiry = () => {
    if (!expiryFor) return;
    setPantryExpiry(expiryFor, expiryDraft || undefined);
    setExpiryFor(null);
  };

  const suggestable = SHELF_POOL.filter((p) => !pantry.includes(p));

  /** раскладываем баночки по полкам — по 4 штуки */
  const shelves: string[][] = [];
  for (let i = 0; i < pantry.length; i += 4) shelves.push(pantry.slice(i, i + 4));

  const addMissing = (ingredient: string) => {
    addToPantry([ingredient]);
    setAddedNames((prev) => [...prev, ingredient]);
  };

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-ink">Запасы дома</h1>
        <p className="text-xs text-ink-2">
          {pantry.length} {pluralRu(pantry.length, 'баночка', 'баночки', 'баночек')} в шкафчике —
          из них подбираются рецепты
        </p>
      </header>

      {/* ===== Шкафчик ===== */}
      <div className="overflow-hidden rounded-3xl border-[6px] border-amber-950 bg-gradient-to-b from-amber-900 via-amber-950 to-amber-900 shadow-xl">
        {/* верх шкафчика */}
        <div className="flex items-center justify-between bg-amber-950/60 px-4 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-amber-100/90 uppercase">
            🫙 Кухонный шкафчик
          </span>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-950 transition-colors hover:bg-amber-200"
          >
            <Plus size={12} strokeWidth={3} />
            Пополнить
          </button>
        </div>

        {/* полки с банками */}
        <div className="px-4 pt-4 pb-1">
          {shelves.length > 0 ? (
            shelves.map((shelf, i) => (
              <div key={i}>
                <div className="grid min-h-24 grid-cols-4 items-end justify-items-center gap-2 px-1">
                  {shelf.map((name) => (
                    <Jar
                      key={name}
                      name={name}
                      expiresIn={pantryExpiry[name] ? daysLeft(pantryExpiry[name]) : null}
                      onRemove={() => removeFromPantry(name)}
                      onSetExpiry={() => openExpiryDialog(name)}
                    />
                  ))}
                </div>
                {/* доска полки */}
                <div className="mt-1 mb-2 h-2.5 rounded-sm bg-gradient-to-b from-amber-800 to-amber-950 shadow-[0_3px_6px_rgba(0,0,0,0.45)]" />
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-amber-100/70">
              Шкафчик пуст — пополни запасы кнопкой «Пополнить»
            </p>
          )}
        </div>
      </div>

      {/* ===== Диалог срока годности ===== */}
      {expiryFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-24 sm:items-center sm:pb-4">
          <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-5 shadow-xl">
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-2xl">
                {emojiFor(expiryFor)}
              </span>
              <h3 className="text-base font-bold text-ink">Срок годности: {expiryFor}</h3>
            </div>
            <p className="mt-1 text-xs text-ink-2">
              Когда продукт испортится — подскажем, что из него приготовить
            </p>
            <input
              type="date"
              value={expiryDraft}
              onChange={(e) => setExpiryDraft(e.target.value)}
              className="mt-3 w-full rounded-2xl border border-line bg-soft px-4 py-3 text-sm text-ink outline-none focus:border-accent"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={saveExpiry}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-accent py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong"
              >
                <Check size={15} strokeWidth={3} />
                Сохранить
              </button>
              {pantryExpiry[expiryFor] && (
                <button
                  type="button"
                  onClick={() => {
                    setPantryExpiry(expiryFor, undefined);
                    setExpiryFor(null);
                  }}
                  className="rounded-2xl border border-line bg-card px-4 py-3 text-sm font-semibold text-ink-2 transition-colors hover:text-ink"
                >
                  Убрать
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpiryFor(null)}
                aria-label="Закрыть"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-card text-ink-2 transition-colors hover:text-ink"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Скоро испортится ===== */}
      {expiringSoon.length > 0 && (
        <section className="mt-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-3.5 dark:border-amber-500/30 dark:bg-amber-950/30">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-amber-900 dark:text-amber-200">
            <AlarmClock size={16} />
            Скоро испортится
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {expiringSoon.map((e) => (
              <button
                key={e.name}
                type="button"
                onClick={() => openExpiryDialog(e.name)}
                className={cn(
                  'flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold',
                  e.days < 0
                    ? 'bg-red-500 text-white'
                    : e.days <= 1
                      ? 'bg-red-400 text-white'
                      : 'bg-amber-400 text-amber-950',
                )}
              >
                <span aria-hidden>{emojiFor(e.name)}</span>
                {e.name}
                {e.days < 0 ? ' · просрочено' : ` · ${e.days === 0 ? 'сегодня' : `${pluralRu(e.days, 'день', 'дня', 'дней')}`}`}
              </button>
            ))}
          </div>
          {useFirstDishes.length > 0 && (
            <p className="mt-2 text-xs text-amber-900/90 dark:text-amber-200/90">
              Приготовь из этого:{' '}
              {useFirstDishes.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ', '}
                  <Link
                    to={`/dish/${d.id}`}
                    className="font-semibold underline decoration-amber-500/50 underline-offset-2 transition-colors hover:text-amber-700 dark:hover:text-amber-100"
                  >
                    {d.nameRu}
                  </Link>
                </span>
              ))}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-amber-900/60 dark:text-amber-200/60">
            Нажми на баночку в шкафчике, чтобы указать срок годности
          </p>
        </section>
      )}
      {pickerOpen && (
        <section className="mt-3 rounded-2xl border border-line bg-card p-3.5">
          <p className="mb-2 text-xs font-semibold text-ink-2">Нажми на баночку, чтобы добавить:</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestable.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => addToPantry([p])}
                className="flex items-center gap-1 rounded-full border border-line bg-soft px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
              >
                <span aria-hidden>{emojiFor(p)}</span>
                {p}
              </button>
            ))}
            {suggestable.length === 0 && (
              <p className="text-xs text-ink-3">Все продукты из подборки уже в запасах 🎉</p>
            )}
          </div>
        </section>
      )}

      {/* ===== Что приготовить из запасов ===== */}
      <section className="mt-6">
        <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-ink">
          <CookingPot size={18} className="text-good" />
          Из запасов можно приготовить
        </h2>
        <p className="mb-3 text-xs text-ink-2">
          Считаются и запасы шкафчика, и базовые специи с маслом
        </p>

        {match.canCook.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {match.canCook.map((dish) => (
              <DishCard key={dish.id} dish={dish} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-4 text-center text-xs text-ink-2">
            Пока ни одного полного совпадения — добавь что-то из подсказок ниже
          </p>
        )}

        {match.missingGroups.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-bold text-ink">Не хватает одного продукта</h3>
            <div className="space-y-2.5">
              {match.missingGroups.slice(0, 6).map((g) => {
                const added = addedNames.includes(g.ingredient);
                return (
                  <div
                    key={g.ingredient}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-3.5"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <span aria-hidden className="text-lg">
                          {g.emoji}
                        </span>
                        Добавь: {g.ingredient}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-2">
                        откроется {g.dishes.length}{' '}
                        {pluralRu(g.dishes.length, 'рецепт', 'рецепта', 'рецептов')}:{' '}
                        {g.dishes
                          .slice(0, 2)
                          .map((d) => d.nameRu)
                          .join(', ')}
                        {g.dishes.length > 2 ? '…' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addMissing(g.ingredient)}
                      className={cn(
                        'flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
                        added ? 'bg-good/10 text-good' : 'bg-accent text-on-accent hover:bg-accent-strong',
                      )}
                    >
                      {added ? <Check size={12} strokeWidth={3} /> : <Plus size={12} />}
                      {added ? 'В запасах' : 'В запасы'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
