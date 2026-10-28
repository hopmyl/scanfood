import { useMemo, useState } from 'react';
import { Check, CookingPot, Plus, X } from 'lucide-react';
import { PRODUCT_BY_NAME, SHELF_POOL } from '../data/dishes';
import { matchDishes } from '../lib/match';
import DishCard from '../components/DishCard';
import { useAppStore } from '../store/useAppStore';
import { cn, pluralRu } from '../lib/utils';

/** Высота баночки — чуть варьируем, чтобы полка выглядела живьём */
function jarHeight(name: string): string {
  const h = ['h-14', 'h-16', 'h-12'][name.length % 3];
  return h;
}

function Jar({ name, onRemove }: { name: string; onRemove: () => void }) {
  const emoji = PRODUCT_BY_NAME.get(name.toLowerCase())?.emoji ?? '🥫';
  return (
    <div className="group relative flex w-[68px] flex-col items-center">
      {/* крышка */}
      <span className="h-2 w-11 rounded-t-md bg-gradient-to-b from-zinc-200 to-zinc-500 shadow-sm" />
      {/* корпус */}
      <span
        className={cn(
          'flex w-14 flex-col items-center justify-center rounded-b-lg rounded-t-sm',
          'bg-gradient-to-b from-white/25 to-white/5 ring-1 ring-white/25',
          'shadow-[inset_0_-6px_12px_rgba(0,0,0,0.25)]',
          jarHeight(name),
        )}
      >
        <span className="text-xl leading-none drop-shadow" aria-hidden>
          {emoji}
        </span>
        <span
          title={name}
          className="mt-1 max-w-[58px] truncate rounded-sm bg-amber-100/95 px-1 py-px text-[8px] leading-tight font-semibold text-amber-900"
        >
          {name}
        </span>
      </span>
      {/* убрать из запасов */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Убрать «${name}» из запасов`}
        className="absolute -top-1.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800/85 text-zinc-200 opacity-70 transition-opacity hover:opacity-100"
      >
        <X size={11} strokeWidth={3} />
      </button>
    </div>
  );
}

export default function PantryScreen() {
  const pantry = useAppStore((s) => s.pantry);
  const addToPantry = useAppStore((s) => s.addToPantry);
  const removeFromPantry = useAppStore((s) => s.removeFromPantry);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [addedNames, setAddedNames] = useState<string[]>([]);

  const match = useMemo(() => matchDishes(pantry), [pantry]);

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
                <div className="flex min-h-24 items-end justify-start gap-3 px-1">
                  {shelf.map((name) => (
                    <Jar key={name} name={name} onRemove={() => removeFromPantry(name)} />
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

      {/* ===== Подборка «пополнить запасы» ===== */}
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
                <span aria-hidden>{PRODUCT_BY_NAME.get(p.toLowerCase())?.emoji ?? '🥫'}</span>
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
