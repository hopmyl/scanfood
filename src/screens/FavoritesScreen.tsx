import { Link } from 'react-router-dom';
import { Heart, ShoppingBasket } from 'lucide-react';
import { DISHES } from '../data/dishes';
import DishCard from '../components/DishCard';
import { useAppStore } from '../store/useAppStore';
import { pluralRu } from '../lib/utils';

export default function FavoritesScreen() {
  const favorites = useAppStore((s) => s.favorites);

  const favDishes = DISHES.filter((d) => favorites.includes(d.id));

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight text-ink">Избранное</h1>
        <p className="text-xs text-ink-2">
          {favDishes.length > 0
            ? `${favDishes.length} ${pluralRu(favDishes.length, 'рецепт', 'рецепта', 'рецептов')} в избранном`
            : 'Сохраняй рецепты одним нажатием'}
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
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-soft/50 py-10 text-center">
          <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Heart size={24} />
          </span>
          <p className="text-sm font-medium text-ink">Пока пусто</p>
          <p className="mt-1 text-xs text-ink-2">Жми на сердечко на карточке блюда</p>
        </div>
      )}

      {/* ---------- Переход к списку покупок ---------- */}
      <Link
        to="/shopping"
        className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-line bg-card py-3 text-sm font-semibold text-ink transition-colors hover:bg-soft"
      >
        <ShoppingBasket size={17} className="text-accent" />
        Открыть список покупок
      </Link>
    </div>
  );
}
