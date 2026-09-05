import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke on the fixture adapter (design D16) at a 375 px viewport.
 * The dev server is started fresh with `CHECKPOINT_GIT_HOST=fixture`, so the
 * run needs no token and no network; every write lands in the adapter's
 * in-memory overlay and the tree under `fixtures/repo/` is never touched.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 375, height: 812 },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      CHECKPOINT_GIT_HOST: "fixture",
      CHECKPOINT_FIXTURE_DIR: "fixtures/repo",
      CHECKPOINT_REPO: "fixture/repo",
      CHECKPOINT_ACCESS_KEY: "e2e-access-key",
    },
    stdout: "pipe",
    stderr: "pipe",
  },
});
