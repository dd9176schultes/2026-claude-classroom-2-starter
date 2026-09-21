import { MastraAgent } from "@ag-ui/mastra";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { auth } from "@/lib/auth";
import { tutorRequestContext } from "@/lib/todo-tools";
import { mastra, TUTOR_AGENT_ID } from "@/lib/tutor";

const basePath = "/api/copilotkit";

async function handler(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // The whole isolation story: both the memory `resourceId` and the `userId`
  // the todo tools read are the verified user id and are never read from the
  // request, so the rows the agent loads and writes belong to the caller by
  // construction. Built per request, hence the runtime is too.
  //
  // `MastraAgent.getLocalAgent` would do the same two lines, but it does not
  // forward `streamServerToolCalls`, and without that the bridge buffers a
  // server tool's call and flushes START/ARGS/END/RESULT together once the
  // tool has already run — so the cards in components/todo-tool-renderers.tsx
  // would only ever appear finished. Safe to turn on because these tools
  // neither suspend nor run as background tasks.
  const agent = new MastraAgent({
    agentId: TUTOR_AGENT_ID,
    agent: mastra.getAgent(TUTOR_AGENT_ID),
    resourceId: session.user.id,
    requestContext: tutorRequestContext(session.user.id),
    streamServerToolCalls: true,
  });

  const runtime = new CopilotRuntime({
    agents: { [TUTOR_AGENT_ID]: agent },
  });

  return createCopilotRuntimeHandler({ runtime, basePath })(request);
}

export const GET = handler;
export const POST = handler;
