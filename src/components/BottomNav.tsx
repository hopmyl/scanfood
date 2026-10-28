import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, PackageOpen, ScanLine, ShoppingCart, User } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

const items = [
  { to: '/', label: 'Каталог', icon: Home },
  { to: '/pantry', label: 'Запасы', icon: PackageOpen },
  { to: '/scan', label: 'Скан', icon: ScanLine, center: true },
  { to: '/shopping', label: 'Покупки', icon: ShoppingCart, badge: true },
  { to: '/profile', label: 'Профиль', icon: User },
];

export default function BottomNav() {
  const shoppingList = useAppStore((s) => s.shoppingList);
  const toBuy = useMemo(() => shoppingList.filter((i) => !i.done).length, [shoppingList]);

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-md items-end justify-around px-1 pt-1.5 pb-1">
        {items.map(({ to, label, icon: Icon, center, badge }) =>
          center ? (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center gap-0.5 px-2"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      '-mt-5 flex h-13 w-13 items-center justify-center rounded-full shadow-lg transition-colors',
                      isActive ? 'bg-accent text-on-accent shadow-accent/40' : 'bg-accent-strong text-on-accent shadow-accent/30',
                    )}
                  >
                    <Icon size={24} />
                  </span>
                  <span className={cn('text-[10px] font-medium', isActive ? 'text-accent' : 'text-ink-3')}>{label}</span>
                </>
              )}
            </NavLink>
          ) : (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'relative flex min-w-14 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-ink-3 hover:text-ink-2',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={21} className={cn(isActive && 'fill-accent-soft')} strokeWidth={isActive ? 2.4 : 2} />
                  <span>{label}</span>
                  {badge && toBuy > 0 && (
                    <span className="absolute top-0.5 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-on-accent">
                      {toBuy}
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
