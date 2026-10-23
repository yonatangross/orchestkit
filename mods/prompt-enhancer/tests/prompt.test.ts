import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { MAX_CATALOG_CHARS as BUILD_MAX, bundled, frontmatter, local, module, purpose, render, scanRoot } from "../scripts/catalog.mjs";
import { CATALOG } from "../src/catalog.js";
import { MAX_CATALOG_CHARS, SYSTEM, contextBlock, request } from "../src/system.js";

const mod = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const put = (path: string, text: string) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };

// Dogfood 2026-10-22: a 4-word draft came back as an essay that invented a repo,
// listed interpretations and asked questions. These pin the rules that stop that.
describe("system prompt", () => {
  test("never asks questions or lists interpretations, and picks the likely meaning", () => {
    expect(SYSTEM).toContain("Never ask questions.");
    expect(SYSTEM).toContain("Never list interpretations");
    expect(SYSTEM).toContain("most likely meaning");
    expect(SYSTEM).not.toMatch(/ask the user|name material ambiguities/i);
  });

  test("keeps the rewrite short and ends it with one Done when line", () => {
    expect(SYSTEM).toMatch(/at most 3 added lines/);
    expect(SYSTEM).toMatch(/Never more than 6 lines/);
    expect(SYSTEM).toContain('"Done when:"');
    for (const example of SYSTEM.split("Rewrite:\n").slice(1)) {
      const lines = example.split("\n\n")[0].trim().split("\n");
      expect(lines.length).toBeLessThanOrEqual(6);
      expect(lines.at(-1)).toMatch(/^Done when: /);
      expect(example.split("\n\n")[0]).not.toContain("?");
    }
  });

  test("names only catalog tools and invents nothing", () => {
    expect(SYSTEM).toMatch(/copied exactly from the catalog/);
    expect(SYSTEM).toMatch(/Never invent a tool, file path, repo, URL, credential/);
  });

  test("its Hebrew layout map decodes the documented example", () => {
    const map = Object.fromEntries([...SYSTEM.matchAll(/(\S)=(\S)(?=[ )])/g)].map(([, en, he]) => [he, en]));
    const decode = (text: string) => [...text].map(ch => map[ch] ?? ch).join("");
    expect(decode("גם ןא שךך")).toBe("do it all");
    expect(decode("ןא שךך")).toBe("it all");
  });

  test("the static prefix carries no date, time or counter", () => {
    const prefix = SYSTEM + contextBlock(CATALOG);
    expect(prefix).not.toMatch(/\b20\d\d-\d\d-\d\d\b|\b\d\d:\d\d(:\d\d)?\b/);
  });
});

describe("request", () => {
  test("one cache breakpoint, on the catalog block, with the draft after it", () => {
    const call = request("- ork:test-generator: Test specialist", "fix it");
    expect(call).toMatchObject({ model: "haiku", system: SYSTEM, maxTokens: 1024, effort: "low", timeoutMs: 12000 });
    expect(call.prompt).toHaveLength(2);
    expect(call.prompt[0].cache).toBe(true);
    expect(call.prompt[0].text).toContain("- ork:test-generator: Test specialist");
    expect(call.prompt[1]).toEqual({ text: "fix it" });
  });

  test("the prefix does not depend on the draft", () => {
    expect(request(CATALOG, "a").prompt[0]).toEqual(request(CATALOG, "something else entirely").prompt[0]);
  });

  test("the runtime and build caps agree", () => {
    expect(MAX_CATALOG_CHARS).toBe(BUILD_MAX);
  });
});

