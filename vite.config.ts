import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import vueDevTools from 'vite-plugin-vue-devtools';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // GitHub Pages serves the site under the repository's name; the workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [vue(), tailwindcss(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
