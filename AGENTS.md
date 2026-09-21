<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ai-tutor

AI tutoring web app on Next.js 16 App Router + React 19 + Tailwind v4: a Mastra agent served to a CopilotKit chat over AG-UI, behind Better Auth email/password sign-in, over a Drizzle/SQLite persistence layer, with a Vitest + Playwright test harness.

## Working here

- Done means four green: `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`.
- A fresh clone needs `npm run db:migrate` to create `data/app.db`, and `npx playwright install chromium` before `test:e2e` can run at all.
- `npm run test:e2e:llm` is deliberately outside those four: it spends real OpenRouter calls, so run it when the agent, its tools, or their wiring changed.
- The shell is Git Bash on Windows: there is no `python`, and its `grep` strips CR before matching so it cannot find CRLF — use `perl` or `node` for byte-level work.

## Commands

- `npm run lint` is `biome check` and `npm run format` is `biome format --write` — Biome only, so never add ESLint or Prettier config.
- `npm run db:generate` writes a migration from the schema and `npm run db:migrate` applies it to `DATABASE_URL`.
- `npm run auth:generate` regenerates `lib/auth-schema.ts` from the Better Auth config; follow it with `db:generate` + `db:migrate`.

## App code — `app/`, `components/`

- `PageProps` and `LayoutProps` are route-typed globals generated under `.next*/types`, four globs of which `tsconfig.json` includes, so a typecheck on a clean checkout fails until `next dev` or `next build` has run once.
- TypeScript 7 ships no JavaScript compiler API, so `next build` type-checks by running the project-local `tsc`; leave `experimental.useTypeScriptCli` unset, because `false` makes the build exit.
- Import across the repo with the `@/*` alias (rooted at this directory), not deep relative paths.
- Extend a primitive in `components/ui/` instead of repeating its class string.

## Persistence — `lib/db.ts`, `lib/schema.ts`, `lib/auth-schema.ts`, `drizzle.config.ts`, `drizzle/`

- Every query against `todos` lives in `lib/todos.ts` and takes both a `db` handle and a `userId`, including the writes — that predicate, not the unguessability of an id, is the whole of the per-user isolation.
- `lib/todos.ts` takes its `db` as an argument rather than importing `lib/db.ts`, which is what lets `tests/unit/todo-tools.test.ts` run the real executors against a `:memory:` database.
- `lib/db.ts` is `server-only` and the single place that opens the database; import `db` from it rather than constructing another `drizzle()`.
- Table definitions live in `lib/schema.ts` so drizzle-kit and tests can import them without tripping the `server-only` marker.
- `lib/auth-schema.ts` is overwritten wholesale by `auth:generate`, so app tables belong in `lib/schema.ts`, which re-exports it as the one entry point drizzle-kit and the Drizzle adapter read.
- The driver is `drizzle-orm/libsql/node` and drizzle-kit picks `@libsql/client` on its own — do not install `better-sqlite3`.
- `drizzle/` is generated (edit the schema and re-run `db:generate`), and the SQLite file under the git-ignored `data/` is disposable — recreate it with `db:migrate`.

## Auth — `lib/auth.ts`, `lib/auth-config.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/`

- `lib/auth-config.ts` exports `authOptions(db)` and every entry point spreads it with its own literal `plugins` array — Better Auth only infers plugin helpers such as `ctx.test` from literal arrays.
- `lib/auth.ts` is the app instance (`server-only` via `lib/db.ts`, `nextCookies()` last); `lib/auth-cli.ts` exists only because the Better Auth CLI refuses to load a module graph containing `server-only`.
- Gate pages server-side with `auth.api.getSession({ headers: await headers() })` and `redirect()`; there is deliberately no `proxy.ts`, whose cookie check would not validate anything.
- Email/password only: adding a provider or plugin means re-running `auth:generate` and the migration flow.

## Agent — `lib/tutor.ts`, `lib/todo-tools.ts`, `lib/todo-tool-schemas.ts`, `components/`, `app/api/`

