import { RequestContext } from "@mastra/core/request-context";
import { createTool } from "@mastra/core/tools";
import { todoToolSchemas } from "@/lib/todo-tool-schemas";
import {
  addTodo,
  listTodos,
  setTodoDone,
  type TodoDb,
  toTodoView,
} from "@/lib/todos";

/**
 * The one key the tutor's tools read. It is written in the route from the
 * verified session and never from the request body, so the model cannot name
 * the user whose list it edits — the worst it can do is pass a wrong todo id,
 * which the `userId` predicate in lib/todos.ts turns into "not found".
 *
 * Deliberately an untyped `RequestContext`: the one Mastra hands a tool is
 * `RequestContext<unknown>`, and the class is invariant in that parameter, so
 * a declared shape here would not be assignable there. `userIdFrom` narrows at
 * the boundary instead, which is where the check has to happen anyway.
 */
export const TUTOR_USER_ID_KEY = "userId";

export function tutorRequestContext(userId: string) {
  const requestContext = new RequestContext();
  requestContext.set(TUTOR_USER_ID_KEY, userId);
  return requestContext;
}

/**
 * The AG-UI bridge writes the client's own `input.context` onto this same
 * RequestContext, but only ever under its own "ag-ui" key, so `userId` cannot
 * be shadowed from the browser. Absent it, refuse rather than guess.
 */
function userIdFrom(context: { requestContext?: RequestContext }) {
  const userId = context.requestContext?.get(TUTOR_USER_ID_KEY);
  if (typeof userId !== "string" || userId === "") {
    throw new Error("todo tools: no userId on the request context");
  }
  return userId;
}

/**
 * Built per database handle so a test can hand in a throwaway one; the app
 * builds them once in lib/tutor.ts against the shared connection.
 *
 * The keys of the returned record are the names the model sees, so they match
 * each tool's `id` (see the createTool docs on `toolName`) and the names the
 * cards are registered under.
 */
export function createTodoTools(db: TodoDb) {
  return {
    listTodos: createTool({
      id: "listTodos",
      description:
        "Read back the signed-in user's entire to-do list, oldest item first. Call this before answering any question about what is on the list, and after changing it if you need the current ids.",
      inputSchema: todoToolSchemas.listTodos.input,
      outputSchema: todoToolSchemas.listTodos.output,
      execute: async (_input, context) => {
        const rows = await listTodos(db, userIdFrom(context));
        return { todos: rows.map(toTodoView) };
      },
    }),

    addTodo: createTool({
      id: "addTodo",
      description:
        "Put one new item on the signed-in user's to-do list. Pass the item as the user would say it, without a leading verb like 'todo' or 'add'.",
      inputSchema: todoToolSchemas.addTodo.input,
      outputSchema: todoToolSchemas.addTodo.output,
      execute: async ({ title }, context) => {
        const row = await addTodo(db, userIdFrom(context), title);
        return { todo: toTodoView(row) };
      },
    }),

    setTodoDone: createTool({
      id: "setTodoDone",
      description:
        "Tick one item off the signed-in user's list, or un-tick it. Take the id from listTodos rather than inventing one.",
      inputSchema: todoToolSchemas.setTodoDone.input,
      outputSchema: todoToolSchemas.setTodoDone.output,
      execute: async ({ id, done }, context) => {
        const row = await setTodoDone(db, userIdFrom(context), id, done);
        return { updated: row !== null, todo: row ? toTodoView(row) : null };
      },
    }),
  };
}
