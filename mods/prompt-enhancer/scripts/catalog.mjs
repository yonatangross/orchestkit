// Builds the compact stack catalog the Prompt Enhancer sends ahead of each draft.
//
// The catalog is the cacheable prefix of every Enhance call, so its bytes must be
// identical from one call to the next: no timestamps, no host-specific ordering,
// items sorted by a plain code-unit comparison, sections in a fixed order. Two
// sources, one format:
//   bundled  OrchestKit's own agents and skills (src/agents, src/skills), written
//            to src/catalog.ts and committed, so a fresh install has a catalog.
//   local    what this machine has: ~/.claude agents, skills and commands, the
//            enabled plugins' agents, skills, commands and MCP servers, user MCP
//            servers from ~/.claude.json, and an optional hand-written notes file.
//            Written to ~/.claude/prompt-enhancer/catalog.md, which the mod reads
//            in place of the bundled one when it exists.
// Only names, one-line purposes and MCP server names are emitted: never an MCP
// server's command, args, env or URL, which can carry credentials.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

export const MAX_CATALOG_CHARS = 24000;
const PURPOSE_STEPS = [90, 60, 40, 0];
const NOTES_MAX = 2000;

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const clean = text => text.replace(/[\u2013\u2014]/g, ",").replace(/\s+/g, " ").trim();

/** The frontmatter fields the catalog needs, from a small YAML subset. */
export function frontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const out = {};
  for (let i = 0; i < lines.length; i++) {
    const field = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(lines[i]);
    if (!field) continue;
    const [, key, raw] = field;
    let value = raw.trim();
    if (/^[>|][-+]?$/.test(value)) {
      const body = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === "")) body.push(lines[++i].trim());
      value = body.join(" ");
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }
    if (!(key in out)) out[key] = value;
  }
  return out;
}

/** First sentence of a description, cut to `max` characters (0 drops it). */
export function purpose(description, max) {
  if (!max || !description) return "";
  const text = clean(description);
  const sentence = (/^(.+?[.!?])(\s|$)/.exec(text)?.[1] ?? text).replace(/[.!?]$/, "");
  return sentence.length <= max ? sentence : `${sentence.slice(0, max - 3).trimEnd()}...`;
}

const files = (dir, test) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().map(name => join(dir, name)).filter(test);
};
const read = path => { try { return readFileSync(path, "utf8"); } catch { return ""; } };
const isFile = path => { try { return statSync(path).isFile(); } catch { return false; } };

/** Agents, skills and commands under one root (a plugin or ~/.claude). */
export function scanRoot(root, prefix) {
  const ns = prefix ? `${prefix}:` : "";
  const agents = files(join(root, "agents"), p => p.endsWith(".md") && basename(p) !== "README.md" && isFile(p)).map(p => {
    const fm = frontmatter(read(p));
    return { id: `${ns}${fm.name || basename(p, ".md")}`, description: fm.description || "" };
  });
  const skills = [];
  for (const dir of files(join(root, "skills"), p => isFile(join(p, "SKILL.md")))) {
    const fm = frontmatter(read(join(dir, "SKILL.md")));
    const userInvocable = fm["user-invocable"] !== "false";
    const modelInvocable = fm["disable-model-invocation"] !== "true";
    // A skill nobody can invoke (only agents preload it) is not routable from a prompt.
    if (!userInvocable && !modelInvocable) continue;
    const name = `${ns}${fm.name || basename(dir)}`;
    skills.push({ id: userInvocable ? `/${name}` : name, description: fm.description || "" });
  }
  const commands = files(join(root, "commands"), p => p.endsWith(".md") && isFile(p)).map(p => {
    const fm = frontmatter(read(p));
    return { id: `/${ns}${basename(p, ".md")}`, description: fm.description || "" };
  });
  return { agents, skills, commands };
}

/** Renders the catalog, shortening purposes until it fits MAX_CATALOG_CHARS. */
export function render({ agents = [], skills = [], commands = [], mcp = [], notes = "" }) {
  const sections = (max) => {
    const list = (title, items) => items.length === 0 ? [] : [
      `## ${title}`,
      ...[...items].sort(byId).map(item => { const p = purpose(item.description, max); return p ? `- ${item.id}: ${p}` : `- ${item.id}`; }),
      "",
    ];
    return [
      ...list("Subagents (delegate with the Agent tool, subagent_type as written)", agents),
      ...list("Skills (a leading / means it is also a slash command)", skills),
      ...list("Slash commands", commands),
      ...list("MCP servers", mcp.map(name => ({ id: name, description: "" }))),
      // Notes keep their own line breaks; only dashes and CRLF are normalized.
      ...(notes.trim() ? ["## Notes on this setup", notes.replace(/\r\n/g, "\n").replace(/[\u2013\u2014]/g, ",").trim().slice(0, NOTES_MAX), ""] : []),
    ].join("\n").trimEnd() + "\n";
  };
  for (const max of PURPOSE_STEPS) {
    const text = sections(max);
    if (text.length <= MAX_CATALOG_CHARS || max === 0) return text.slice(0, MAX_CATALOG_CHARS);
  }
  return "";
}

/** OrchestKit's own catalog, from the repo sources. */
export function bundled(repoRoot) {
  const { agents, skills, commands } = scanRoot(join(repoRoot, "src"), "ork");
  return render({ agents, skills, commands });
}

const json = path => { try { return JSON.parse(read(path)); } catch { return undefined; } };
// A plugin's .mcp.json may wrap its servers in mcpServers or list them at the top level.
const mcpNames = config => {
  const servers = config?.mcpServers ?? config;
  return servers && typeof servers === "object" && !Array.isArray(servers) ? Object.keys(servers) : [];
};

/** This machine's catalog, from ~/.claude and the enabled plugins. */
export function local(home) {
  const claude = join(home, ".claude");
  const merged = { agents: [], skills: [], commands: [], mcp: new Set() };
  const add = part => { merged.agents.push(...part.agents); merged.skills.push(...part.skills); merged.commands.push(...part.commands); };
  add(scanRoot(claude, ""));
  const enabled = json(join(claude, "settings.json"))?.enabledPlugins ?? {};
  const installed = json(join(claude, "plugins", "installed_plugins.json"));
  const plugins = installed?.plugins ?? installed ?? {};
  for (const key of Object.keys(plugins).sort()) {
    if (enabled[key] !== true) continue;
    const entry = Array.isArray(plugins[key]) ? plugins[key][0] : plugins[key];
    const root = entry?.installPath;
    if (!root || !existsSync(root)) continue;
    const name = json(join(root, ".claude-plugin", "plugin.json"))?.name || key.split("@")[0];
    add(scanRoot(root, name));
    for (const server of mcpNames(json(join(root, ".mcp.json")))) merged.mcp.add(`${name}:${server}`);
  }
  for (const server of mcpNames({ mcpServers: json(join(home, ".claude.json"))?.mcpServers ?? {} })) merged.mcp.add(server);
  const dedupe = items => [...new Map(items.map(item => [item.id, item])).values()];
  return render({
    agents: dedupe(merged.agents), skills: dedupe(merged.skills), commands: dedupe(merged.commands),
    mcp: [...merged.mcp].sort(), notes: read(join(claude, "prompt-enhancer", "notes.md")),
  });
}

/** The TypeScript module that carries the bundled catalog. */
export const module = text => `// Generated by scripts/build-catalog.mjs from src/agents and src/skills. Do not edit.\n// Regenerate: npm run catalog (in mods/prompt-enhancer).\nexport const CATALOG = ${JSON.stringify(text)};\n`;
