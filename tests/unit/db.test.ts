// @vitest-environment node
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql/node";
import { afterAll, beforeAll, expect, test } from "vitest";

import { todos, user } from "@/lib/schema";

// lib/db.ts is `server-only` and bound to DATABASE_URL, so the test builds its
// own in-memory instance to exercise the real migrations.
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  db = drizzle({ connection: { url: ":memory:" } });
  await migrate(db, { migrationsFolder: "./drizzle" });

  // todos.userId is a FK onto the Better Auth user table.
  await db.insert(user).values([
    { id: "user-1", name: "User One", email: "one@example.com" },
    { id: "user-2", name: "User Two", email: "two@example.com" },
  ]);
});

afterAll(() => {
  db.$client.close();
});

test("inserts and reads back a todo", async () => {
  const [inserted] = await db
    .insert(todos)
    .values({ userId: "user-1", title: "Write the tutor" })
    .returning();

  expect(inserted.id).toEqual(expect.any(String));
  expect(inserted.done).toBe(false);
  expect(inserted.createdAt).toBeInstanceOf(Date);

  const rows = await db.select().from(todos).where(eq(todos.userId, "user-1"));
  expect(rows).toEqual([inserted]);
});

test("scopes rows by userId", async () => {
  await db.insert(todos).values({ userId: "user-2", title: "Other user" });

  const rows = await db.select().from(todos).where(eq(todos.userId, "user-2"));
  expect(rows.map((r) => r.title)).toEqual(["Other user"]);
});
