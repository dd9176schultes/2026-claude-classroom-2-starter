"use client";

import { useRenderTool } from "@copilotkit/react-core/v2";
import { ToolCallCard } from "@/components/tool-call-card";
import { todoToolSchemas } from "@/lib/todo-tool-schemas";

/**
 * `result` arrives as a string. It is the JSON of the tool's output schema in
 * practice, but a failed call puts something else there, so every reader parses
 * it against the schema and falls back to showing the raw text.
 */
function outcomeFrom<T>(
  result: string | undefined,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  describe: (output: T) => string,
) {
  if (result === undefined) {
    return undefined;
  }
  try {
    const parsed = schema.safeParse(JSON.parse(result));
    if (parsed.success && parsed.data !== undefined) {
      return describe(parsed.data);
    }
  } catch {
    // Not JSON at all — fall through to the raw string.
  }
  return result;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Registers a card for each of the tutor's tools. Called from the chat, which
 * is inside the `CopilotKit` provider these hooks need; without a renderer
 * CopilotKit draws nothing for a tool call and warns about it in development.
 */
export function useTodoToolRenderers() {
  useRenderTool(
    {
      name: "listTodos",
      parameters: todoToolSchemas.listTodos.input,
      render: ({ status, result }) => (
        <ToolCallCard
          name="listTodos"
          status={status}
          args={{}}
          outcome={outcomeFrom(
            result,
            todoToolSchemas.listTodos.output,
            ({ todos }) => {
              const open = todos.filter((todo) => !todo.done).length;
              return `read ${plural(todos.length, "item", "items")}, ${open} still open`;
            },
          )}
        />
      ),
    },
    [],
  );

  useRenderTool(
    {
      name: "addTodo",
      parameters: todoToolSchemas.addTodo.input,
      render: ({ status, parameters, result }) => (
        <ToolCallCard
          name="addTodo"
          status={status}
          args={parameters}
          outcome={outcomeFrom(
            result,
            todoToolSchemas.addTodo.output,
            ({ todo }) => `added “${todo.title}”`,
          )}
        />
      ),
    },
    [],
  );

  useRenderTool(
    {
      name: "setTodoDone",
      parameters: todoToolSchemas.setTodoDone.input,
      render: ({ status, parameters, result }) => (
        <ToolCallCard
          name="setTodoDone"
          status={status}
          // Spelled out so the card lists them in schema order; a streaming
          // call can deliver them either way round.
          args={{ id: parameters.id, done: parameters.done }}
          outcome={outcomeFrom(
            result,
            todoToolSchemas.setTodoDone.output,
            ({ updated, todo }) => {
              if (!updated || !todo) {
                return "no such item on this list";
              }
              return todo.done
                ? `ticked off “${todo.title}”`
                : `reopened “${todo.title}”`;
            },
          )}
        />
      ),
    },
    [],
  );
}
