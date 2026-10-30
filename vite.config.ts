import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { scanApiPlugin } from './scan-api';

// GitHub Pages обслуживает проект из подпути /scanfood/, Vercel и локальная
// сборка — из корня. Раннер GitHub Actions всегда выставляет GITHUB_ACTIONS=true,
// на Vercel и локально переменной нет, поэтому base остаётся '/'.
const BASE = process.env.GITHUB_ACTIONS === 'true' ? '/scanfood/' : '/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    scanApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'СканРецепт — рецепты из твоих продуктов',
        short_name: 'СканРецепт',
        description:
          'Сканируй продукты камерой или штрих-код и получай рецепты из своих продуктов. Лайт и PRO режимы.',
        lang: 'ru',
        dir: 'ltr',
        theme_color: '#EA580C',
        background_color: '#FDF9F3',
        display: 'standalone',
        orientation: 'portrait',
        start_url: BASE,
        icons: [
          { src: `${BASE}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${BASE}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${BASE}icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Фото блюд (jpg) не прекешируем — кешируются на лету, чтобы раздуть бандл офлайна
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // ⚠️ CacheFirst живёт 30 дней и переживает обновления SW. Инвалидация
            // версий фото — через ?v=N в URL (DISH_IMG_V в src/lib/utils.ts):
            // новый параметр = новый ключ кэша = телефон видит свежее фото.
            urlPattern: /\/dishes\/.+\.(jpg|png)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'dish-photos',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
  // Сканер зависимостей не должен лезть в служебные папки (skills/, scripts/, download/)
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.tsx', 'src/**/*.ts'],
  },
});
