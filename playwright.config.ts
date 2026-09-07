import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  maxFailures: process.env.CI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5188',
    // Keep a desktop layout while limiting pixel work on CI's software renderer.
    viewport: process.env.CI ? { width: 1100, height: 720 } : { width: 1440, height: 900 },
    deviceScaleFactor: process.env.CI ? .5 : 1,
    channel: 'chromium',
    launchOptions: { args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'] },
    storageState: process.env.CI ? {
      cookies: [],
      origins: [{ origin: 'http://127.0.0.1:5188', localStorage: [{ name: 'dreamro.preferences.v1', value: JSON.stringify({ quality: 'balanced', music: false, sound: false, volume: .55 }) }] }],
    } : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5188 --strictPort',
    url: 'http://127.0.0.1:5188',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
