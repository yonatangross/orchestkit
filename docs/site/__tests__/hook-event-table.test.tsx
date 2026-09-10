import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DocsTable,
  HookEventTable,
  parseHookEventTable,
  parseHookIndexTable,
} from "@/components/hook-event-table";

describe("parseHookEventTable", () => {
  it("reads a four-column hook event table", () => {
    const rows = parseHookEventTable(
      <>
        <thead>
          <tr>
            <th>Hook</th>
            <th>Matcher</th>
            <th>Behavior</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>session-finalizer</code>
            </td>
            <td>
              <code>*</code>
            </td>
            <td>Fire-and-forget</td>
            <td>Session Finalizer</td>
          </tr>
        </tbody>
      </>,
    );
    expect(rows).toEqual([
      {
        name: "session-finalizer",
        matcher: "*",
        behavior: "Fire-and-forget",
        description: "Session Finalizer",
      },
    ]);
  });

  it("ignores unrelated tables", () => {
    expect(
      parseHookEventTable(
        <tr>
          <th>Category</th>
          <th>Hooks</th>
          <th>Description</th>
        </tr>,
      ),
    ).toBeNull();
  });
});

describe("parseHookIndexTable", () => {
  it("keeps the category href", () => {
    const rows = parseHookIndexTable(
      <>
        <tr>
          <th>Category</th>
          <th>Hooks</th>
          <th>Description</th>
        </tr>
        <tr>
          <td>
            <a href="/docs/reference/hooks/session-end">SessionEnd</a>
          </td>
          <td>7</td>
          <td>Hooks for SessionEnd events</td>
        </tr>
      </>,
    );
    expect(rows).toEqual([
      {
        category: "SessionEnd",
        href: "/docs/reference/hooks/session-end",
        count: "7",
        description: "Hooks for SessionEnd events",
      },
    ]);
  });
});

describe("HookEventTable", () => {
  it("puts the hook name, behavior, and matcher on one card", () => {
    render(
      <HookEventTable
        rows={[
          {
            name: "session-finalizer",
            matcher: "*",
            behavior: "Fire-and-forget",
            description: "Session Finalizer",
          },
        ]}
      />,
    );
    expect(screen.getByText("session-finalizer")).toBeTruthy();
    expect(screen.getByText("Fire-and-forget")).toBeTruthy();
    expect(screen.getByText("matcher *")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("DocsTable", () => {
  it("renders hook index descriptions on each row", () => {
    render(
      <DocsTable>
        <thead>
          <tr>
            <th>Category</th>
            <th>Hooks</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <a href="/docs/reference/hooks/session-end">SessionEnd</a>
            </td>
            <td>7</td>
            <td>Hooks for SessionEnd events</td>
          </tr>
        </tbody>
      </DocsTable>,
    );
    expect(screen.getByText("SessionEnd")).toBeTruthy();
    expect(screen.getByText("Hooks for SessionEnd events")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("replaces hook event tables with items, not a scrollport", () => {
    const { container } = render(
      <DocsTable>
        <thead>
          <tr>
            <th>Hook</th>
            <th>Matcher</th>
            <th>Behavior</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>goal-budget-guard</code>
            </td>
            <td>
              <code>*</code>
            </td>
            <td>Fire-and-forget</td>
            <td>Goal Budget Guard</td>
          </tr>
        </tbody>
      </DocsTable>,
    );
    expect(container.querySelector(".overflow-auto")).toBeNull();
    expect(screen.getByText("goal-budget-guard")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
