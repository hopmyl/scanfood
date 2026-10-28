import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Plus, ShoppingBasket, Trash2 } from 'lucide-react';
import { DISHES } from '../data/dishes';
import { useAppStore, type ShoppingItem } from '../store/useAppStore';
import { cn } from '../lib/utils';

export default function ShoppingScreen() {
  const shoppingList = useAppStore((s) => s.shoppingList);
  const toggleShoppingItem = useAppStore((s) => s.toggleShoppingItem);
  const removeShoppingItem = useAppStore((s) => s.removeShoppingItem);
  const removeDoneFromShoppingList = useAppStore((s) => s.removeDoneFromShoppingList);
  const clearShoppingList = useAppStore((s) => s.clearShoppingList);
  const addToShoppingList = useAppStore((s) => s.addToShoppingList);

  const [customName, setCustomName] = useState('');

  const doneCount = shoppingList.filter((i) => i.done).length;
  const progress = shoppingList.length > 0 ? (doneCount / shoppingList.length) * 100 : 0;

  /** Группировка по рецепту-источнику; без источника — «Отдельные позиции» */
  const groups = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const item of shoppingList) {
      const key = item.dishId ?? '_';
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [shoppingList]);

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    addToShoppingList([{ name }]);
    setCustomName('');
  };

  return (
    <div>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Список покупок</h1>
          <p className="text-xs text-ink-2">
            {shoppingList.length > 0
              ? `Куплено ${doneCount} из ${shoppingList.length} · в магазине просто зачёркивай позиции`
              : 'Добавляй ингредиенты из рецептов — одним нажатием'}
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <ShoppingBasket size={22} />
        </span>
      </header>

      {/* Прогресс */}
      {shoppingList.length > 0 && (
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-soft">
          <div
            className="h-full rounded-full bg-pro transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Быстрое добавление */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustom()}
          placeholder="Своё: молоко, губка…"
          className="min-w-0 flex-1 rounded-2xl border border-line bg-card px-4 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customName.trim()}
          aria-label="Добавить в список"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-40"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Группы */}
      {shoppingList.length > 0 ? (
        <>
          <div className="space-y-4">
            {groups.map(([key, items]) => {
              const dish = key !== '_' ? DISHES.find((d) => d.id === key) : undefined;
              return (
                <section key={key}>
                  {dish ? (
                    <Link
                      to={`/dish/${dish.id}`}
                      className="mb-1.5 flex items-baseline gap-2 text-xs font-semibold text-accent hover:underline"
                    >
                      Для: {dish.nameRu}
                      <span className="font-normal text-ink-3">из «{dish.nameEn}» →</span>
                    </Link>
                  ) : (
                    <p className="mb-1.5 text-xs font-semibold text-ink-2">Отдельные позиции</p>
                  )}
                  <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                        {/* Тумблер-индикатор: куплено / не куплено */}
                        <button
                          type="button"
                          onClick={() => toggleShoppingItem(item.id)}
                          aria-label={item.done ? 'Вернуть в список' : 'Отметить купленным'}
                          aria-pressed={item.done}
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                            item.done
                              ? 'border-pro bg-pro text-white'
                              : 'border-line hover:border-accent',
                          )}
                        >
                          {item.done && <Check size={13} strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block text-sm',
                              item.done ? 'text-ink-3 line-through' : 'text-ink',
                            )}
                          >
                            {item.name}
                          </span>
                          {item.qty && !item.done && (
                            <span className="text-[11px] text-ink-2">{item.qty}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeShoppingItem(item.id)}
                          aria-label={`Удалить «${item.name}»`}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          {/* Действия */}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={removeDoneFromShoppingList}
              disabled={doneCount === 0}
              className="flex-1 rounded-2xl border border-line bg-card py-2.5 text-xs font-semibold text-ink-2 transition-colors hover:text-ink disabled:opacity-40"
            >
              Убрать купленное ({doneCount})
            </button>
            <button
              type="button"
              onClick={clearShoppingList}
              className="flex-1 rounded-2xl border border-line bg-card py-2.5 text-xs font-semibold text-ink-2 transition-colors hover:text-red-500"
            >
              Очистить всё
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line py-10 text-center">
          <span className="mb-2 text-4xl" aria-hidden>
            🛒
          </span>
          <p className="text-sm font-medium text-ink">Список пуст</p>
          <p className="mt-1 mb-4 max-w-56 text-xs text-ink-2">
            Открой рецепт и жми «Всё в список покупок» — количества подставятся по порциям
          </p>
          <div className="flex gap-2">
            <Link
              to="/"
              className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-on-accent transition-colors hover:bg-accent-strong"
            >
              К рецептам
            </Link>
            <Link
              to="/scan"
              className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              Скан холодильника
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
