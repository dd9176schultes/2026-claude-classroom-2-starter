import { expect, test } from "@playwright/test";

/**
 * The only test in the suite that spends a model call, which is why it is the
 * `llm` project and not part of `npm run test:e2e`. Run it with
 * `npm run test:e2e:llm`; it needs a working OPENROUTER_API_KEY in .env.
 *
 * It is here because nothing else covers the seam that actually breaks on an
 * upgrade: the model choosing addTodo, the route putting the session's user id
 * on the request context, the tool writing the row, and the sidebar noticing.
 */
test("the tutor puts a spoken item on the list, and the sidebar shows it", async ({
  page,
}) => {
  // Real dev server, real data/app.db — so the email has to be unique per run.
  const email = `e2e-llm-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL("/");

  const list = page.getByTestId("todo-list");
  await expect(list).toBeVisible();
  await expect(list.getByRole("listitem")).toHaveCount(0);

  await page
    .getByTestId("copilot-chat-textarea")
    .fill("Please add buy milk to my list.");

  // CopilotKit keeps the send button disabled until /agent/tutor/connect comes
  // back, which on a cold .next-e2e is several seconds after the box appears —
  // pressing Enter before that silently does nothing.
  const send = page.getByTestId("copilot-send-button");
  await expect(send).toBeEnabled();
  await send.click();

  // The sidebar is read-only and re-reads /api/todos off the agent, so an item
  // here means the tool really wrote a row for this user.
  await expect(list.getByRole("listitem")).toHaveText([/buy milk/i]);

  // And the transcript shows the student how it got there: the tool by name,
  // the argument the model chose, and what came back.
  const addCard = page
    .locator("[data-testid='tool-call'][data-tool='addTodo']")
    .first();
  await expect(addCard).toHaveAttribute("data-status", "complete");
  await expect(addCard).toContainText("title");
  await expect(addCard).toContainText(/buy milk/i);
  await expect(addCard).toContainText(/added/i);

  // And the row belongs to the session, not to the page: a reload rebuilds the
  // list from the server.
  await page.reload();
  await expect(page.getByTestId("todo-list").getByRole("listitem")).toHaveText([
    /buy milk/i,
  ]);
});
