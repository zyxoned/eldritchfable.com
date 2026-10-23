import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.ELDRITCH_BROWSER_DB ||= join(mkdtempSync(join(tmpdir(), 'ef-browser-')), 'accounts.db');
export default defineConfig({
  testDir: './tests/browser', workers: 1,
  use: { baseURL: 'http://127.0.0.1:4317', trace: 'retain-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined } },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ],
  webServer: { command: 'node tests/browser-server.mjs', url: 'http://127.0.0.1:4317/login', reuseExistingServer: false, timeout: 30000 }
});
