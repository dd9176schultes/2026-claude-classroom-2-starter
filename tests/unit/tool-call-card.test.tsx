import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { ToolCallCard } from "@/components/tool-call-card";

// Testing Library's default jsdom environment; the card imports no CopilotKit,
// which is the reason it is a component of its own.

test("shows the tool, its arguments and what came back", () => {
  render(
    <ToolCallCard
      name="addTodo"
      status="complete"
      args={{ title: "buy milk" }}
      outcome="added “buy milk”"
    />,
  );

  const card = screen.getByTestId("tool-call");
  expect(card).toHaveAttribute("data-tool", "addTodo");
  expect(card).toHaveAttribute("data-status", "complete");
  expect(card).toHaveTextContent("addTodo");
  expect(card).toHaveTextContent("title");
  expect(card).toHaveTextContent("buy milk");
  expect(card).toHaveTextContent("added “buy milk”");
});

test("says so when a tool takes no arguments", () => {
  render(<ToolCallCard name="listTodos" status="complete" args={{}} />);

  expect(screen.getByTestId("tool-call")).toHaveTextContent("no arguments");
});

test("hides arguments that have not finished streaming in", () => {
  render(
    <ToolCallCard
      name="setTodoDone"
      status="inProgress"
      args={{ id: "todo-1", done: undefined }}
    />,
  );

  const card = screen.getByTestId("tool-call");
  expect(card).toHaveTextContent("todo-1");
  // The key would otherwise read `done undefined` for as long as the model
  // takes to write it.
  expect(card).not.toHaveTextContent("done");
  expect(card).not.toHaveTextContent("no arguments");
});

test("marks an unfinished call as still running, without an outcome", () => {
  render(
    <ToolCallCard name="addTodo" status="executing" args={{ title: "x" }} />,
  );

  const card = screen.getByTestId("tool-call");
  expect(card).toHaveAttribute("data-status", "executing");
  expect(card).toHaveTextContent("running");
  expect(card).not.toHaveTextContent("→");
});

test("renders a non-string argument as its JSON", () => {
  render(
    <ToolCallCard
      name="setTodoDone"
      status="complete"
      args={{ id: "todo-1", done: true }}
      outcome="ticked off “buy milk”"
    />,
  );

  expect(screen.getByTestId("tool-call")).toHaveTextContent("true");
});
