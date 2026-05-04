import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    // Current single-page bundle is ~518 kB minified / ~139 kB gzip.
    // Keep Vercel logs clean while we defer route-level code splitting.
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 3000,
    open: true,
  },
});
