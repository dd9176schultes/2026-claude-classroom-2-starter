// @vitest-environment node
import type { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Both are `server-only` and open a database on import, so the gate is tested
// against stand-ins; only the branch before them is under test here.
const getSession = vi.fn();
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
const getAgent = vi.fn((id: string) => ({ id }));
vi.mock("@/lib/tutor", () => ({
  TUTOR_AGENT_ID: "tutor",
  mastra: { getAgent },
}));

// The route constructs the bridge itself rather than calling
// `MastraAgent.getLocalAgent`, so that `streamServerToolCalls` reaches it.
// Typed on the config it passes so the assertions below can read it.
type BridgeConfig = {
  agentId: string;
  resourceId: string;
  requestContext: RequestContext;
  streamServerToolCalls?: boolean;
};
const bridge = vi.fn((_config: BridgeConfig) => {});
vi.mock("@ag-ui/mastra", () => ({
  MastraAgent: vi.fn(function MastraAgent(this: unknown, config: BridgeConfig) {
    bridge(config);
  }),
}));

const runtimeHandler = vi.fn(async () => new Response("ok"));
vi.mock("@copilotkit/runtime/v2", () => ({
  CopilotRuntime: vi.fn(function CopilotRuntime(this: unknown) {}),
  createCopilotRuntimeHandler: vi.fn(() => runtimeHandler),
}));

const { GET, POST } = await import("@/app/api/copilotkit/[...all]/route");

const runRequest = () =>
  new Request("http://localhost/api/copilotkit/agent/tutor/run", {
    method: "POST",
    body: "{}",
  });

describe("the CopilotKit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects a request without a session and never reaches the agent", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(runRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
    expect(bridge).not.toHaveBeenCalled();
    expect(runtimeHandler).not.toHaveBeenCalled();
  });

  test("gates GET as well, so the agent is not discoverable either", async () => {
    getSession.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/copilotkit/info"),
    );

    expect(response.status).toBe(401);
    expect(runtimeHandler).not.toHaveBeenCalled();
  });

  test("scopes the agent's memory to the session's user id", async () => {
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    const response = await POST(runRequest());

    expect(response.status).toBe(200);
    expect(bridge).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "tutor", resourceId: "user-a" }),
    );
  });

  test("streams server tool calls, which is what the cards render from", async () => {
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    await POST(runRequest());

    // Off, the bridge flushes a tool call only once it has already run, and
    // components/todo-tool-renderers.tsx never draws anything but "complete".
    const [{ streamServerToolCalls }] = bridge.mock.calls[0];
    expect(streamServerToolCalls).toBe(true);
  });

  test("hands the todo tools the same user id on the request context", async () => {
    getSession.mockResolvedValue({ user: { id: "user-a" } });

    await POST(runRequest());

    const [{ requestContext }] = bridge.mock.calls[0];
    expect(requestContext.get("userId")).toBe("user-a");
  });

  test("takes the user id from the session, not from the request", async () => {
    getSession.mockResolvedValue({ user: { id: "user-b" } });

    await POST(
      new Request("http://localhost/api/copilotkit/agent/tutor/run", {
        method: "POST",
        headers: { "x-user-id": "user-a" },
        body: JSON.stringify({
          threadId: "tutor:user-a",
          context: [{ description: "userId", value: "user-a" }],
        }),
      }),
    );

    const [{ resourceId, requestContext }] = bridge.mock.calls[0];
    expect(resourceId).toBe("user-b");
    expect(requestContext.get("userId")).toBe("user-b");
  });
});
