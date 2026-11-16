import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryCatalog } from "@/components/library-catalog";
import { LIBRARY_HOSTS, LIBRARY_ITEMS } from "@/lib/generated/library-data";
import { HOST_LINES, hostLine, onHosts } from "@/lib/library-hosts-view";
import { HOST_INSTALLS } from "@/lib/host-installs";

describe("per-host line (generated from the manifests)", () => {
  it("has no line for Claude Code, and one for each other host", () => {
    expect(hostLine("claude")).toBeNull();
    expect(HOST_LINES.map((l) => l.id)).toEqual(
      HOST_INSTALLS.map((h) => h.id).filter((id) => id !== "claude"),
    );
  });

  it("Cursor: all 7 skills and 4 agents of the run ship, hooks do not load", () => {
    expect(hostLine("cursor")).toBe(
      "On Cursor: all 7 skills and 4 agents of this run ship; this run's 9 hooks do not load on Cursor.",
    );
  });

  it("Codex: 3 of 7 skills with their $ork- names, 4 roles, and the 9 hooks do not load", () => {
    const line = hostLine("codex") ?? "";
    expect(line).toContain("3 of this run's 7 skills ship ($ork-implement, $ork-explore, $ork-verify)");
    expect(line).toContain("agents run as 4 roles");
    expect(line).toContain("this run's 9 hooks do not load on Codex");
    expect(line).not.toContain("Claude Code only");
  });

  it("Devin shows ? and no count", () => {
    expect(LIBRARY_HOSTS.devin.skills).toBeNull();
    const line = hostLine("devin") ?? "";
    expect(line).toContain("?");
    expect(line).not.toMatch(/\d/);
  });

  it("the starter hosts and Pi each get a generated line", () => {
    for (const id of ["opencode", "muse", "pi", "agy"] as const) {
      expect(hostLine(id), id).toMatch(/^On .+: /);
    }
  });
});

describe("on: marks", () => {
  const find = (kind: string, name: string) =>
    LIBRARY_ITEMS.find((i) => i.kind === kind && i.name === name);

  it("a hook is on Claude Code only", () => {
    const hook = LIBRARY_ITEMS.find((i) => i.kind === "hook");
    expect(hook && onHosts(hook)).toEqual(["Claude Code"]);
  });

  it("implement is on Claude Code, Cursor, Codex and Pi, never on Devin", () => {
    const item = find("skill", "implement");
    const hosts = item ? onHosts(item) : [];
    expect(hosts).toContain("Claude Code");
    expect(hosts).toContain("Cursor");
    expect(hosts).toContain("Codex");
    expect(hosts).toContain("Pi");
    expect(hosts).not.toContain("Devin");
  });

  it("every list row carries its mark in the server HTML", () => {
    const doc = new DOMParser().parseFromString(
      renderToStaticMarkup(<LibraryCatalog />),
      "text/html",
    );
    expect(doc.querySelectorAll("#library-list .lib-on")).toHaveLength(303);
    expect(doc.querySelectorAll("[data-host-line]")).toHaveLength(7);
  });
});
