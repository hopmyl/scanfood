import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PANTRY } from '../data/dishes';

/** Профиль пользователя — ровно та же структура, что в твоём проекте */
export interface UserProfile {
  isPro: boolean;
  scansLeft: number;
  scannedTotal: number;
}

export type ThemeId = 'light' | 'dark' | 'burgundy' | 'forest' | 'ocean';

export interface ShoppingItem {
  id: string;
  name: string;
  /** количество с учётом порций, например «400 г» */
  qty?: string;
  done: boolean;
  /** из какого рецепта добавлено — для группировки в списке покупок */
  dishId?: string;
}

export interface NewShoppingItem {
  name: string;
  qty?: string;
  dishId?: string;
}

interface AppState {
  userProfile: UserProfile;
  /** id блюд, добавленных в избранное */
  favorites: string[];
  /** список покупок */
  shoppingList: ShoppingItem[];
  /** запасы дома — канонические имена продуктов (см. FRIDGE_PRODUCTS) */
  pantry: string[];
  /** сроки годности запасов: имя продукта → ISO-дата «YYYY-MM-DD» */
  pantryExpiry: Record<string, string>;
  /** тема оформления */
  theme: ThemeId;

  /**
   * ✅ ИСПРАВЛЕННЫЙ togglePro (причина бага «тумблер не нажимается»).
   * Всегда создаём НОВЫЙ объект userProfile через spread — ссылка меняется,
   * все подписчики честно перерисовываются. Никаких мутаций вложенных объектов.
   */
  togglePro: () => void;

  /** Списать один скан. Возвращает результат: 'ok' | 'pro' | 'limit' */
  performScan: () => 'ok' | 'pro' | 'limit';

  toggleFavorite: (dishId: string) => void;

  /** Добавить ингредиенты в список покупок (с количеством и рецептом-источником) */
  addToShoppingList: (items: NewShoppingItem[]) => void;
  toggleShoppingItem: (id: string) => void;
  removeShoppingItem: (id: string) => void;
  removeDoneFromShoppingList: () => void;
  clearShoppingList: () => void;

  addToPantry: (names: string[]) => void;
  removeFromPantry: (name: string) => void;

  /** Указать/убрать срок годности продукта (ISO-дата или undefined — убрать) */
  setPantryExpiry: (name: string, isoDate?: string) => void;

  setTheme: (theme: ThemeId) => void;

  /** Сброс прогресса для тестов (запасы и тема сохраняются) */
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
      pantry: DEFAULT_PANTRY,
      pantryExpiry: {},
      theme: 'light',

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

      addToShoppingList: (items) =>
        set((state) => {
          const existing = new Set(state.shoppingList.map((i) => i.name.toLowerCase()));
          const fresh: ShoppingItem[] = items
            .filter((item) => item.name && !existing.has(item.name.toLowerCase()))
            .map((item, i) => ({
              id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
              name: item.name,
              qty: item.qty,
              dishId: item.dishId,
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

      removeDoneFromShoppingList: () =>
        set((state) => ({
          shoppingList: state.shoppingList.filter((item) => !item.done),
        })),

      clearShoppingList: () => set({ shoppingList: [] }),

      addToPantry: (names) =>
        set((state) => ({
          pantry: [...state.pantry, ...names.filter((n) => !state.pantry.includes(n))],
        })),

      removeFromPantry: (name) =>
        set((state) => {
          const expiry = { ...state.pantryExpiry };
          delete expiry[name];
          return {
            pantry: state.pantry.filter((n) => n !== name),
            pantryExpiry: expiry,
          };
        }),

      setPantryExpiry: (name, isoDate) =>
        set((state) => {
          const expiry = { ...state.pantryExpiry };
          if (isoDate) expiry[name] = isoDate;
          else delete expiry[name];
          return { pantryExpiry: expiry };
        }),

      setTheme: (theme) => set({ theme }),

      resetProgress: () =>
        set((state) => ({
          userProfile: { isPro: false, scansLeft: FREE_SCANS_LIMIT, scannedTotal: 0 },
          favorites: [],
          shoppingList: [],
          // pantry, pantryExpiry и theme — пользовательские настройки, не сбрасываем
          pantry: state.pantry,
          pantryExpiry: state.pantryExpiry,
          theme: state.theme,
        })),
    }),
    {
      name: 'skan-recept-store', // ключ в localStorage
      version: 3,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<AppState>;
        return {
          userProfile: state.userProfile ?? {
            isPro: false,
            scansLeft: FREE_SCANS_LIMIT,
            scannedTotal: 0,
          },
          favorites: state.favorites ?? [],
          shoppingList: state.shoppingList ?? [],
          pantry: state.pantry ?? DEFAULT_PANTRY,
          pantryExpiry: state.pantryExpiry ?? {},
          theme: state.theme ?? 'light',
        } as AppState;
      },
    },
  ),
);
