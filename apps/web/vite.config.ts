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
      includeAssets: ['only-tools.css', 'icon.svg', 'robots.txt', 'sitemap.xml'],
      manifest: {
        name: 'FoodLog — калорії та БЖУ',
        short_name: 'FoodLog',
        lang: 'uk',
        start_url: '/',
        display: 'standalone',
        background_color: '#fff8f1',
        theme_color: '#fff8f1',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/callback/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'https://foodlog.onlytools.click', changeOrigin: true } },
  },
});
