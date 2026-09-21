// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// lib/tutor.ts carries the `server-only` marker, which throws outside a React
// Server Component graph; the store itself is harmless against `:memory:`.
vi.mock("server-only", () => ({}));

const globalForTutor = globalThis as typeof globalThis & {
  tutorStorage?: unknown;
  mastra?: unknown;
};

// What `next dev` does on hot reload: evaluate the module again in a process
// whose globalThis is still populated from the last evaluation.
async function reevaluate() {
  vi.resetModules();
  return await import("@/lib/tutor");
}

function forgetCaches() {
  globalForTutor.tutorStorage = undefined;
  globalForTutor.mastra = undefined;
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", ":memory:");
  forgetCaches();
});

afterEach(() => {
  vi.unstubAllEnvs();
  forgetCaches();
});

test("a dev reload rebuilds the agent but reuses the one connection", async () => {
  vi.stubEnv("NODE_ENV", "development");

  const first = await reevaluate();
  const storage = globalForTutor.tutorStorage;
  const second = await reevaluate();

  // A rebuilt agent is what makes an edit to `instructions` take effect
  // without restarting the dev server.
  expect(second.mastra).not.toBe(first.mastra);
  // The LibSQLStore owns the libSQL connection, so it has to survive.
  expect(storage).toBeDefined();
  expect(globalForTutor.tutorStorage).toBe(storage);
});

test("production still caches the instance across evaluations", async () => {
  vi.stubEnv("NODE_ENV", "production");

  const first = await reevaluate();
  const second = await reevaluate();

  expect(second.mastra).toBe(first.mastra);
  expect(globalForTutor.mastra).toBe(first.mastra);
});
