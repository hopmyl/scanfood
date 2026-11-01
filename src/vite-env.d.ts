/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /**
   * Адрес внешнего API распознавания для статических зеркал (GitHub Pages),
   * например https://scanrecipe.vercel.app — цепочка в src/lib/scan-client.ts
   * идёт на него, когда same-origin /api/scan недоступен (404/405).
   * Задаётся при сборке: SCAN_API_URL=... bash scripts/deploy-pages.sh
   */
  readonly VITE_SCAN_API_URL?: string;
  /**
   * ⚠️ Ключ OpenRouter для ПРЯМЫХ вызовов из браузера — попадает в публичный
   * бандл зеркала! Использовать только ключ с нулевым кредитным лимитом
   * (бесплатные модели). Альтернатива — VITE_SCAN_API_URL.
   */
  readonly VITE_OPENROUTER_KEY?: string;
  /** Модель OpenRouter для прямых вызовов (по умолчанию google/gemma-4-31b-it:free) */
  readonly VITE_OPENROUTER_MODEL?: string;
}
