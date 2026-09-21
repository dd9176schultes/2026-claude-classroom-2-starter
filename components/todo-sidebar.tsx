"use client";

import { UseAgentUpdate, useAgent } from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useState } from "react";
import type { TodoView } from "@/lib/todos";

/**
 * The ledger beside the chat: read-only, because the agent's tools are the only
 * write path. It starts from rows the server already had and re-reads
 * /api/todos as the agent works.
 *
 * Both triggers earn their place: the tool result lands the change beside the
 * card that announced it, rather than a sentence later, and the end of the run
 * catches anything that changed the list without a result reaching the browser.
 */
export function TodoSidebar({
  agentId,
  initialTodos,
}: {
  agentId: string;
  initialTodos: TodoView[];
}) {
  const [todos, setTodos] = useState(initialTodos);
  const [stale, setStale] = useState(false);

  // Only the run status is worth a re-render here; the transcript is the
  // chat's business, and the refresh hangs off the subscription below.
  const { agent, isReady } = useAgent({
    agentId,
    updates: [UseAgentUpdate.OnRunStatusChanged],
  });

  const refresh = useCallback(async () => {
    const response = await fetch("/api/todos");
    if (!response.ok) {
      setStale(true);
      return;
    }
    const { todos } = (await response.json()) as { todos: TodoView[] };
    setTodos(todos);
    setStale(false);
  }, []);

  useEffect(() => {
    // Until the runtime's /info sync resolves, `agent` is a placeholder that
    // gets swapped out, and a subscription on it would miss the real runs.
    if (!isReady) {
      return;
    }
    const { unsubscribe } = agent.subscribe({
      onToolCallResultEvent: refresh,
      onRunFinalized: refresh,
    });
    return unsubscribe;
  }, [agent, isReady, refresh]);

  const open = todos.filter((todo) => !todo.done).length;

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between gap-2 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          The list
        </h2>
        <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {agent.isRunning ? "…" : `${open} open`}
        </span>
      </div>

      <ul
        data-testid="todo-list"
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-4"
      >
        {todos.map((todo) => (
          <li
            key={todo.id}
            data-done={todo.done}
            className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-300"
          >
            <span
              aria-hidden
              className="mt-px w-3 shrink-0 text-center text-xs text-zinc-400 dark:text-zinc-500"
            >
              {todo.done ? "✓" : "·"}
            </span>
            <span
              className={
                todo.done
                  ? "min-w-0 break-words text-zinc-400 line-through dark:text-zinc-600"
                  : "min-w-0 break-words"
              }
            >
              {todo.title}
            </span>
          </li>
        ))}
      </ul>

      <p className="border-t border-zinc-200 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {stale
          ? "Out of step with the ledger — reload the page."
          : todos.length === 0
            ? "Nothing on the list yet. Ask Bartholomew to add something."
            : "Bartholomew keeps this; ask him to change it."}
      </p>
    </aside>
  );
}
