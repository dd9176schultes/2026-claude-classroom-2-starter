"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { Chat } from "@/components/chat";
import { TodoSidebar } from "@/components/todo-sidebar";
import type { TodoView } from "@/lib/todos";

/**
 * The two panes and the provider they share — the sidebar subscribes to the
 * same agent the chat drives, so both have to sit under one `CopilotKit`.
 *
 * `CopilotChat` renders its own `display: contents` wrapper and carries
 * `h-full` inside it, which Chromium will not resolve through — so the chat
 * only ever gets its height from growing along a flex *column*. Hence the
 * column around it inside the row, rather than leaning on the row's stretch.
 */
export function Workspace({
  agentId,
  threadId,
  initialTodos,
}: {
  agentId: string;
  threadId: string;
  initialTodos: TodoView[];
}) {
  return (
    // The Inspector is on by default in development builds and never loads in a
    // production one, so `enableInspector` is left unset deliberately;
    // `showDevConsole` is deprecated and no longer controls it either way.
    // app/globals.css moves its launcher off the header's sign-out button.
    <CopilotKit runtimeUrl="/api/copilotkit" credentials="include">
      <div className="flex min-h-0 flex-1">
        <TodoSidebar agentId={agentId} initialTodos={initialTodos} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Chat agentId={agentId} threadId={threadId} />
        </div>
      </div>
    </CopilotKit>
  );
}
