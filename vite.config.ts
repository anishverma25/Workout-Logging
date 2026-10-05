/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import { pwa, securityHeaders } from './build/pwa.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), pwa(env)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    // `vite preview` serves the production build with the same headers as hosting, so tests
    // catch anything the Content Security Policy would block.
    preview: {
      headers: securityHeaders(env.VITE_SUPABASE_URL),
    },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      setupFiles: ['src/test/setup.ts'],
    },
  };
});
