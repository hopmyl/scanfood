import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock, Crown, Heart } from 'lucide-react';
import { CATEGORY_META, type Dish } from '../data/dishes';
import { canCookFrom } from '../lib/match';
import { useAppStore } from '../store/useAppStore';
import { cn, dishImgUrl, formatKcal } from '../lib/utils';

/**
 * Фото блюда с graceful-fallback: если AI-фото не загрузилось —
 * показываем красивый градиент с эмодзи категории.
 * Пока грузится — пульсирующий скелетон (карточки с lazy-фото не «мигают» пустотой).
 */
export function DishImage({ dish, className }: { dish: Dish; className?: string }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-accent-soft via-soft to-accent-soft',
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
    <span className={cn('relative block overflow-hidden bg-soft', className)}>
      {!loaded && (
        <span
          aria-hidden
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-accent-soft via-soft to-accent-soft"
        />
      )}
      <img
        src={dishImgUrl(dish.image)}
        alt={dish.nameRu}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </span>
  );
}

export default function DishCard({ dish }: { dish: Dish }) {
  const isFav = useAppStore((s) => s.favorites.includes(dish.id));
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const pantry = useAppStore((s) => s.pantry);
  const isPro = useAppStore((s) => s.userProfile.isPro);
  /** Авторское блюдо, ещё не открытое подпиской — видно в списке, рецепт с PRO */
  const proLocked = dish.tier === 'pro' && !isPro;

  // Блюдо целиком готовится из текущих запасов — показываем зелёный бейдж
  const cookable = useMemo(() => canCookFrom(dish, pantry), [dish, pantry]);

  return (
    <Link
      to={`/dish/${dish.id}`}
      className="group block overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative">
        <DishImage dish={dish} className="aspect-[4/3] w-full transition-transform duration-300 group-hover:scale-[1.03]" />
        <div className="absolute top-2 left-2 max-w-[calc(100%-52px)]">
          <span className="inline-block rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {formatKcal(dish.kcal)}
          </span>
        </div>
        {/* PRO-бейдж ровно один (раньше дублировался на карточках залоченных блюд) */}
        {dish.tier === 'pro' && (
          <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-pro/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            <Crown size={10} className="fill-current" />
            PRO
          </span>
        )}
        {cookable && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-good/90 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            <Check size={11} strokeWidth={3} />
            из запасов
          </span>
        )}
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
            'absolute top-2 right-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full backdrop-blur-sm transition-colors',
            isFav ? 'bg-card text-accent' : 'bg-black/40 text-white hover:bg-black/60',
          )}
        >
          <Heart size={16} className={cn(isFav && 'fill-current')} />
        </button>
      </div>
      <div className="p-3">
        {/* RU — основное название, EN — подзаголовок */}
        <p className="text-sm leading-snug font-semibold text-ink">{dish.nameRu}</p>
        <p className="mt-0.5 truncate text-xs text-ink-3">{dish.nameEn}</p>
        {/* Время переехало из оверлея фото: узкие карточки (2 колонки на 390px)
            раньше наезжали бейджами на сердечко и обрезались */}
        {dish.timeMin !== undefined && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-ink-2">
            <Clock size={11} aria-hidden />
            {dish.timeMin} мин
            {proLocked && (
              <span className="ml-auto flex items-center gap-0.5 text-[10px] font-bold text-pro-ink">
                <Crown size={10} className="fill-current" />
                PRO-рецепт
              </span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}
