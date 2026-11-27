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

/** Слот приёма пищи в дневнике/планере */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/** Запись дневника калорий или плана питания (kind различает) */
export interface DiaryEntry {
  id: string;
  /** ISO-дата «YYYY-MM-DD» (локальная таймзона) */
  date: string;
  meal: MealSlot;
  /** 'eaten' — съедено (дневник), 'planned' — запланировано (планер) */
  kind: 'eaten' | 'planned';
  /** id блюда из каталога (если добавлено из рецепта) */
  dishId?: string;
  /** отображаемое имя (из каталога или своё) */
  name: string;
  kcal: number;
  /** БЖУ на порцию, г (опционально) */
  p?: number;
  f?: number;
  c?: number;
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

  /** дневник (eaten) и планер (planned) */
  diary: DiaryEntry[];
  /** дневная цель калорий для дневника */
  kcalTarget: number;

  /** Сколько раз приготовлено «Приготовил» с вычитанием из запасов (калькулятор экономии) */
  cookedFromPantry: number;

  /** Записать блюдо/продукт в дневник или план (kind внутри) */
  addDiaryEntry: (entry: Omit<DiaryEntry, 'id'>) => void;
  /** Удалить запись дневника/плана */
  removeDiaryEntry: (id: string) => void;
  /** Перенести запись плана в дневник (planned → eaten) */
  planToDiary: (id: string) => void;
  /** Дневная цель калорий */
  setKcalTarget: (n: number) => void;

  /**
   * «Приготовил» (анти-отходы): вычитает использованные продукты из запасов
   * и увеличивает счётчик приготовлений — для калькулятора экономии в профиле.
   * Запись в дневник делает сам экран блюда (он знает ккал и слот).
   */
  markCooked: (usedPantryNames: string[]) => void;

  /**
   * ✅ ИСПРАВЛЕННЫЙ togglePro (причина бага «тумблер не нажимается»).
   * Всегда создаём НОВЫЙ объект userProfile через spread — ссылка меняется,
   * все подписчики честно перерисовываются. Никаких мутаций вложенных объектов.
   */
  togglePro: () => void;

  /** Списать один скан. Возвращает результат: 'ok' | 'pro' | 'limit' */
  performScan: () => 'ok' | 'pro' | 'limit';

  /** Вернуть скан, списанный за неудавшееся распознавание (ошибка сети/нет сервера) */
  refundScan: () => void;

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
      diary: [],
      kcalTarget: 2000,
      cookedFromPantry: 0,

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

      refundScan: () => {
        const { userProfile } = get();
        // PRO — безлимит, возвращать нечего; выше лимита не поднимаем
        if (userProfile.isPro) return;
        if (userProfile.scansLeft >= FREE_SCANS_LIMIT) return;
        set({
          userProfile: { ...userProfile, scansLeft: userProfile.scansLeft + 1 },
        });
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

      addDiaryEntry: (entry) =>
        set((state) => ({
          diary: [
            ...state.diary,
            { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
          ],
        })),

      removeDiaryEntry: (id) =>
        set((state) => ({ diary: state.diary.filter((e) => e.id !== id) })),

      planToDiary: (id) =>
        set((state) => ({
          diary: state.diary.map((e) =>
            e.id === id ? { ...e, kind: 'eaten' as const } : e,
          ),
        })),

      setKcalTarget: (n) =>
        set({ kcalTarget: Math.min(10000, Math.max(800, Math.round(n) || 2000)) }),

      markCooked: (usedPantryNames) =>
        set((state) => {
          const used = new Set(usedPantryNames);
          if (used.size === 0) {
            // нечего вычитать — всё равно считаем ужин (экономия была на выбросе)
            return { cookedFromPantry: state.cookedFromPantry + 1 };
          }
          const expiry = { ...state.pantryExpiry };
          for (const n of used) delete expiry[n];
          return {
            pantry: state.pantry.filter((n) => !used.has(n)),
            pantryExpiry: expiry,
            cookedFromPantry: state.cookedFromPantry + 1,
          };
        }),

      resetProgress: () =>
        set((state) => ({
          userProfile: { isPro: false, scansLeft: FREE_SCANS_LIMIT, scannedTotal: 0 },
          favorites: [],
          shoppingList: [],
          // diary и kcalTarget — пользовательские данные дневника, не сбрасываем
          pantry: state.pantry,
          pantryExpiry: state.pantryExpiry,
          theme: state.theme,
        })),
    }),
    {
      name: 'skan-recept-store', // ключ в localStorage
      version: 5,
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
          diary: state.diary ?? [],
          kcalTarget: state.kcalTarget ?? 2000,
          cookedFromPantry: state.cookedFromPantry ?? 0,
        } as AppState;
      },
    },
  ),
);
