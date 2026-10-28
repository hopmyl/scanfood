import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Infinity as InfinityIcon, Lock, ScanLine, Sparkles } from 'lucide-react';
import { DISHES } from '../data/dishes';
import DishCard from '../components/DishCard';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

type Phase = 'idle' | 'scanning' | 'result' | 'paywall';

/** Мок-распознавание: рандомные «продукты с фото» и 2 подобранных рецепта */
const MOCK_PRODUCTS = ['Яйца', 'Помидоры', 'Творог', 'Зелень', 'Сыр', 'Молоко', 'Курица', 'Лимон', 'Шпинат', 'Сливки'];

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

export default function ScanScreen() {
  const isPro = useAppStore((s) => s.userProfile.isPro);
  const scansLeft = useAppStore((s) => s.userProfile.scansLeft);
  const performScan = useAppStore((s) => s.performScan);

  const [phase, setPhase] = useState<Phase>('idle');
  const [products, setProducts] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<typeof DISHES>([]);

  const startScan = () => {
    const result = performScan();

    if (result === 'limit') {
      setPhase('paywall');
      return;
    }

    setPhase('scanning');
    window.setTimeout(() => {
      setProducts(pickRandom(MOCK_PRODUCTS, 4));
      setRecipes(pickRandom(DISHES, 2));
      setPhase('result');
    }, 1400);
  };

  const activateTestPro = () => {
    // Тестовый режим: переключаем isPro тем же экшеном, что и тумблер в профиле
    useAppStore.getState().togglePro();
    setPhase('idle');
  };

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">Сканирование</h1>
          <p className="text-xs text-stone-500">
            {isPro ? 'PRO: безлимитные сканы' : `Лайт: осталось ${scansLeft} из 5 сканов`}
          </p>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
            isPro ? 'bg-pro-500/10 text-pro-600' : 'bg-stone-200/70 text-stone-600',
          )}
        >
          <Crown size={13} className={cn(isPro && 'fill-current')} />
          {isPro ? 'PRO' : 'Лайт'}
        </span>
      </header>

      {phase === 'paywall' ? (
        /* ---------- Paywall: сканы Лайта закончились ---------- */
        <div className="rounded-3xl border border-brand-200 bg-white p-6 text-center shadow-sm">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Lock size={26} />
          </span>
          <h2 className="text-lg font-bold text-stone-900">Сканы закончились</h2>
          <p className="mt-1 mb-4 text-sm text-stone-500">
            Ты использовал все 5 сканов Лайт-версии. Переключись на PRO, чтобы продолжить.
          </p>
          <ul className="mb-5 space-y-2 text-left">
            <li className="flex items-center gap-2.5 rounded-xl bg-brand-50/60 px-3.5 py-2.5 text-sm text-stone-700">
              <InfinityIcon size={16} className="shrink-0 text-brand-600" />
              Безлимитные сканирования продуктов
            </li>
            <li className="flex items-center gap-2.5 rounded-xl bg-brand-50/60 px-3.5 py-2.5 text-sm text-stone-700">
              <Sparkles size={16} className="shrink-0 text-brand-600" />
              Все 50 рецептов базы без ограничений
            </li>
          </ul>
          <button
            type="button"
            onClick={activateTestPro}
            className="w-full rounded-2xl bg-brand-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            Включить PRO (тестовый режим)
          </button>
          <p className="mt-2 text-[11px] text-stone-400">Или переключи тумблер «Режим PRO» в профиле</p>
        </div>
      ) : (
        <>
          {/* ---------- Видоискатель ---------- */}
          <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-brand-300 bg-white">
            {phase === 'scanning' ? (
              <div className="flex flex-col items-center gap-3">
                <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-brand-600 text-white">
                  <ScanLine size={30} />
                </span>
                <p className="text-sm font-medium text-stone-600">ИИ распознаёт продукты…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-8 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <ScanLine size={30} />
                </span>
                <p className="text-sm font-medium text-stone-600">Наведите камеру на продукты</p>
                <p className="text-xs text-stone-400">
                  ИИ распознает ингредиенты и подберёт рецепты из базы
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={startScan}
            disabled={phase === 'scanning'}
            className="mt-4 w-full rounded-2xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            {phase === 'scanning' ? 'Сканируем…' : 'Сканировать продукты'}
          </button>

          {/* ---------- Результат ---------- */}
          {phase === 'result' && (
            <section className="mt-6">
              <h2 className="mb-2 text-base font-bold text-stone-900">Распознанные продукты</h2>
              <div className="mb-5 flex flex-wrap gap-2">
                {products.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <h2 className="mb-3 text-base font-bold text-stone-900">Подобранные рецепты</h2>
              <div className="grid grid-cols-2 gap-3">
                {recipes.map((dish) => (
                  <DishCard key={dish.id} dish={dish} />
                ))}
              </div>
              <Link
                to="/"
                className="mt-4 block text-center text-xs font-medium text-stone-500 hover:text-stone-700"
              >
                Посмотреть всю базу рецептов →
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}
