#!/usr/bin/env node
// npm run catalog         rewrite src/catalog.ts from the repo's src/agents and src/skills
// npm run catalog:check   exit 1 when src/catalog.ts is stale
// npm run catalog:local   write ~/.claude/prompt-enhancer/catalog.md for this machine
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundled, local, module } from "./catalog.mjs";

const mod = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(mod, "src", "catalog.ts");
const mode = process.argv[2] ?? "--bundled";

if (mode === "--local") {
  const home = process.env.HOME || homedir();
  const out = join(home, ".claude", "prompt-enhancer", "catalog.md");
  mkdirSync(dirname(out), { recursive: true });
  const text = local(home);
  writeFileSync(out, text);
  console.log(`wrote ${out} (${text.length} chars, ${text.split("\n").filter(l => l.startsWith("- ")).length} items)`);
} else {
  const text = module(bundled(resolve(mod, "..", "..")));
  if (mode === "--check") {
    let current = "";
    try { current = readFileSync(target, "utf8"); } catch { /* missing counts as stale */ }
    if (current !== text) { console.error("src/catalog.ts is stale: run npm run catalog in mods/prompt-enhancer"); process.exit(1); }
    console.log("src/catalog.ts is current");
  } else {
    writeFileSync(target, text);
    console.log(`wrote ${target} (${text.length} chars)`);
  }
}
