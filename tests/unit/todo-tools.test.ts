// @vitest-environment node
import { RequestContext } from "@mastra/core/request-context";
import { isValidationError, type Tool } from "@mastra/core/tools";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql/node";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import * as schema from "@/lib/schema";
import { user } from "@/lib/schema";
import { createTodoTools, tutorRequestContext } from "@/lib/todo-tools";
import type { TodoDb } from "@/lib/todos";

// The tools take their database as an argument, so the real executors run here
// against a throwaway one — nothing touches data/app.db.
let db: TodoDb;
let tools: ReturnType<typeof createTodoTools>;

const ALICE = tutorRequestContext("user-alice");
const BOB = tutorRequestContext("user-bob");

/**
 * What the agent loop does: hand the validated input in as the first argument
 * and the execution context as the second. Only `requestContext` matters here.
 *
 * Mastra types every executor as also able to return void or a validation
 * error; neither can happen for these, so this narrows past both once instead
 * of at each assertion.
 */
async function run<I, O>(
  tool: Tool<I, O>,
  input: I,
  requestContext: RequestContext,
): Promise<O> {
  if (!tool.execute) {
    throw new Error("tool has no executor");
  }
  const output = await tool.execute(input, { requestContext } as never);
  if (output === undefined || isValidationError(output)) {
    throw new Error(`unexpected tool output: ${JSON.stringify(output)}`);
  }
  return output;
}

beforeAll(async () => {
  db = drizzle({ connection: { url: ":memory:" }, schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  tools = createTodoTools(db);
});

beforeEach(async () => {
  // todos.userId is a FK onto the Better Auth user table, and the cascade
  // clears the todos with it, so each test starts from an empty ledger.
  await db.delete(user);
  await db.insert(user).values([
    { id: "user-alice", name: "Alice", email: "alice@example.com" },
    { id: "user-bob", name: "Bob", email: "bob@example.com" },
  ]);
});

afterAll(() => {
  db.$client.close();
});

describe("addTodo and listTodos", () => {
  test("adds an item and reads it back", async () => {
    const added = await run(tools.addTodo, { title: "buy milk" }, ALICE);

    expect(added.todo).toEqual({
      id: expect.any(String),
      title: "buy milk",
      done: false,
    });

    const { todos } = await run(tools.listTodos, {}, ALICE);
    expect(todos).toEqual([added.todo]);
  });

  test("keeps the order items were added in", async () => {
    for (const title of ["one", "two", "three"]) {
      await run(tools.addTodo, { title }, ALICE);
    }

    const { todos } = await run(tools.listTodos, {}, ALICE);
    expect(todos.map((todo) => todo.title)).toEqual(["one", "two", "three"]);
  });

  test("trims the title the model passes", async () => {
    const { todo } = await run(tools.addTodo, { title: "  buy milk " }, ALICE);
    expect(todo.title).toBe("buy milk");
  });
});

describe("setTodoDone", () => {
  test("ticks an item off and back on", async () => {
    const { todo } = await run(tools.addTodo, { title: "buy milk" }, ALICE);

    const done = await run(
      tools.setTodoDone,
      { id: todo.id, done: true },
      ALICE,
    );
    expect(done).toEqual({ updated: true, todo: { ...todo, done: true } });

    const reopened = await run(
      tools.setTodoDone,
      { id: todo.id, done: false },
      ALICE,
    );
    expect(reopened.todo).toEqual(todo);
  });

  test("reports an unknown id rather than throwing", async () => {
    const result = await run(
      tools.setTodoDone,
      { id: "no-such-id", done: true },
      ALICE,
    );

    expect(result).toEqual({ updated: false, todo: null });
  });
});

describe("per-user isolation", () => {
  test("each user lists only their own items", async () => {
    await run(tools.addTodo, { title: "alice's errand" }, ALICE);
    await run(tools.addTodo, { title: "bob's errand" }, BOB);

    await expect(run(tools.listTodos, {}, ALICE)).resolves.toEqual({
      todos: [expect.objectContaining({ title: "alice's errand" })],
    });
    await expect(run(tools.listTodos, {}, BOB)).resolves.toEqual({
      todos: [expect.objectContaining({ title: "bob's errand" })],
    });
  });

  test("a known id from another user's list is not writable", async () => {
    const { todo } = await run(
      tools.addTodo,
      { title: "alice's errand" },
      ALICE,
    );

    // Bob names Alice's id exactly — the `userId` predicate, not the id's
    // unguessability, is what stops him.
    const attempt = await run(
      tools.setTodoDone,
      { id: todo.id, done: true },
      BOB,
    );

    expect(attempt).toEqual({ updated: false, todo: null });
    await expect(run(tools.listTodos, {}, ALICE)).resolves.toEqual({
      todos: [{ ...todo, done: false }],
    });
  });

  test("a request context without a user id reaches no rows at all", async () => {
    await run(tools.addTodo, { title: "alice's errand" }, ALICE);

    const anonymous = new RequestContext();

    await expect(run(tools.listTodos, {}, anonymous)).rejects.toThrow(/userId/);
    await expect(
      run(tools.addTodo, { title: "smuggled" }, anonymous),
    ).rejects.toThrow(/userId/);
    await expect(
      run(tools.setTodoDone, { id: "any", done: true }, anonymous),
    ).rejects.toThrow(/userId/);
  });

  test("the browser's own AG-UI context cannot pose as the user id", async () => {
    await run(tools.addTodo, { title: "alice's errand" }, ALICE);

    // What the AG-UI bridge does with `input.context` from the client: it only
    // ever writes under its own key, so a forged user id lands nowhere.
    const forged = tutorRequestContext("user-bob");
    forged.setRaw("ag-ui", {
      context: [{ key: "userId", value: "user-alice" }],
    });

    await expect(run(tools.listTodos, {}, forged)).resolves.toEqual({
      todos: [],
    });
  });
});
