"use client";

import { CopilotChat } from "@copilotkit/react-core/v2";
import { useTodoToolRenderers } from "@/components/todo-tool-renderers";

/**
 * `threadId` is handed down from the server-rendered session rather than picked
 * here, so a reload rejoins the same Mastra thread instead of starting a new
 * one. See lib/tutor.ts for why a forged one is useless.
 *
 * The surrounding `CopilotKit` provider lives in components/workspace.tsx,
 * because the sidebar's `useAgent` needs to sit inside it too.
 */
export function Chat({
  agentId,
  threadId,
}: {
  agentId: string;
  threadId: string;
}) {
  // Registration is global to the provider, but it belongs with the transcript
  // these cards are drawn into.
  useTodoToolRenderers();

  return (
    <CopilotChat
      agentId={agentId}
      threadId={threadId}
      // Grows down the column its wrapper makes; see components/workspace.tsx.
      className="min-h-0 flex-1"
      labels={{
        chatInputPlaceholder: "Add something to the list…",
      }}
    />
  );
}
