import { defineConfig, devices } from '@playwright/test';

/**
 * Optional override for sandboxes that cannot download Playwright's browser build.
 * Point PW_CHROMIUM_PATH at a local Chromium; leave it unset everywhere else.
 */
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5175',
    timezoneId: 'Asia/Kolkata',
    trace: 'retain-on-failure',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /pwa\.spec\.ts/ },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /pwa\.spec\.ts/,
    },
    {
      // The production build (service worker, security headers), served by `vite preview`.
      name: 'pwa',
      testMatch: /pwa\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4175' },
    },
  ],
  webServer: [
    {
      // Local stand-in for Supabase: real migrations and row level security on PGlite.
      command: 'node tests/fake-supabase/server.ts',
      url: 'http://localhost:54329/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      // Its own port and mode, so a normal `pnpm dev` (no accounts) is never reused here.
      command: 'pnpm exec vite --mode e2e --port 5175 --strictPort',
      url: 'http://localhost:5175',
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'pnpm exec vite build --mode e2e --outDir dist-e2e --emptyOutDir && pnpm exec vite preview --mode e2e --outDir dist-e2e --port 4175 --strictPort',
      url: 'http://localhost:4175',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
