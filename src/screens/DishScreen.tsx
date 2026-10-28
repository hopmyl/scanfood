import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Heart, Plus, ShoppingBasket } from 'lucide-react';
import { CATEGORY_META, DISHES } from '../data/dishes';
import { DishImage } from '../components/DishCard';
import { useAppStore } from '../store/useAppStore';
import { cn, formatKcal } from '../lib/utils';

export default function DishScreen() {
  const { id } = useParams<{ id: string }>();
  const dish = DISHES.find((d) => d.id === id);

  const isFav = useAppStore((s) => (dish ? s.favorites.includes(dish.id) : false));
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const addIngredients = useAppStore((s) => s.addIngredients);

  const [justAdded, setJustAdded] = useState(false);

  if (!dish) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <span className="mb-3 text-5xl" aria-hidden>
          🥲
        </span>
        <h1 className="mb-1 text-lg font-bold text-stone-900">Рецепт не найден</h1>
        <p className="mb-5 text-sm text-stone-500">Возможно, ссылка устарела</p>
        <Link to="/" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          В каталог
        </Link>
      </div>
    );
  }

  const meta = CATEGORY_META[dish.category];

  const addAll = () => {
    addIngredients(dish.ingredients);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div>
      {/* Верхняя панель */}
      <div className="mb-3 flex items-center justify-between">
        <Link
          to="/"
          aria-label="Назад в каталог"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
        >
          <ArrowLeft size={20} />
        </Link>
        <button
          type="button"
          onClick={() => toggleFavorite(dish.id)}
          aria-pressed={isFav}
          aria-label={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
          className={cn(
            'flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-sm transition-colors',
            isFav ? 'bg-brand-600 text-white' : 'bg-white text-stone-700 hover:bg-stone-50',
          )}
        >
          <Heart size={16} className={cn(isFav && 'fill-current')} />
          {isFav ? 'В избранном' : 'В избранное'}
        </button>
      </div>

      {/* Фото */}
      <div className="relative overflow-hidden rounded-3xl shadow-sm">
        <DishImage dish={dish} className="aspect-[4/3] w-full" />
        <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {formatKcal(dish.kcal)}
        </span>
      </div>

      {/* Заголовок */}
      <div className="mt-4 mb-1 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl leading-tight font-bold text-stone-900">{dish.nameEn}</h1>
          <p className="mt-1 text-sm text-stone-500">{dish.nameRu}</p>
        </div>
      </div>
      <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
        <span aria-hidden>{meta.emoji}</span>
        {meta.labelRu}
      </span>

      {/* Ингредиенты */}
      <section className="mt-5">
        <h2 className="mb-2 text-base font-bold text-stone-900">Ингредиенты</h2>
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200/70 bg-white">
          {dish.ingredients.map((ing) => (
            <li key={ing} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-stone-700">{ing}</span>
              <button
                type="button"
                onClick={() => addIngredients([ing])}
                aria-label={`Добавить «${ing}» в список покупок`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-colors hover:bg-brand-100"
              >
                <Plus size={15} />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addAll}
          className={cn(
            'mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white transition-colors',
            justAdded ? 'bg-pro-500' : 'bg-brand-600 hover:bg-brand-700',
          )}
        >
          {justAdded ? <Check size={17} /> : <ShoppingBasket size={17} />}
          {justAdded ? 'Добавлено в список покупок' : 'Добавить всё в список покупок'}
        </button>
      </section>

      {/* Приготовление */}
      <section className="mt-6 mb-4">
        <h2 className="mb-2 text-base font-bold text-stone-900">Приготовление</h2>
        <ol className="space-y-2.5">
          {dish.steps.map((step, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border border-stone-200/70 bg-white p-3.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-stone-700">{step}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
