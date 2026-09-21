import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { PageHeader } from "@/components/ui/page-header";
import { Workspace } from "@/components/workspace";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { listTodos, toTodoView } from "@/lib/todos";
import { TUTOR_AGENT_ID, tutorThreadId } from "@/lib/tutor";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/login");
  }

  // Rendered with the page so the ledger is never briefly empty; the sidebar
  // re-reads /api/todos itself once the agent has been round.
  const todos = await listTodos(db, session.user.id);

  return (
    <>
      <PageHeader title="Bartholomew" subtitle={session.user.name}>
        <SignOutButton />
      </PageHeader>
      <main className="flex flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-black">
        <Workspace
          agentId={TUTOR_AGENT_ID}
          threadId={tutorThreadId(session.user.id)}
          initialTodos={todos.map(toTodoView)}
        />
      </main>
    </>
  );
}