- `lib/tutor.ts` is the whole agent: one `Agent` (`TUTOR_AGENT_ID`, a butler who keeps the user's to-do list) on `openrouter/z-ai/glm-5.3-flash`, holding the three tools from `lib/todo-tools.ts`.
- `createTodoTools(db)` is a factory so the app can bind the shared connection and a test can bind a throwaway one; the record's keys are the names the model sees, so they match each tool's `id`.
- A tool's `userId` comes only from `requestContext.get("userId")`, which the route sets from the session — the AG-UI bridge files the client's own `input.context` under its own `ag-ui` key, so the browser cannot shadow it.
- `RequestContext<T>` is invariant in `T` and Mastra hands tools a `RequestContext<unknown>`, so `lib/todo-tools.ts` keeps it untyped and narrows in `userIdFrom` instead — which is where the check belongs anyway.
- One `LibSQLStore` on `DATABASE_URL` backs both the `Mastra` instance and its `@mastra/memory`, and has to be passed to both or Mastra warns and falls back to a non-durable in-memory store.
- That store is the only thing kept across a hot reload: development rebuilds the `Mastra` instance on every module evaluation, so editing `instructions` takes effect without restarting `next dev`, while production caches the instance on `globalThis` the way `lib/db.ts` caches its connection.
- Mastra's model router reads `OPENROUTER_API_KEY` itself, so no AI SDK provider package is installed and the model string keeps its `provider/vendor/model` shape.
- Mastra creates and owns its `mastra_*` tables in that file — they are not in `lib/schema.ts` and `db:generate` must not try to manage them.
- The route builds the AG-UI bridge per request with `new MastraAgent({ resourceId, requestContext, streamServerToolCalls: true })`, the first two from the verified user id and never from anything in the request.
- It constructs the bridge rather than calling `MastraAgent.getLocalAgent`, which does the same two lines but drops `streamServerToolCalls`; off, a server tool's call is buffered and flushed only once it has run, so a card could never show anything but `complete`.
- Both branches of the `mastra` export have to land on one type, or it is a union and `mastra.getAgent` stops being callable.
- Thread ids are `tutor:<userId>` (`tutorThreadId`), rendered into the page from the session so a reload rejoins the same conversation; a forged one fails on Mastra's `AGENT_MEMORY_THREAD_RESOURCE_MISMATCH`, which is what actually keeps user A out of user B's thread.
- The route answers 401 before touching Mastra, and that is the only auth gate — the runtime endpoint is otherwise public.
- Use `createCopilotRuntimeHandler` from `@copilotkit/runtime/v2`; the `v2/express` and `v2/hono` adapters the package also exports are for those servers, not a Next route handler.
- `@copilotkit/react-core/v2` is the whole client surface (`CopilotKit`, `CopilotChat`, `styles.css`) — `@copilotkit/react-ui` and the package roots are v1 and do not work with it.
- `CopilotChat` carries `h-full` behind its own `display: contents` wrapper, which Chromium will not resolve a percentage height through, so it only takes height by growing down a flex column — `components/workspace.tsx` puts one around it inside the row the two panes share.
- The sidebar re-reads `GET /api/todos` on both `onToolCallResultEvent` and `onRunFinalized`, so the list moves with the card that announced the change and still catches a run that ended without one.
- `/api/todos` is read-only on purpose: the tools are the only write path, so there is no second one to keep in step with them.
- `components/todo-tool-renderers.tsx` registers a card per tool with `useRenderTool`; with no renderer CopilotKit draws nothing for a tool call and warns about it in development.
- That provider has to enclose both panes: `useAgent` in the sidebar and `useRenderTool` in the chat each need to sit inside it, which is why the renderers are registered from `components/chat.tsx` and not alongside the provider.
- `components/tool-call-card.tsx` imports no CopilotKit, which is what lets `tests/unit/tool-call-card.test.tsx` render it directly.
- `lib/todo-tool-schemas.ts` holds the tools' input and output schemas because the executors and the cards both read them; keep `lib/todos.ts` out of it so no database code reaches the browser bundle.
- A card's `result` is a string: parse it against the output schema and fall back to the raw text, because a failed call puts something else there.
- The CopilotKit Inspector is on by default in development (`enableInspector` stays unset; `showDevConsole` is deprecated and controls nothing). Its `<cpk-web-inspector>` launcher would sit on the header's sign-out button, so `app/globals.css` shifts the host down with a margin.
- `OPENROUTER_BASE_URL` (optional, see `.env.example`) routes the model traffic through a local proxy; with a custom `url` Mastra's model router no longer reads `OPENROUTER_API_KEY` itself, which is why `lib/tutor.ts` passes `apiKey` explicitly.
- Threads only persist inside Mastra's memory — the runtime runs on the default `InMemoryAgentRunner`, so the browser's own transcript still starts empty on reload.

## Tests — `tests/unit` (Vitest), `tests/e2e` (Playwright)

- `tests/e2e/*.llm.spec.ts` is the `llm` Playwright project and the only thing that calls OpenRouter; `npm run test:e2e` is `--project=chromium` and skips it, `npm run test:e2e:llm` runs just it.
- Nothing else exercises a model round-trip, so a CopilotKit or Mastra upgrade can be four-green and still broken at runtime — that one spec is what catches it.
- Vitest is jsdom + Testing Library and only picks up `tests/unit/**/*.test.{ts,tsx}`; async Server Components are unsupported there, so cover those with e2e instead.
- `tests/unit/tool-call-card.test.tsx` is the only test that uses that jsdom environment — every other unit test opts out — so it alone pays the one-off cost of Vite optimising React.
- `vitest.config.mts` resolves `@/*` through Vite's built-in `resolve.tsconfigPaths`, which supersedes the `vite-tsconfig-paths` plugin the Next.js guide still lists — do not reinstall it.
- `tests/unit/db.test.ts`, `auth.test.ts` and `todo-tools.test.ts` opt out of jsdom with a `// @vitest-environment node` first line and migrate a `:memory:` database, so they never touch `data/app.db` and leave nothing to clean up.
- The auth test builds its own instance from `authOptions` with the `testUtils()` plugin and an explicit `secret`/`baseURL`, because Vitest does not load `.env`.
- `tests/unit/tutor.test.ts` re-imports `lib/tutor.ts` after `vi.resetModules()` to stand in for a hot reload and pins that dev/production split; it mocks `server-only` and points `DATABASE_URL` at `:memory:`.
- `tests/unit/copilotkit-route.test.ts` mocks `@/lib/auth`, `@/lib/tutor`, and both CopilotKit/AG-UI modules, so it covers the 401 gate and the `resourceId`/`requestContext` wiring without a model call.
- `tests/unit/todo-tools.test.ts` calls the executors the way the agent loop does — `tool.execute(input, { requestContext })` — against a migrated `:memory:` database, and is where per-user isolation is pinned.
- Playwright runs Chromium only against its own `next dev` on port 3100 (override with `E2E_PORT`).
- `next dev` refuses to start twice against one dist dir, so `next.config.ts` reads `NEXT_DIST_DIR` and the e2e server sets it to `.next-e2e`; that dir also needs a `tsconfig.json` include entry, which `next dev` adds itself.
- Both e2e specs hit `data/app.db`, so each signs up a `Date.now()`-stamped email; `playwright.config.ts` also overrides `BETTER_AUTH_URL` onto its own port.
- CopilotKit disables its send button until `/agent/tutor/connect` returns, seconds after the input appears, so drive the chat through `copilot-send-button` and wait for it — an early Enter is silently dropped.

## Styling — `app/globals.css`

- Tailwind v4 has no `tailwind.config.*`; design tokens live in the `@theme inline` block of `globals.css`.
- The app is light only: `globals.css` sets `color-scheme: light` and an `@custom-variant` repoints Tailwind's `dark:` variant at a `.dark` ancestor, so the `dark:` utilities still sitting in `components/` never match.
- That class is CopilotKit's own dark-mode hook — its stylesheet has no `prefers-color-scheme` rule anywhere — so putting `.dark` on `<html>` is what would turn the app and the chat over together.
- The `body` rule in `globals.css` applies `--font-geist-sans` globally, so reach for a `font-mono` utility only where the mono face is actually wanted.

## Secrets — `.env`

- Holds `DATABASE_URL` (SQLite, read by both `lib/db.ts` and drizzle-kit, which loads `.env` itself), `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` read by Better Auth itself, and `OPENROUTER_API_KEY`, which Mastra's model router reads directly.
- `.gitignore` covers `.env*`; never commit the file or print its values.

## Tooling — `biome.json`, dependencies

- `@copilotkit/runtime` and AG-UI pull zod 3 while Better Auth pulls zod 4; npm nests the two copies on its own, so there is no `.npmrc` and no `legacy-peer-deps`.
- `@ag-ui/client` and `@ag-ui/core` are direct dependencies only to satisfy `@ag-ui/mastra`'s peers, and have to stay on the exact version `@copilotkit/runtime` pins — a second copy turns the agent into a type error in `CopilotRuntime({ agents })`.
- Biome ignores `.claude/` because its vendored skill assets fail `biome check .`, `drizzle/` because drizzle-kit's generated JSON does not match its formatter, and `public/` because it flags the stock `.svg` assets for a11y titles they do not need.
- `.gitattributes` pins the working tree to `eol=lf`; Biome formats to LF and no `lineEnding` is configured, so a CRLF checkout fails `npm run lint` on every file.
- `npm run format` skips assist actions such as import sorting; use `npx biome check --write <path>` to fix those.

## Maintenance — for you, the agent

- Update this file in the same change set whenever a change invalidates a line here or teaches a costly lesson.
- Prefer deleting over adding and pointers over prose; drop anything a reader would learn just by opening the file a bullet points to.
- One sentence per bullet, current state only, no history or changelog.
