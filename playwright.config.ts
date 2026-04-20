import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  grepInvert: process.env.CODEX_E2E_LIVE_PROVIDER === "1" ? undefined : /@live/,
  timeout: process.env.CODEX_E2E_LIVE_PROVIDER === "1" ? 300000 : 30000,
  expect: {
    timeout: process.env.CODEX_E2E_LIVE_PROVIDER === "1" ? 180000 : 5000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
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
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      CODEX_TEST_LLM_MOCK:
        process.env.CODEX_E2E_LIVE_PROVIDER === "1" ? "0" : "1",
    },
  },
});
