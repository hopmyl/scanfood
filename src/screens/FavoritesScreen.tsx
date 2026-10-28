import { Check, Heart, ShoppingBasket, Trash2 } from 'lucide-react';
import { DISHES } from '../data/dishes';
import DishCard from '../components/DishCard';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

export default function FavoritesScreen() {
  const favorites = useAppStore((s) => s.favorites);
  const shoppingList = useAppStore((s) => s.shoppingList);
  const toggleShoppingItem = useAppStore((s) => s.toggleShoppingItem);
  const removeShoppingItem = useAppStore((s) => s.removeShoppingItem);
  const clearShoppingList = useAppStore((s) => s.clearShoppingList);

  const favDishes = DISHES.filter((d) => favorites.includes(d.id));

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-stone-900">Избранное</h1>
        <p className="text-xs text-stone-500">
          {favDishes.length > 0 ? `${favDishes.length} в избранном · ${shoppingList.length} в списке покупок` : 'Сохраняй рецепты одним нажатием'}
        </p>
      </header>

      {/* ---------- Избранные рецепты ---------- */}
      {favDishes.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {favDishes.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white/60 py-10 text-center">
          <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-400">
            <Heart size={24} />
          </span>
          <p className="text-sm font-medium text-stone-700">Пока пусто</p>
          <p className="mt-1 text-xs text-stone-500">Жми на сердечко на карточке блюда</p>
        </div>
      )}

      {/* ---------- Список покупок ---------- */}
      <section className="mt-7">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-stone-900">
            <ShoppingBasket size={18} className="text-brand-600" />
            Список покупок
          </h2>
          {shoppingList.length > 0 && (
            <button
              type="button"
              onClick={clearShoppingList}
              className="text-xs font-medium text-stone-400 transition-colors hover:text-red-500"
            >
              Очистить всё
            </button>
          )}
        </div>

        {shoppingList.length > 0 ? (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
            {shoppingList.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleShoppingItem(item.id)}
                  aria-label={item.done ? 'Вернуть в список' : 'Отметить купленным'}
                  aria-pressed={item.done}
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    item.done ? 'border-pro-500 bg-pro-500 text-white' : 'border-stone-300 hover:border-brand-400',
                  )}
                >
                  {item.done && <Check size={13} strokeWidth={3} />}
                </button>
                <span className={cn('flex-1 text-sm', item.done ? 'text-stone-400 line-through' : 'text-stone-700')}>
                  {item.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeShoppingItem(item.id)}
                  aria-label={`Удалить «${item.name}»`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-300 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-4 py-5 text-center text-xs text-stone-500">
            Открой любой рецепт и добавь ингредиенты кнопкой «+»
          </p>
        )}
      </section>
    </div>
  );
}
