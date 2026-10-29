import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Crown,
  Heart,
  Infinity as InfinityIcon,
  Lock,
  Minus,
  Plus,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react';
import { CATEGORY_META, DISHES } from '../data/dishes';
import { coveredBy } from '../lib/match';
import { DishImage } from '../components/DishCard';
import { useAppStore } from '../store/useAppStore';
import { cn, formatAmount, formatKcal, pluralRu } from '../lib/utils';

const MAX_PORTIONS_LITE = 2;
const MAX_PORTIONS_PRO = 12;

export default function DishScreen() {
  const { id } = useParams<{ id: string }>();
  const dish = DISHES.find((d) => d.id === id);

  const isPro = useAppStore((s) => s.userProfile.isPro);
  const togglePro = useAppStore((s) => s.togglePro);
  const isFav = useAppStore((s) => (dish ? s.favorites.includes(dish.id) : false));
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const addToShoppingList = useAppStore((s) => s.addToShoppingList);
  const pantry = useAppStore((s) => s.pantry);
  // ⚠️ селектор возвращает стабильную ссылку (массив из стора),
  // производную считаем через useMemo — иначе getSnapshot не кэшируется (Zustand 5)
  const shoppingList = useAppStore((s) => s.shoppingList);
  const shoppingNames = useMemo(
    () => shoppingList.map((i) => i.name.toLowerCase()),
    [shoppingList],
  );

  const [portions, setPortions] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [portionHint, setPortionHint] = useState(false);

  if (!dish) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <span className="mb-3 text-5xl" aria-hidden>
          🥲
        </span>
        <h1 className="mb-1 text-lg font-bold text-ink">Рецепт не найден</h1>
        <p className="mb-5 text-sm text-ink-2">Возможно, ссылка устарела</p>
        <Link
          to="/"
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-strong"
        >
          В каталог
        </Link>
      </div>
    );
  }

  const meta = CATEGORY_META[dish.category];
  const maxPortions = isPro ? MAX_PORTIONS_PRO : MAX_PORTIONS_LITE;
  const atCap = !isPro && portions >= MAX_PORTIONS_LITE;
  /** Авторское блюдо без подписки: показываем витрину вместо рецепта */
  const locked = dish.tier === 'pro' && !isPro;

  const changePortions = (delta: number) => {
    const next = portions + delta;
    if (next < 1) return;
    if (next > maxPortions) {
      setPortionHint(true);
      window.setTimeout(() => setPortionHint(false), 2600);
      return;
    }
    setPortions(next);
  };

  /** Количество с учётом порций: «400 г», «1,5 шт», «горсть» */
  const qtyLine = (ing: { qty?: number; unit?: string; note?: string }): string => {
    if (ing.qty !== undefined) {
      return [formatAmount(ing.qty * portions), ing.unit].filter(Boolean).join(' ');
    }
    return ing.note ?? '';
  };

  const addOne = (ing: { name: string; qty?: number; unit?: string; note?: string }) => {
    addToShoppingList([
      { name: ing.name, qty: qtyLine(ing) || undefined, dishId: dish.id },
    ]);
  };

  const addAll = () => {
    const items = dish.ingredients
      .filter((ing) => !coveredBy(ing.name, pantry)) // то, чего нет в запасах
      .map((ing) => ({ name: ing.name, qty: qtyLine(ing) || undefined, dishId: dish.id }));
    addToShoppingList(items);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2000);
  };

  const bjuCells = [
    { label: 'Ккал', value: dish.kcal },
    { label: 'Белки', value: `${dish.bju.p} г` },
    { label: 'Жиры', value: `${dish.bju.f} г` },
    { label: 'Углев.', value: `${dish.bju.c} г` },
  ];

  return (
    <div>
      {/* Верхняя панель */}
      <div className="mb-3 flex items-center justify-between">
        <Link
          to="/"
          aria-label="Назад в каталог"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink shadow-sm transition-colors hover:bg-soft"
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
            isFav ? 'bg-accent text-on-accent' : 'bg-card text-ink hover:bg-soft',
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

      {/* Заголовок: RU — основное, EN — подзаголовок */}
      <div className="mt-4 mb-1">
        <h1 className="text-xl leading-tight font-bold text-ink">{dish.nameRu}</h1>
        <p className="mt-1 text-sm text-ink-2">{dish.nameEn}</p>
      </div>
      <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-ink">
        <span aria-hidden>{meta.emoji}</span>
        {meta.labelRu}
      </span>

      {/* ===== КБЖУ, порции, ингредиенты и шаги — только вне замка ===== */}
      {locked ? (
        /* ---------- Витрина авторского блюда: рецепт — с PRO ---------- */
        <section className="mt-5 rounded-3xl border border-pro/30 bg-card p-5 text-center shadow-sm">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-pro/10 text-pro">
            <Crown size={26} className="fill-current" />
          </span>
          <h2 className="text-lg font-bold text-ink">Рецепт из PRO-коллекции</h2>
          <p className="mt-1 text-sm text-ink-2">
            {dish.ingredients.length}{' '}
            {pluralRu(dish.ingredients.length, 'ингредиент', 'ингредиента', 'ингредиентов')} и{' '}
            {dish.steps.length} {pluralRu(dish.steps.length, 'шаг', 'шага', 'шагов')} откроются с
            подпиской PRO
          </p>
          <ul className="mt-4 space-y-2 text-left">
            <li className="flex items-center gap-2.5 rounded-xl bg-soft px-3.5 py-2.5 text-sm text-ink">
              <InfinityIcon size={16} className="shrink-0 text-accent" />
              Все 100 рецептов: 60 классических бесплатны, 40 авторских — с PRO
            </li>
            <li className="flex items-center gap-2.5 rounded-xl bg-soft px-3.5 py-2.5 text-sm text-ink">
              <Sparkles size={16} className="shrink-0 text-accent" />
              Безлимитные сканы и КБЖУ без размытия
            </li>
          </ul>
          <button
            type="button"
            onClick={togglePro}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-pro py-3 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
          >
            <Crown size={16} className="fill-current" />
            Открыть рецепт с PRO
          </button>
          <p className="mt-2 text-[11px] text-ink-3">
            Тестовый режим: подписка включается без оплаты
          </p>
        </section>
      ) : (
        <>
      {/* ===== КБЖУ: в Лайте размыто, в PRO открыто ===== */}
      <section className="mt-5" aria-label="КБЖУ на порцию">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">КБЖУ на порцию</h2>
          {!isPro && (
            <span className="flex items-center gap-1 rounded-full bg-pro/10 px-2.5 py-0.5 text-[11px] font-semibold text-pro-ink">
              <Crown size={12} className="fill-current" />
              PRO
            </span>
          )}
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-line bg-card p-4">
          <div
            className={cn(
              'grid grid-cols-4 gap-2',
              !isPro && 'pointer-events-none blur-[7px] select-none',
            )}
            aria-hidden={!isPro}
          >
            {bjuCells.map((c) => (
              <div key={c.label} className="text-center">
                <p className="text-lg leading-tight font-bold text-ink">{c.value}</p>
                <p className="mt-0.5 text-[10px] text-ink-2">{c.label}</p>
              </div>
            ))}
          </div>
          {!isPro && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-card/50">
              <Lock size={17} className="text-accent" />
              <p className="text-xs font-semibold text-ink">КБЖУ доступно в PRO</p>
              <button
                type="button"
                onClick={togglePro}
                className="mt-0.5 rounded-full bg-accent px-3.5 py-1.5 text-[11px] font-semibold text-on-accent transition-colors hover:bg-accent-strong"
              >
                Открыть КБЖУ
              </button>
            </div>
          )}
        </div>
        {isPro && portions > 1 && (
          <p className="mt-1.5 text-[11px] text-ink-2">
            Итого на {portions} {pluralRu(portions, 'порцию', 'порции', 'порций')}:{' '}
            {dish.kcal * portions} ккал · Б {dish.bju.p * portions} · Ж {dish.bju.f * portions} · У{' '}
            {dish.bju.c * portions} г
          </p>
        )}
      </section>

      {/* ===== Порции: Лайт 1–2, PRO до 12 ===== */}
      <section className="mt-4" aria-label="Количество порций">
        <div className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">Порции</p>
            <p className="mt-0.5 text-[11px] text-ink-2">
              {isPro ? 'Ингредиенты пересчитаются автоматически' : 'В Лайте — до 2, безлимит в PRO'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => changePortions(-1)}
              disabled={portions <= 1}
              aria-label="Убрать порцию"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-soft text-ink transition-colors hover:bg-line disabled:opacity-40"
            >
              <Minus size={15} />
            </button>
            <span className="w-5 text-center text-base font-bold text-ink" aria-live="polite">
              {portions}
            </span>
            <button
              type="button"
              onClick={() => changePortions(1)}
              aria-label={atCap ? 'Больше порций — в PRO' : 'Добавить порцию'}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-on-accent transition-colors hover:bg-accent-strong"
            >
              {atCap ? <Lock size={13} /> : <Plus size={15} />}
            </button>
          </div>
        </div>
        {portionHint && (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-accent-ink">
            <Crown size={12} className="fill-current" />
            Больше 2 порций — в PRO. Включи в профиле или кнопкой «Открыть КБЖУ»
          </p>
        )}
      </section>

      {/* ===== Ингредиенты с учётом порций ===== */}
      <section className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-base font-bold text-ink">Ингредиенты</h2>
          <span className="text-[11px] text-ink-2">
            на {portions} {pluralRu(portions, 'порцию', 'порции', 'порций')}
          </span>
        </div>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {dish.ingredients.map((ing) => {
            const atHome = coveredBy(ing.name, pantry);
            const inList = shoppingNames.includes(ing.name.toLowerCase());
            return (
              <li key={ing.name} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{ing.name}</p>
                  {qtyLine(ing) && <p className="text-xs text-ink-2">{qtyLine(ing)}</p>}
                </div>
                {atHome ? (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded-full bg-good/10 px-2.5 py-1 text-[11px] font-medium text-good"
                    title="Есть в запасах"
                  >
                    <Check size={12} strokeWidth={3} />
                    дома
                  </span>
                ) : inList ? (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded-full bg-soft px-2.5 py-1 text-[11px] text-ink-2"
                    title="Уже в списке покупок"
                  >
                    <ShoppingBasket size={12} />
                    в списке
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => addOne(ing)}
                    aria-label={`Добавить «${ing.name}» в список покупок`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent transition-colors hover:bg-accent hover:text-on-accent"
                  >
                    <Plus size={15} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={addAll}
          className={cn(
            'mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-on-accent transition-colors',
            justAdded ? 'bg-pro' : 'bg-accent hover:bg-accent-strong',
          )}
        >
          {justAdded ? <Check size={17} /> : <ShoppingBasket size={17} />}
          {justAdded ? 'Добавлено в список покупок' : 'Всё в список покупок'}
        </button>
        <p className="mt-1.5 text-center text-[11px] text-ink-3">
          Количество добавится с учётом {portions}{' '}
          {pluralRu(portions, 'порции', 'порций', 'порций')}
        </p>
      </section>

      {/* Приготовление */}
      <section className="mt-6 mb-4">
        <h2 className="mb-2 text-base font-bold text-ink">Приготовление</h2>
        <ol className="space-y-2.5">
          {dish.steps.map((step, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border border-line bg-card p-3.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-ink">{step}</p>
            </li>
          ))}
        </ol>
      </section>
        </>
      )}
    </div>
  );
}
