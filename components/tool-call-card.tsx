/**
 * One step of the agent's work, shown in the transcript so the student can see
 * that the butler reaches the list through named tools with arguments rather
 * than by remembering things.
 *
 * Deliberately free of any CopilotKit import: the wiring lives in
 * components/todo-tool-renderers.tsx, and this is a plain component a Vitest
 * test can render on its own.
 */
export type ToolCallStatus = "inProgress" | "executing" | "complete";

const STATUS: Record<ToolCallStatus, { mark: string; label: string }> = {
  // The model is still streaming the arguments in.
  inProgress: { mark: "·", label: "composing" },
  executing: { mark: "·", label: "running" },
  complete: { mark: "✓", label: "" },
};

export function ToolCallCard({
  name,
  status,
  args,
  outcome,
}: {
  name: string;
  status: ToolCallStatus;
  /**
   * The arguments, in the order the schema declares them rather than the order
   * the model happened to emit. Still filling in while `inProgress`, so keys
   * whose value has not arrived yet are dropped rather than shown as `undefined`.
   */
  args: Record<string, unknown>;
  /** One plain-English line about what came back, once it has. */
  outcome?: string;
}) {
  const { mark, label } = STATUS[status];
  const entries = Object.entries(args).filter(
    ([, value]) => value !== undefined,
  );

  return (
    <div
      data-testid="tool-call"
      data-tool={name}
      data-status={status}
      className="my-2 max-w-md rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden
          className={
            status === "complete" ? "text-emerald-600" : "text-zinc-400"
          }
        >
          {mark}
        </span>
        <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
          {name}
        </span>
        {label ? (
          <span className="text-zinc-400 dark:text-zinc-500">{label}…</span>
        ) : null}
      </div>

      <dl className="mt-1 pl-4">
        {entries.length === 0 ? (
          <dd className="text-zinc-400 dark:text-zinc-500">no arguments</dd>
        ) : (
          entries.map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <dt className="font-mono text-zinc-400 dark:text-zinc-500">
                {key}
              </dt>
              <dd className="min-w-0 break-words font-mono text-zinc-700 dark:text-zinc-300">
                {typeof value === "string" ? value : JSON.stringify(value)}
              </dd>
            </div>
          ))
        )}
      </dl>

      {outcome ? (
        <p className="mt-1 pl-4 text-zinc-500 dark:text-zinc-400">
          → {outcome}
        </p>
      ) : null}
    </div>
  );
}
