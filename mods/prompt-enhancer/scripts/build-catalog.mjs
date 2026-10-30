#!/usr/bin/env node
// npm run catalog:local   write ~/.claude/prompt-enhancer/catalog.md for this machine
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { local } from "./catalog.mjs";

const home = process.env.HOME || homedir();
const out = join(home, ".claude", "prompt-enhancer", "catalog.md");
mkdirSync(dirname(out), { recursive: true });
const text = local(home);
writeFileSync(out, text);
console.log(`wrote ${out} (${text.length} chars, ${text.split("\n").filter(l => l.startsWith("- ")).length} items)`);
