import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Профиль пользователя — ровно та же структура, что в твоём проекте */
export interface UserProfile {
  isPro: boolean;
  scansLeft: number;
  scannedTotal: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  done: boolean;
}

interface AppState {
  userProfile: UserProfile;
  /** id блюд, добавленных в избранное */
  favorites: string[];
  /** список покупок */
  shoppingList: ShoppingItem[];

  /**
   * ✅ ИСПРАВЛЕННЫЙ togglePro (причина твоего бага была здесь или в селекторе).
   *
   * БЫЛО (классическая ошибка мутации вложенного объекта):
   *   togglePro: () => set((state) => {
   *     state.userProfile.isPro = !state.userProfile.isPro; // ❌ мутация
   *     return state;                                       // ❌ тот же референс
   *   })
   * Объект userProfile оставался ТЕМ ЖЕ объектом по ссылке, поэтому компонент,
   * подписанный на useAppStore((s) => s.userProfile), не получал ререндер:
   * Object.is(prev, next) === true. Тумблер «не нажимался».
   *
   * СТАЛО: всегда создаём НОВЫЙ объект userProfile через spread —
   * ссылка меняется, все подписчики честно перерисовываются.
   */
  togglePro: () => void;

  /** Списать один скан. Возвращает результат: 'ok' | 'pro' | 'limit' */
  performScan: () => 'ok' | 'pro' | 'limit';

  toggleFavorite: (dishId: string) => void;
  addIngredients: (names: string[]) => void;
  toggleShoppingItem: (id: string) => void;
  removeShoppingItem: (id: string) => void;
  clearShoppingList: () => void;
  /** Сброс прогресса для тестов */
  resetProgress: () => void;
}

export const FREE_SCANS_LIMIT = 5;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      userProfile: {
        isPro: false,
        scansLeft: FREE_SCANS_LIMIT,
        scannedTotal: 0,
      },
      favorites: [],
      shoppingList: [],

      togglePro: () =>
        set((state) => ({
          // ✅ НОВЫЙ объект userProfile — неглубокая копия + инвертированное поле
          userProfile: {
            ...state.userProfile,
            isPro: !state.userProfile.isPro,
          },
        })),

      performScan: () => {
        const { userProfile } = get();

        // PRO — безлимит, но счётчик сканирований всё равно растёт
        if (userProfile.isPro) {
          set({
            userProfile: { ...userProfile, scannedTotal: userProfile.scannedTotal + 1 },
          });
          return 'pro';
        }

        // Лайт — лимит исчерпан
        if (userProfile.scansLeft <= 0) return 'limit';

        // Лайт — списываем один скан (опять новый объект, без мутаций!)
        set({
          userProfile: {
            ...userProfile,
            scansLeft: userProfile.scansLeft - 1,
            scannedTotal: userProfile.scannedTotal + 1,
          },
        });
        return 'ok';
      },

      toggleFavorite: (dishId) =>
        set((state) => ({
          favorites: state.favorites.includes(dishId)
            ? state.favorites.filter((id) => id !== dishId)
            : [...state.favorites, dishId],
        })),

      addIngredients: (names) =>
        set((state) => {
          const existing = new Set(state.shoppingList.map((i) => i.name.toLowerCase()));
          const fresh: ShoppingItem[] = names
            .filter((name) => name && !existing.has(name.toLowerCase()))
            .map((name, i) => ({
              id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
              name,
              done: false,
            }));
          return { shoppingList: [...state.shoppingList, ...fresh] };
        }),

      toggleShoppingItem: (id) =>
        set((state) => ({
          shoppingList: state.shoppingList.map((item) =>
            item.id === id ? { ...item, done: !item.done } : item,
          ),
        })),

      removeShoppingItem: (id) =>
        set((state) => ({
          shoppingList: state.shoppingList.filter((item) => item.id !== id),
        })),

      clearShoppingList: () => set({ shoppingList: [] }),

      resetProgress: () =>
        set({
          userProfile: { isPro: false, scansLeft: FREE_SCANS_LIMIT, scannedTotal: 0 },
          favorites: [],
          shoppingList: [],
        }),
    }),
    {
      name: 'skan-recept-store', // ключ в localStorage
    },
  ),
);
