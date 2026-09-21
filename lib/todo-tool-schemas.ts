import { z } from "zod";

/**
 * The tools' wire contract, kept apart from `lib/todo-tools.ts` because that
 * file reaches the database and this one is imported by the browser: the cards
 * in components/todo-tool-renderers.tsx read the same schemas the executors
 * are built from, so a renamed field is a type error rather than a card that
 * quietly renders `undefined`.
 */

/** Tool ids, which are also the names the model and the renderers use. */
export const TODO_TOOLS = ["listTodos", "addTodo", "setTodoDone"] as const;
export type TodoToolName = (typeof TODO_TOOLS)[number];

const todo = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
});

export const todoToolSchemas = {
  listTodos: {
    input: z.object({}),
    output: z.object({ todos: z.array(todo) }),
  },
  addTodo: {
    input: z.object({
      title: z.string().min(1).describe("The item, e.g. 'buy milk'"),
    }),
    output: z.object({ todo }),
  },
  setTodoDone: {
    input: z.object({
      id: z.string().min(1).describe("The item's id, from listTodos"),
      done: z.boolean().describe("true to complete it, false to reopen it"),
    }),
    output: z.object({
      // `updated: false` is also what a well-formed id belonging to another
      // user looks like from here, which is the point.
      updated: z.boolean(),
      todo: todo.nullable(),
    }),
  },
} as const;
