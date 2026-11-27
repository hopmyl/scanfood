/**
 * Тарифы PRO (стратегия монетизации 26.11):
 *   Lite 0 ₽ · PRO Месяц 299 ₽ · PRO Год 1 990 ₽ (хит, −45%) ·
 *   PRO Семья 2 990 ₽ (до 4 человек) · PRO Навсегда 4 990 ₽.
 *
 * Приложение пока в тестовом режиме без биллинга: кнопка тарифа включает
 * PRO-режим локально (togglePro) — как только появится ЮKassa/СБП,
 * сюда же подключается checkout без изменения структуры экрана.
 * Фокус по стратегии — годовой тариф: главный акцент на экране оплаты.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Check,
  ChefHat,
  CookingPot,
  Crown,
  Heart,
  Infinity as InfinityIcon,
  Receipt,
  Sparkles,
  Timer,
  Users,
} from 'lucide-react';
import {
  COLLECTIONS,
} from '../data/collections';
import { FREE_DISHES_COUNT, PRO_DISHES_COUNT } from '../data/dishes';
import { useAppStore, FREE_SCANS_LIMIT } from '../store/useAppStore';
import { cn, pluralRu } from '../lib/utils';

const PER_MONTH_PRICE = 299;

interface Tier {
  id: string;
  titleRu: string;
  priceRub: number;
  perLine: string;
  hit?: boolean;
  noteRu: string;
  oldPrice?: number;
}

const TIERS: Tier[] = [
  {
    id: 'month',
    titleRu: 'PRO Месяц',
    priceRub: PER_MONTH_PRICE,
    perLine: `${PER_MONTH_PRICE} ₽ в месяц`,
    noteRu: 'Попробовать без обязательств',
  },
  {
    id: 'year',
    titleRu: 'PRO Год',
    priceRub: 1990,
    perLine: '≈ 166 ₽ в месяц',
    hit: true,
    oldPrice: PER_MONTH_PRICE * 12,
    noteRu: 'Дешевле одного выброшенного пучка зелени и йогурта',
  },
  {
    id: 'family',
    titleRu: 'PRO Семья',
    priceRub: 2990,
    perLine: 'до 4 человек · ≈ 249 ₽ в месяц',
    noteRu: 'Общая Кладовая и синхронный список покупок',
  },
  {
    id: 'forever',
    titleRu: 'PRO Навсегда',
    priceRub: 4990,
    perLine: 'Один платёж, без подписки',
    noteRu: 'Для тех, кто ненавидит подписки',
  },
];

const FEATURES = [
  {
    icon: InfinityIcon,
    title: 'Безлимитный ИИ-скан',
    text: `Лайт: ${FREE_SCANS_LIMIT} сканов. PRO: сколько угодно — холодильник, полка, готовая тарелка`,
  },
  {
    icon: Receipt,
    title: 'Скан чека одним фото',
    text: 'Заносит 15–20 продуктов из бумажного чека прямо в Кладовую',
  },
  {
    icon: Bell,
    title: 'Анти-отходы',
    text: 'Подсказки «испортится завтра — вот 3 ужина» и автосписание «Приготовил»',
  },
  {
    icon: CookingPot,
    title: 'Автоплан + авто-корзина',
    text: 'Меню на 7 дней под цель калорий и единый список покупок с вычетом запасов',
  },
  {
    icon: Sparkles,
    title: 'PRO-подборки',
    text: 'Без глютена, без лактозы, низкий ГИ, детское, высокобелковое, до 300 ₽',
  },
  {
    icon: BarChart3,
    title: 'КБЖУ без размытия',
    text: 'Порции до 12 с автопересчётом ингредиентов',
  },
  {
    icon: Timer,
    title: 'Режим готовки',
    text: 'Крупный шрифт, экран не гаснет, таймеры прямо в шагах',
  },
  {
    icon: Users,
    title: 'Семейный доступ',
    text: 'Один готовит дома — второй в магазине видит актуальный список',
  },
];

export default function ProScreen() {
  const isPro = useAppStore((s) => s.userProfile.isPro);
  const togglePro = useAppStore((s) => s.togglePro);
  const cookedFromPantry = useAppStore((s) => s.cookedFromPantry);
  const scannedTotal = useAppStore((s) => s.userProfile.scannedTotal);

  /** Выбранный тариф — только для подсветки кнопки (биллинга ещё нет) */
  const [chosen, setChosen] = useState<string | null>(null);

  const savedRub = cookedFromPantry * 180;

  const activate = (tierId: string) => {
    setChosen(tierId);
    if (!isPro) togglePro();
  };

  return (
    <div>
      {/* Шапка */}
      <div className="mb-4 flex items-center justify-between">
        <Link
          to="/"
          aria-label="Назад"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink shadow-sm transition-colors hover:bg-soft"
        >
          ←
        </Link>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
            isPro ? 'bg-pro/10 text-pro-ink' : 'bg-soft text-ink-2',
          )}
        >
          <Crown size={13} className={cn(isPro && 'fill-current')} />
          {isPro ? 'PRO активен' : 'Лайт'}
        </span>
      </div>

      <header className="mb-5 text-center">
        <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-pro/10 text-pro">
          <Crown size={30} className="fill-current" />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-ink">
          PRO — окупается за первую неделю
        </h1>
        <p className="mx-auto mt-1 max-w-xs text-sm text-ink-2">
          {FREE_DISHES_COUNT} {pluralRu(FREE_DISHES_COUNT, 'блюдо', 'блюда', 'блюд')} бесплатны
          всегда. PRO добавляет {PRO_DISHES_COUNT} авторских рецептов, безлимитный скан и
          автоматику против выброшенной еды.
        </p>
      </header>

      {/* Калькулятор экономии — продаём цифрой, не словами */}
      <section className="mb-6 rounded-3xl border border-line bg-card p-4 shadow-sm" aria-label="Калькулятор экономии">
        <h2 className="text-sm font-bold text-ink">Сколько ты уже экономишь</h2>
        {cookedFromPantry > 0 ? (
          <>
            <p className="mt-1.5 text-2xl font-bold text-good">
              ~{savedRub.toLocaleString('ru-RU')} ₽
              <span className="ml-1 text-sm font-medium text-ink-3">спасено от порчи</span>
            </p>
            <p className="mt-1 text-xs text-ink-2">
              Приготовлено из запасов: {cookedFromPantry}{' '}
              {pluralRu(cookedFromPantry, 'блюдо', 'блюда', 'блюд')} · {scannedTotal}{' '}
              {pluralRu(scannedTotal, 'скан', 'скана', 'сканов')} камеры. С PRO обычный
              пользователь экономит ~2 400 ₽ в месяц.
            </p>
          </>
        ) : (
          <p className="mt-1.5 text-xs text-ink-2">
            Приготовь первое блюдо «из запасов» и нажми «Готово» — посчитаем, сколько еды и денег
            ты спас от мусорки.
          </p>
        )}
      </section>

      {/* Тарифы */}
      <section aria-label="Тарифы">
        <div className="grid gap-2.5">
          {TIERS.map((t) => (
            <div
              key={t.id}
              className={cn(
                'relative rounded-3xl border bg-card p-4 shadow-sm transition-colors',
                t.hit ? 'border-pro/50' : 'border-line',
                chosen === t.id && 'ring-2 ring-pro/40',
              )}
            >
              {t.hit && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-pro px-3 py-0.5 text-[11px] font-bold text-white shadow-sm">
                  ХИТ · выгода 44%
                </span>
              )}
              <div className="flex items-start justify-between gap-3 pt-1">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-base font-bold text-ink">
                    {t.titleRu}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-2">{t.noteRu}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg leading-none font-bold text-ink">
                    {t.priceRub.toLocaleString('ru-RU')} ₽
                  </p>
                  {t.oldPrice && (
                    <p className="mt-1 text-[11px] text-ink-3 line-through">
                      {t.oldPrice.toLocaleString('ru-RU')} ₽
                    </p>
                  )}
                  <p className="mt-1 text-[11px] font-medium text-good">{t.perLine}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => activate(t.id)}
                disabled={isPro}
                className={cn(
                  'mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-sm font-bold transition-colors disabled:opacity-60',
                  t.hit
                    ? 'bg-pro text-white hover:opacity-90'
                    : 'bg-soft text-ink hover:bg-accent hover:text-on-accent',
                )}
              >
                {isPro ? (
                  <>
                    <Check size={15} strokeWidth={3} />
                    PRO уже активен
                  </>
                ) : (
                  <>
                    <Crown size={15} className="fill-current" />
                    Выбрать {t.titleRu.replace('PRO ', '')}
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-center text-[11px] leading-relaxed text-ink-3">
          Тестовый режим: подписка включается без оплаты. Оплата картой и СБП (ЮKassa) появится
          при публичном релизе — выбор тарифа сохранится.
        </p>
      </section>

      {/* Лайт как осознанный выбор */}
      <section className="mt-4 rounded-3xl border border-line bg-soft/50 p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Heart size={15} className="text-accent" />
          Лайт — бесплатно навсегда
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          {FREE_DISHES_COUNT} {pluralRu(FREE_DISHES_COUNT, 'блюдо', 'блюда', 'блюд')} домашней
          классики, ручная Кладовая, {FREE_SCANS_LIMIT} сканов камеры, штрих-коды без лимита,
          список покупок и дневник калорий — всё это работает без подписки.
        </p>
      </section>

      {/* Что входит в PRO */}
      <section className="mt-6" aria-label="Что входит в PRO">
        <h2 className="mb-2 text-sm font-bold text-ink">Что входит в PRO</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl border border-line bg-card p-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* PRO-подборки витриной */}
      <section className="mt-6 mb-4" aria-label="PRO-подборки">
        <h2 className="mb-2 text-sm font-bold text-ink">Подборки под конкретные цели</h2>
        <div className="flex flex-wrap gap-1.5">
          {COLLECTIONS.map((c) => (
            <Link
              key={c.id}
              to="/"
              className="flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <span aria-hidden>{c.emoji}</span>
              {c.titleRu}
              <span className="text-ink-3">{c.ids.size}</span>
            </Link>
          ))}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-2">
          <ChefHat size={13} className="mt-0.5 shrink-0 text-accent" />
          Подборки видны всем — замков нет. Открываются рецепты внутри: домашняя классика
          бесплатно, авторская коллекция — с PRO.
        </p>
      </section>
    </div>
  );
}
