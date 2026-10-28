import { ChefHat, Crown, Infinity as InfinityIcon, RotateCcw, ScanLine, Sparkles } from 'lucide-react';
import ProToggle from '../components/ProToggle';
import { useAppStore, FREE_SCANS_LIMIT } from '../store/useAppStore';
import { cn } from '../lib/utils';

export default function ProfileScreen() {
  // ✅ Подписки на примитивы — селектор возвращает число/boolean, ререндер гарантирован
  const isPro = useAppStore((s) => s.userProfile.isPro);
  const scannedTotal = useAppStore((s) => s.userProfile.scannedTotal);
  const scansLeft = useAppStore((s) => s.userProfile.scansLeft);
  const favoritesCount = useAppStore((s) => s.favorites.length);
  const resetProgress = useAppStore((s) => s.resetProgress);

  const stats = [
    { label: 'Сканирований', value: String(scannedTotal), icon: ScanLine },
    { label: 'Осталось сканов', value: isPro ? '∞' : String(scansLeft), icon: InfinityIcon },
    { label: 'В избранном', value: String(favoritesCount), icon: Crown },
  ];

  return (
    <div>
      {/* Шапка профиля */}
      <div className="mb-5 flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md shadow-brand-600/25">
          <ChefHat size={30} />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">Гурман</h1>
          <span
            className={cn(
              'mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              isPro ? 'bg-pro-500/10 text-pro-600' : 'bg-stone-200/70 text-stone-600',
            )}
          >
            <Crown size={12} className={cn(isPro && 'fill-current')} />
            {isPro ? 'PRO-подписка' : 'Лайт версия'}
          </span>
        </div>
      </div>

      {/* Статистика */}
      <div className="mb-6 grid grid-cols-3 gap-2.5">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-stone-200/70 bg-white p-3 text-center">
            <Icon size={16} className="mx-auto mb-1.5 text-brand-500" />
            <p className="text-lg leading-none font-bold text-stone-900">{value}</p>
            <p className="mt-1 text-[10px] leading-tight text-stone-500">{label}</p>
          </div>
        ))}
      </div>

      {/* ===== БЛОК «Режим PRO тест» — тот самый, с починенным тумблером ===== */}
      <section
        aria-label="Режим PRO тест"
        className="mb-4 rounded-2xl border border-stone-200/70 bg-white p-4 shadow-sm"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
              <Crown size={15} className={cn(isPro ? 'text-pro-500' : 'text-stone-400', isPro && 'fill-current')} />
              Режим PRO (тест)
            </p>
            <p className="mt-0.5 text-xs text-stone-500">
              {isPro
                ? 'PRO активен: сканы безлимитные, вся база открыта'
                : `Лайт: ${scansLeft} из ${FREE_SCANS_LIMIT} сканов осталось`}
            </p>
          </div>
          {/* ✅ Тумблер вынесен в компонент ProToggle — см. src/components/ProToggle.tsx */}
          <ProToggle />
        </div>
      </section>

      {/* Преимущества PRO */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-stone-900">Что даёт PRO</h2>
        <ul className="space-y-2">
          <li className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <InfinityIcon size={18} />
            </span>
            <div>
              <p className="text-sm font-medium text-stone-800">Безлимитные сканы</p>
              <p className="text-xs text-stone-500">Сканируй продукты столько раз, сколько нужно</p>
            </div>
          </li>
          <li className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Sparkles size={18} />
            </span>
            <div>
              <p className="text-sm font-medium text-stone-800">Вся база рецептов</p>
              <p className="text-xs text-stone-500">50 блюд и все новые обновления базы</p>
            </div>
          </li>
        </ul>
      </section>

      {/* Сброс прогресса (для тестов) */}
      <button
        type="button"
        onClick={resetProgress}
        className="mx-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
      >
        <RotateCcw size={13} />
        Сбросить прогресс (для тестов)
      </button>
    </div>
  );
}
