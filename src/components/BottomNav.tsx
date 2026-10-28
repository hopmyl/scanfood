import { NavLink } from 'react-router-dom';
import { Heart, Home, ScanLine, User } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

const items = [
  { to: '/', label: 'Каталог', icon: Home },
  { to: '/scan', label: 'Скан', icon: ScanLine, center: true },
  { to: '/favorites', label: 'Избранное', icon: Heart },
  { to: '/profile', label: 'Профиль', icon: User },
];

export default function BottomNav() {
  const favCount = useAppStore((s) => s.favorites.length);

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/80 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pt-1.5 pb-1">
        {items.map(({ to, label, icon: Icon, center }) =>
          center ? (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 px-3',
                  isActive ? 'text-brand-600' : 'text-stone-400',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      '-mt-5 flex h-13 w-13 items-center justify-center rounded-full shadow-lg transition-colors',
                      isActive
                        ? 'bg-brand-600 text-white shadow-brand-600/40'
                        : 'bg-brand-500 text-white shadow-brand-500/30',
                    )}
                  >
                    <Icon size={24} />
                  </span>
                  <span className="text-[11px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ) : (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative flex min-w-16 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition-colors',
                  isActive ? 'text-brand-600' : 'text-stone-400 hover:text-stone-600',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} className={cn(isActive && 'fill-brand-50')} strokeWidth={isActive ? 2.4 : 2} />
                  <span>{label}</span>
                  {to === '/favorites' && favCount > 0 && (
                    <span className="absolute top-0.5 right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                      {favCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  );
}
