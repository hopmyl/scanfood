import { Link } from 'react-router-dom';
import {
  BarChart3,
  ChefHat,
  ChevronRight,
  Crown,
  Heart,
  Infinity as InfinityIcon,
  Palette,
  RotateCcw,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import ProToggle from '../components/ProToggle';
import { useAppStore, FREE_SCANS_LIMIT, type ThemeId } from '../store/useAppStore';
import { cn } from '../lib/utils';

const THEMES: Array<{ id: ThemeId; labelRu: string; bg: string; accent: string; ring: string }> = [
  { id: 'light', labelRu: 'Светлая', bg: '#FDF9F3', accent: '#EA580C', ring: '#E9E1D5' },
  { id: 'dark', labelRu: 'Тёмная', bg: '#14110E', accent: '#F97316', ring: '#332B23' },
  { id: 'burgundy', labelRu: 'Бордо', bg: '#241019', accent: '#E8536B', ring: '#482936' },
  { id: 'forest', labelRu: 'Лесная', bg: '#101B14', accent: '#5CBF7A', ring: '#273A2C' },
  { id: 'ocean', labelRu: 'Океан', bg: '#0E1722', accent: '#38BDF8', ring: '#24374A' },
];

export default function ProfileScreen() {
  // ✅ Подписки на примитивы — селектор возвращает число/boolean, ререндер гарантирован
  const isPro = useAppStore((s) => s.userProfile.isPro);
  const scannedTotal = useAppStore((s) => s.userProfile.scannedTotal);
  const scansLeft = useAppStore((s) => s.userProfile.scansLeft);
  const favoritesCount = useAppStore((s) => s.favorites.length);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const resetProgress = useAppStore((s) => s.resetProgress);

  const stats = [
    { label: 'Сканирований', value: String(scannedTotal), icon: ScanLine },
    { label: 'Осталось сканов', value: isPro ? '∞' : String(scansLeft), icon: InfinityIcon },
    { label: 'В избранном', value: String(favoritesCount), icon: Heart },
  ];

  const proBenefits = [
    {
      icon: InfinityIcon,
      title: 'Безлимитные сканы',
      text: 'Сканируй холодильник столько раз, сколько нужно',
    },
    {
      icon: BarChart3,
      title: 'КБЖУ без блура',
      text: 'Калории, белки, жиры и углеводы на порцию',
    },
    {
      icon: ChefHat,
      title: 'Порции без лимита',
      text: 'До 12 порций с автопересчётом ингредиентов',
    },
    {
      icon: Sparkles,
      title: 'Вся база рецептов',
      text: '50 блюд и все новые обновления базы',
    },
  ];

  return (
    <div>
      {/* Шапка профиля */}
      <div className="mb-5 flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-on-accent shadow-md shadow-accent/25">
          <ChefHat size={30} />
        </span>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Гурман</h1>
          <span
            className={cn(
              'mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              isPro ? 'bg-pro/10 text-pro-ink' : 'bg-soft text-ink-2',
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
          <div key={label} className="rounded-2xl border border-line bg-card p-3 text-center">
            <Icon size={16} className="mx-auto mb-1.5 text-accent" />
            <p className="text-lg leading-none font-bold text-ink">{value}</p>
            <p className="mt-1 text-[10px] leading-tight text-ink-2">{label}</p>
          </div>
        ))}
      </div>

      {/* ===== БЛОК «Режим PRO тест» — тот самый, с починенным тумблером ===== */}
      <section
        aria-label="Режим PRO тест"
        className="mb-4 rounded-2xl border border-line bg-card p-4 shadow-sm"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Crown
                size={15}
                className={cn(isPro ? 'text-pro' : 'text-ink-3', isPro && 'fill-current')}
              />
              Режим PRO (тест)
            </p>
            <p className="mt-0.5 text-xs text-ink-2">
              {isPro
                ? 'PRO активен: сканы, КБЖУ и порции без ограничений'
                : `Лайт: ${scansLeft} из ${FREE_SCANS_LIMIT} сканов осталось`}
            </p>
          </div>
          {/* ✅ Тумблер вынесен в компонент ProToggle — см. src/components/ProToggle.tsx */}
          <ProToggle />
        </div>
      </section>

      {/* ===== Оформление: 5 тем ===== */}
      <section className="mb-6" aria-label="Оформление">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
          <Palette size={15} className="text-accent" />
          Оформление
        </h2>
        <div className="grid grid-cols-5 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              aria-pressed={theme === t.id}
              aria-label={`Тема «${t.labelRu}»`}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl border-2 p-1.5 transition-all',
                theme === t.id ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-soft',
              )}
            >
              <span
                className="flex h-10 w-full items-center justify-center rounded-xl"
                style={{ backgroundColor: t.bg, boxShadow: `inset 0 0 0 1px ${t.ring}` }}
              >
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: t.accent }}
                />
              </span>
              <span
                className={cn(
                  'text-[10px] font-medium',
                  theme === t.id ? 'text-accent' : 'text-ink-2',
                )}
              >
                {t.labelRu}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ===== Разделы ===== */}
      <section className="mb-6" aria-label="Разделы">
        <h2 className="mb-2 text-sm font-bold text-ink">Разделы</h2>
        <Link
          to="/favorites"
          className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3.5 transition-colors hover:bg-soft"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Heart size={18} />
            </span>
            <span className="text-sm font-medium text-ink">
              Избранное
              {favoritesCount > 0 && (
                <span className="ml-1.5 text-xs font-normal text-ink-2">({favoritesCount})</span>
              )}
            </span>
          </span>
          <ChevronRight size={18} className="text-ink-3" />
        </Link>
      </section>

      {/* Преимущества PRO */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold text-ink">Что даёт PRO</h2>
        <ul className="space-y-2">
          {proBenefits.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon size={18} />
              </span>
              <div>
                <p className="text-sm font-medium text-ink">{title}</p>
                <p className="text-xs text-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Сброс прогресса (для тестов) */}
      <button
        type="button"
        onClick={resetProgress}
        className="mx-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium text-ink-3 transition-colors hover:bg-red-500/10 hover:text-red-500"
      >
        <RotateCcw size={13} />
        Сбросить прогресс (для тестов)
      </button>
    </div>
  );
}
