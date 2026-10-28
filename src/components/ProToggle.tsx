import { useAppStore } from '../store/useAppStore';
import { cn } from '../lib/utils';

/**
 * ✅ РАБОЧИЙ тумблер PRO — эталонная реализация для твоего ProfileScreen.
 *
 * Два ключевых момента, из-за которых тумблер «не нажимался»:
 *
 * 1. СЕЛЕКТОР: подписываемся на ПРИМИТИВ (boolean), а не на объект.
 *    ❌ Было:  const { userProfile } = useAppStore((s) => ({ userProfile: s.userProfile }))
 *    ✅ Стало: const isPro = useAppStore((s) => s.userProfile.isPro)
 *
 * 2. СТОР: togglePro создаёт новый объект userProfile (см. useAppStore.ts).
 *
 * 3. ОБРАБОТЧИК: onClick={togglePro} — передаём саму функцию.
 *    ❌ Было:  onClick={() => togglePro}   — функция создаётся, но НЕ вызывается.
 *
 * 4. pointer-events-none стоит ТОЛЬКО на внутреннем кружке — это правильно:
 *    клик всегда ловит кнопка целиком. На самой кнопке его быть не должно.
 */
export default function ProToggle() {
  const isPro = useAppStore((s) => s.userProfile.isPro);
  const togglePro = useAppStore((s) => s.togglePro);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPro}
      aria-label="Переключить режим PRO"
      onClick={togglePro}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
        'focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:outline-none',
        isPro ? 'bg-pro-500' : 'bg-stone-300',
      )}
    >
      <span
        className={cn(
          // pointer-events-none — чтобы клик по кружку не терялся, а ловился кнопкой
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0',
          'transition-transform duration-200 ease-out',
          isPro ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}
