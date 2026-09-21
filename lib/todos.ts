import { and, asc, eq, sql } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/libsql/node";
import type * as schema from "@/lib/schema";
import { type Todo, todos } from "@/lib/schema";

/**
 * A Drizzle handle over lib/schema.ts. Taken as an argument rather than
 * imported from lib/db.ts so these queries stay free of the `server-only`
 * marker and a test can run them against a throwaway database.
 */
export type TodoDb = ReturnType<typeof drizzle<typeof schema>>;

/** What the browser is given: the row minus the timestamp it never renders. */
export type TodoView = { id: string; title: string; done: boolean };

export function toTodoView({ id, title, done }: Todo): TodoView {
  return { id, title, done };
}

/**
 * Every query here takes `userId` and filters on it, including the writes —
 * that predicate is the whole of the per-user isolation, since an id alone is
 * guessable and the tools hand one straight from the model to the database.
 */
export function listTodos(db: TodoDb, userId: string) {
  return (
    db
      .select()
      .from(todos)
      .where(eq(todos.userId, userId))
      // created_at is `unixepoch()`, so a turn that adds several items ties on
      // the second; rowid breaks the tie back into insertion order.
      .orderBy(asc(todos.createdAt), sql`rowid`)
  );
}

export async function addTodo(db: TodoDb, userId: string, title: string) {
  const [row] = await db
    .insert(todos)
    .values({ userId, title: title.trim() })
    .returning();
  return row;
}

/** `null` when the id is not this user's — an unknown id and someone else's are
 * deliberately indistinguishable from the outside. */
export async function setTodoDone(
  db: TodoDb,
  userId: string,
  id: string,
  done: boolean,
) {
  const [row] = await db
    .update(todos)
    .set({ done })
    .where(and(eq(todos.id, id), eq(todos.userId, userId)))
    .returning();
  return row ?? null;
}
