import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { CATEGORY_META, type Dish } from '../data/dishes';
import { useAppStore } from '../store/useAppStore';
import { cn, formatKcal } from '../lib/utils';

/**
 * Фото блюда с graceful-fallback: если AI-фото ещё не сгенерировано
 * или не загрузилось — показываем красивый градиент с эмодзи категории.
 */
export function DishImage({ dish, className }: { dish: Dish; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-brand-100 via-brand-50 to-brand-200',
          className,
        )}
        role="img"
        aria-label={dish.nameRu}
      >
        <span className="text-4xl drop-shadow-sm">{CATEGORY_META[dish.category].emoji}</span>
      </div>
    );
  }

  return (
    <img
      src={dish.image}
      alt={dish.nameRu}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  );
}

export default function DishCard({ dish }: { dish: Dish }) {
  const isFav = useAppStore((s) => s.favorites.includes(dish.id));
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);

  return (
    <Link
      to={`/dish/${dish.id}`}
      className="group block overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative">
        <DishImage dish={dish} className="aspect-[4/3] w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          {formatKcal(dish.kcal)}
        </span>
        <button
          type="button"
          aria-label={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
          aria-pressed={isFav}
          onClick={(e) => {
            // не даём сердечку открыть сам рецепт
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(dish.id);
          }}
          className={cn(
            'absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition-colors',
            isFav ? 'bg-white text-brand-600' : 'bg-black/40 text-white hover:bg-black/60',
          )}
        >
          <Heart size={16} className={cn(isFav && 'fill-current')} />
        </button>
      </div>
      <div className="p-3">
        <p className="text-sm leading-snug font-semibold text-stone-900">{dish.nameEn}</p>
        <p className="mt-0.5 truncate text-xs text-stone-500">{dish.nameRu}</p>
      </div>
    </Link>
  );
}
