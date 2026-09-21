import { defineConfig, devices } from "@playwright/test";

// Own port so an already-running `npm run dev` on 3000 is never touched;
// `localhost` (not 127.0.0.1) keeps the dev server's cross-origin HMR check quiet.
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

// Everything matching this is a model round-trip: real OpenRouter calls, real
// money, and an answer that is only mostly deterministic. It is its own project
// so `npm run test:e2e` can stay free and quick, and `npm run test:e2e:llm`
// opts in.
const LLM_SPECS = /\.llm\.spec\.ts$/;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  // `next dev` compiles each route on first request and the home page pulls in
  // the whole CopilotKit client bundle, which outruns the 5s default assertion
  // timeout on a cold .next-e2e.
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: LLM_SPECS,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "llm",
      testMatch: LLM_SPECS,
      use: { ...devices["Desktop Chrome"] },
      // A butler who reads the list, adds an item and then composes a sentence
      // about it is several round-trips deep before the assertion can pass.
      timeout: 180_000,
      expect: { timeout: 120_000 },
      retries: 0,
    },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    // Own dist dir (see next.config.ts) so this server's lock never collides
    // with a `npm run dev` already running in this directory.
    // BETTER_AUTH_URL in .env points at port 3000; Better Auth needs this one.
    env: { NEXT_DIST_DIR: ".next-e2e", BETTER_AUTH_URL: baseURL },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
    timeout: 120_000,
  },
});
