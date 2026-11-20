import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { MAX_CATALOG_CHARS as BUILD_MAX, frontmatter, local, purpose, render, scanRoot } from "../scripts/catalog.mjs";
import { MAX_CATALOG_CHARS, NO_CATALOG, SYSTEM, contextBlock, request } from "../src/system.js";

const mod = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE = "## Subagents (delegate with the Agent tool, subagent_type as written)\n- ork:test-generator: Test specialist\n";
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
    for (const catalog of [SAMPLE, null]) {
      expect(SYSTEM + contextBlock(catalog)).not.toMatch(/\b20\d\d-\d\d-\d\d\b|\b\d\d:\d\d(:\d\d)?\b/);
    }
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
    for (const catalog of [SAMPLE, null]) {
      expect(request(catalog, "a").prompt[0]).toEqual(request(catalog, "something else entirely").prompt[0]);
    }
  });

  // XREVIEW HOLD 6358186713: the mod installs without OrchestKit, so with no
  // local catalog the call must not present any tool list as the user's stack.
  test("with no catalog the block names no tools and tells the model to name none", () => {
    for (const catalog of [null, "", "  \n"]) {
      const call = request(catalog, "fix it");
      expect(call.prompt).toHaveLength(2);
      expect(call.prompt[0]).toEqual({ text: NO_CATALOG, cache: true });
      expect(call.prompt[0].text).not.toMatch(/Catalog of this user's stack|ork:|^- /m);
      expect(call.prompt[0].text).toMatch(/Name no subagent, skill, slash command or MCP server/);
      expect(call.prompt[1]).toEqual({ text: "fix it" });
    }
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

describe("no bundled catalog", () => {
  test("the mod ships no tool list of its own", () => {
    expect(existsSync(join(mod, "src", "catalog.ts"))).toBe(false);
    const register = readFileSync(join(mod, "hooks", "register.tsx"), "utf8");
    // \b on both sides: LOCAL_CATALOG and MAX_CATALOG_CHARS are the local path, not a bundled list.
    expect(register).not.toMatch(/catalog\.js|\bCATALOG\b/);
  });
});

// Codex XREVIEW at a8c6b0c8: a merge of main took main's package.json and dropped
// catalog:local while the README still told users to run it.
describe("README commands", () => {
  test("every npm run script the README names exists, with its file", () => {
    const readme = readFileSync(join(mod, "README.md"), "utf8");
    const scripts: Record<string, string> = JSON.parse(readFileSync(join(mod, "package.json"), "utf8")).scripts ?? {};
    const named = [...readme.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]);
    expect(named).toContain("catalog:local");
    for (const name of named) {
      expect(scripts, `README names npm run ${name}`).toHaveProperty([name]);
      const file = scripts[name].match(/^node (\S+)/)?.[1];
      if (file) expect(existsSync(join(mod, file)), `${name} runs ${file}`).toBe(true);
    }
  });
});
