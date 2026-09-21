import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listTodos, toTodoView } from "@/lib/todos";

/**
 * The sidebar's refresh path, and read-only on purpose: the agent's tools are
 * the only way a row is written, so there is no POST/PATCH here to keep in
 * step with them. Scoped to the session's user, like everything else.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await listTodos(db, session.user.id);
  return Response.json({ todos: rows.map(toTodoView) });
}
