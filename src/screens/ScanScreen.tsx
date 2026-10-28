import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  CookingPot,
  Crown,
  Infinity as InfinityIcon,
  Lock,
  Plus,
  ScanLine,
  Sparkles,
  Store,
} from 'lucide-react';
import { PRODUCT_BY_NAME, SCAN_POOL } from '../data/dishes';
import { matchDishes, type MatchResult } from '../lib/match';
import DishCard from '../components/DishCard';
import { useAppStore } from '../store/useAppStore';
import { cn, pluralRu } from '../lib/utils';

type Phase = 'idle' | 'scanning' | 'result' | 'paywall';

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
  const addToPantry = useAppStore((s) => s.addToPantry);
  const pantry = useAppStore((s) => s.pantry);

  const [phase, setPhase] = useState<Phase>('idle');
  const [products, setProducts] = useState<string[]>([]);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [savedToPantry, setSavedToPantry] = useState(false);
  const [addedNames, setAddedNames] = useState<string[]>([]);

  const startScan = () => {
    const result = performScan();

    if (result === 'limit') {
      setPhase('paywall');
      return;
    }

    setPhase('scanning');
    window.setTimeout(() => {
      const detected = pickRandom(SCAN_POOL, 5 + Math.floor(Math.random() * 3)); // 5–7 продуктов
      setProducts(detected);
      // подбор учитывает и распознанное, и запасы шкафчика — всё взаимосвязано
      setMatch(matchDishes([...detected, ...pantry]));
      setSavedToPantry(false);
      setAddedNames([]);
      setPhase('result');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 1400);
  };

  const saveToPantry = () => {
    addToPantry(products);
    setSavedToPantry(true);
  };

  const addMissing = (ingredient: string) => {
    useAppStore.getState().addToShoppingList([{ name: ingredient }]);
    setAddedNames((prev) => [...prev, ingredient]);
  };

  const activateTestPro = () => {
    useAppStore.getState().togglePro();
    setPhase('idle');
  };

  return (
    <div>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Сканирование</h1>
          <p className="text-xs text-ink-2">
            {isPro ? 'PRO: безлимитные сканы' : `Лайт: осталось ${scansLeft} из 5 сканов`}
          </p>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
            isPro ? 'bg-pro/10 text-pro-ink' : 'bg-soft text-ink-2',
          )}
        >
          <Crown size={13} className={cn(isPro && 'fill-current')} />
          {isPro ? 'PRO' : 'Лайт'}
        </span>
      </header>

      {phase === 'paywall' ? (
        /* ---------- Paywall: сканы Лайта закончились ---------- */
        <div className="rounded-3xl border border-line bg-card p-6 text-center shadow-sm">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Lock size={26} />
          </span>
          <h2 className="text-lg font-bold text-ink">Сканы закончились</h2>
          <p className="mt-1 mb-4 text-sm text-ink-2">
            Ты использовал все 5 сканов Лайт-версии. Переключись на PRO, чтобы продолжить.
          </p>
          <ul className="mb-5 space-y-2 text-left">
            <li className="flex items-center gap-2.5 rounded-xl bg-soft px-3.5 py-2.5 text-sm text-ink">
              <InfinityIcon size={16} className="shrink-0 text-accent" />
              Безлимитные сканирования продуктов
            </li>
            <li className="flex items-center gap-2.5 rounded-xl bg-soft px-3.5 py-2.5 text-sm text-ink">
              <Sparkles size={16} className="shrink-0 text-accent" />
              КБЖУ и порции до 12 без ограничений
            </li>
          </ul>
          <button
            type="button"
            onClick={activateTestPro}
            className="w-full rounded-2xl bg-accent py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong"
          >
            Включить PRO (тестовый режим)
          </button>
          <p className="mt-2 text-[11px] text-ink-3">Или переключи тумблер «Режим PRO» в профиле</p>
        </div>
      ) : (
        <>
          {/* ---------- Видоискатель ---------- */}
          <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-accent/40 bg-card">
            {phase === 'scanning' ? (
              <div className="flex flex-col items-center gap-3">
                <span className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-accent text-on-accent">
                  <ScanLine size={30} />
                </span>
                <p className="text-sm font-medium text-ink-2">ИИ распознаёт продукты…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-8 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <ScanLine size={30} />
                </span>
                <p className="text-sm font-medium text-ink-2">Наведи камеру на холодильник</p>
                <p className="text-xs text-ink-3">
                  ИИ распознает продукты и сразу предложит, что из них приготовить
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={startScan}
            disabled={phase === 'scanning'}
            className="mt-4 w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            {phase === 'scanning' ? 'Сканируем…' : 'Сканировать холодильник'}
          </button>

          {/* ---------- Результат ---------- */}
          {phase === 'result' && match && (
            <section className="mt-6">
              {/* Распознанные продукты */}
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-bold text-ink">
                  Распознано: {products.length} {pluralRu(products.length, 'продукт', 'продукта', 'продуктов')}
                </h2>
                <button
                  type="button"
                  onClick={saveToPantry}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
                    savedToPantry ? 'bg-good/10 text-good' : 'bg-soft text-ink-2 hover:text-ink',
                  )}
                >
                  {savedToPantry ? <Check size={12} strokeWidth={3} /> : <Store size={12} />}
                  {savedToPantry ? 'В запасах' : 'В запасы'}
                </button>
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
                {products.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-accent/25 bg-accent-soft px-3 py-1 text-xs font-medium text-accent-ink"
                  >
                    <span aria-hidden className="mr-1">
                      {PRODUCT_BY_NAME.get(p.toLowerCase())?.emoji ?? '🥫'}
                    </span>
                    {p}
                  </span>
                ))}
              </div>

              {/* Можно приготовить прямо сейчас */}
              {match.canCook.length > 0 && (
                <>
                  <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-ink">
                    <CookingPot size={18} className="text-good" />
                    Можно приготовить: {match.canCook.length}
                    <span className="text-xs font-normal text-ink-3">с учётом запасов</span>
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {match.canCook.map((dish) => (
                      <DishCard key={dish.id} dish={dish} />
                    ))}
                  </div>
                </>
              )}

              {/* Добавь один продукт — и приготовь */}
              {match.missingGroups.length > 0 && (
                <div className="mt-6">
                  <h2 className="mb-1 text-base font-bold text-ink">Добавь один продукт</h2>
                  <p className="mb-3 text-xs text-ink-2">
                    Не хватает чего-то одного до новых рецептов — с учётом запасов шкафчика
                  </p>
                  <div className="space-y-2.5">
                    {match.missingGroups.map((g) => {
                      const added = addedNames.includes(g.ingredient);
                      return (
                        <div key={g.ingredient} className="rounded-2xl border border-line bg-card p-3.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                                <span aria-hidden className="text-lg">
                                  {g.emoji}
                                </span>
                                Добавь: {g.ingredient}
                              </p>
                              <p className="mt-0.5 text-xs text-ink-2">
                                и приготовь {g.dishes.length}{' '}
                                {pluralRu(g.dishes.length, 'блюдо', 'блюда', 'блюд')}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => addMissing(g.ingredient)}
                              className={cn(
                                'flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors',
                                added
                                  ? 'bg-good/10 text-good'
                                  : 'bg-accent text-on-accent hover:bg-accent-strong',
                              )}
                            >
                              {added ? <Check size={12} strokeWidth={3} /> : <Plus size={12} />}
                              {added ? 'В списке' : 'В список'}
                            </button>
                          </div>
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {g.dishes.slice(0, 4).map((d) => (
                              <Link
                                key={d.id}
                                to={`/dish/${d.id}`}
                                className="rounded-full bg-soft px-2.5 py-1 text-[11px] font-medium text-ink-2 transition-colors hover:text-accent"
                              >
                                {d.nameRu}
                              </Link>
                            ))}
                            {g.dishes.length > 4 && (
                              <span className="rounded-full px-2 py-1 text-[11px] text-ink-3">
                                +{g.dishes.length - 4} ещё
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Совсем ничего */}
              {match.canCook.length === 0 && match.missingGroups.length === 0 && (
                <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-2">
                  Из этих продуктов пока нечего приготовить.
                  <br />
                  Попробуй отсканировать ещё раз или пополни запасы.
                </p>
              )}

              <div className="mt-4 flex justify-center gap-4">
                <Link to="/" className="text-xs font-medium text-ink-3 hover:text-ink-2">
                  Вся база рецептов →
                </Link>
                <Link to="/pantry" className="text-xs font-medium text-ink-3 hover:text-ink-2">
                  Мои запасы →
                </Link>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
