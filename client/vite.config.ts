import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    // Treat .js files as JSX so existing React components don't need renaming
    {
      name: 'treat-js-as-jsx',
      async transform(code, id) {
        if (!id.includes('node_modules') && id.endsWith('.js')) {
          return transformWithEsbuild(code, id, { loader: 'jsx' });
        }
      },
    },
    react(),
  ],
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 3000,
    hmr: { port: 3001 },
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  // Inject a per-build identifier the client reads via import.meta.env.VITE_BUILD_ID.
  // ErrorBoundary uses it to scope the chunk-error retry counter to this deploy
  // so each new deploy gets a fresh budget of retries. Falls back to Date.now()
  // for local dev where GITHUB_SHA is undefined. Audit ref: 2026-04-25 BACKLOG —
  // ErrorBoundary build-time deploy key.
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(process.env.GITHUB_SHA || Date.now().toString()),
  },
});
