import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react', 'canvg'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['core-js/modules/web.dom-collections.iterator.js'],
    },
  },
});
