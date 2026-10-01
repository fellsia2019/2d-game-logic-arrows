import { defineConfig } from 'vite';
export default defineConfig(({ mode }) => ({
  base: './', build: { outDir: mode === 'yandex' ? 'dist-yandex' : 'dist',
    rollupOptions: { input: mode === 'yandex' ? 'index.html' : ['index.html', 'victory-gallery.html'] } },
  server: { strictPort: true },
}));
