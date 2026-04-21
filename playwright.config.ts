import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const testDatabasePath = path.resolve(process.cwd(), "prisma", "dev.db");
process.env.DATABASE_URL = `file:${testDatabasePath.replace(/\\/g, "/")}`;
const testPort = 3101;
const testBaseUrl = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  grepInvert: process.env.CODEX_E2E_LIVE_PROVIDER === "1" ? undefined : /@live/,
  timeout: process.env.CODEX_E2E_LIVE_PROVIDER === "1" ? 300000 : 30000,
  expect: {
    timeout: process.env.CODEX_E2E_LIVE_PROVIDER === "1" ? 180000 : 5000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: testBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `powershell -ExecutionPolicy Bypass -File ./scripts/playwright-webserver.ps1 -Port ${testPort}`,
    url: testBaseUrl,
    reuseExistingServer: false,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
      CODEX_TEST_LLM_MOCK:
        process.env.CODEX_E2E_LIVE_PROVIDER === "1" ? "0" : "1",
    },
  },
});
