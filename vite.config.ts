import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'СканРецепт — рецепты из твоих продуктов',
        short_name: 'СканРецепт',
        description:
          'Сканируй продукты камерой и получай подобранные ИИ рецепты. Лайт и PRO режимы.',
        lang: 'ru',
        dir: 'ltr',
        theme_color: '#EA580C',
        background_color: '#FDF9F3',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Фото блюд (jpg) не прекешируем — кешируются на лету, чтобы раздуть бандл офлайна
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
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