describe("catalog builder", () => {
  test("frontmatter reads quoted, plain and folded values", () => {
    expect(frontmatter('---\nname: a\ndescription: "Quoted: yes."\n---\nbody')).toMatchObject({ name: "a", description: "Quoted: yes." });
    expect(frontmatter("---\nname: b\ndescription: >-\n  Folded line one.\n  Line two.\nuser-invocable: false\n---")).toMatchObject({ description: "Folded line one. Line two.", "user-invocable": "false" });
    expect(frontmatter("no frontmatter")).toEqual({});
  });

  test("purpose keeps the first sentence, drops dashes and cuts long text", () => {
    expect(purpose("Does one thing. Then more.", 90)).toBe("Does one thing");
    expect(purpose("A \u2014 B", 90)).toBe("A , B");
    expect(purpose("x".repeat(200), 60)).toHaveLength(60);
    expect(purpose("anything", 0)).toBe("");
  });

  test("render is deterministic: input order never changes the bytes", () => {
    const agents = [{ id: "b", description: "B agent." }, { id: "a", description: "A agent." }];
    const one = render({ agents, mcp: ["z", "y"] });
    const two = render({ agents: [...agents].reverse(), mcp: ["z", "y"] });
    expect(one).toBe(two);
    expect(one.indexOf("- a: A agent")).toBeLessThan(one.indexOf("- b: B agent"));
    expect(one).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
  });

  test("render shortens purposes, then drops them, to stay under the cap", () => {
    const agents = Array.from({ length: 600 }, (_, i) => ({ id: `agent-${String(i).padStart(3, "0")}`, description: "y".repeat(120) }));
    const text = render({ agents });
    expect(text.length).toBeLessThanOrEqual(BUILD_MAX);
    expect(text).toContain("- agent-000");
  });

  test("scanRoot prefixes plugin items, marks slash commands and skips skills nobody can invoke", () => {
    const root = mkdtempSync(join(tmpdir(), "pe-root-"));
    put(join(root, "agents", "fixer.md"), "---\nname: fixer\ndescription: Fixes things.\n---");
    put(join(root, "agents", "README.md"), "# not an agent");
    put(join(root, "skills", "shown", "SKILL.md"), "---\nname: shown\ndescription: Shown skill.\n---");
    put(join(root, "skills", "model-only", "SKILL.md"), "---\nname: model-only\ndescription: Model only.\nuser-invocable: false\n---");
    put(join(root, "skills", "hidden", "SKILL.md"), "---\nname: hidden\ndescription: Preload only.\nuser-invocable: false\ndisable-model-invocation: true\n---");
    put(join(root, "commands", "go.md"), "---\ndescription: Go now.\n---");
    const found = scanRoot(root, "kit");
    expect(found.agents.map(a => a.id)).toEqual(["kit:fixer"]);
    expect(found.skills.map(s => s.id).sort()).toEqual(["/kit:shown", "kit:model-only"]);
    expect(found.commands.map(c => c.id)).toEqual(["/kit:go"]);
  });

  test("local reads enabled plugins and MCP names only, never server config", () => {
    const home = mkdtempSync(join(tmpdir(), "pe-home-"));
    const on = join(home, "cache", "on");
    const off = join(home, "cache", "off");
    put(join(home, ".claude", "skills", "mine", "SKILL.md"), "---\nname: mine\ndescription: My skill.\n---");
    put(join(on, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "kit" }));
    put(join(on, "agents", "lane.md"), "---\nname: lane\ndescription: Lane worker.\n---");
    put(join(on, ".mcp.json"), JSON.stringify({ docs: { command: "npx", args: ["--token", "SECRET-ARG"] } }));
    put(join(off, "agents", "nope.md"), "---\nname: nope\ndescription: Disabled.\n---");
    put(join(home, ".claude", "settings.json"), JSON.stringify({ enabledPlugins: { "kit@m": true, "off@m": false } }));
    put(join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({ plugins: { "kit@m": [{ installPath: on }], "off@m": [{ installPath: off }] } }));
    put(join(home, ".claude.json"), JSON.stringify({ mcpServers: { context7: { env: { API_KEY: "SECRET-ENV" } } } }));
    put(join(home, ".claude", "prompt-enhancer", "notes.md"), "- conductor routes work to lanes.");
    const text = local(home);
    expect(text).toContain("- /mine: My skill");
    expect(text).toContain("- kit:lane: Lane worker");
    expect(text).not.toContain("nope");
    expect(text).toContain("- context7");
    expect(text).toContain("- kit:docs");
    expect(text).not.toMatch(/SECRET|npx|--token/);
    expect(text).toContain("## Notes on this setup\n- conductor routes work to lanes.");
    expect(local(home)).toBe(text);
  });
});

describe("bundled catalog", () => {
  test("is compact and names OrchestKit's own agents", () => {
    expect(CATALOG.length).toBeLessThanOrEqual(BUILD_MAX);
    expect(CATALOG).toContain("- ork:test-generator: ");
    expect(CATALOG).toMatch(/^## Subagents/);
  });

  // Inside the orchestkit repo the sources are two levels up; an installed copy
  // has no sources, so there is nothing to compare against.
  const repo = resolve(mod, "..", "..");
  test.skipIf(!existsSync(join(repo, "src", "agents")))("matches the repo sources (run npm run catalog when this fails)", () => {
    expect(readFileSync(join(mod, "src", "catalog.ts"), "utf8")).toBe(module(bundled(repo)));
  });
});
