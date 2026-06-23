#!/usr/bin/env bash
# run-activation-audit.sh — Audit OrchestKit sub-agent activation from spawn telemetry.
# Computes the generic-vs-specialist spawn split, per-agent fire counts, the
# never-fired set, concentration, and per-agent skill-reference counts.
# Read-only. Requires: node. Run from the repo root (or anywhere — it self-locates).
# Usage: scripts/run-activation-audit.sh [--json]
set -euo pipefail

JSON=false
case "${1:-}" in
  --json) JSON=true ;;
  --help|-h) echo "Usage: $0 [--json]  — audit agent activation from .claude/logs/subagent-spawns.jsonl"; exit 0 ;;
  "") ;;
  *) echo "Unknown option: ${1}. Use --help." >&2; exit 2 ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

JSON_MODE="$JSON" REPO="$REPO_ROOT" node -e '
const fs = require("node:fs");
const cp = require("node:child_process");
const repo = process.env.REPO;
const jsonMode = process.env.JSON_MODE === "true";
const rd = (p) => { try { return fs.readFileSync(p,"utf8").split("\n").filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean) } catch { return [] } };

const spawnFile = `${repo}/.claude/logs/subagent-spawns.jsonl`;
const spawns = rd(spawnFile);
const inv = fs.readdirSync(`${repo}/src/agents`).filter(f=>f.endsWith(".md")&&!/^(README|INDEX|CONTRIBUTING)\.md$/i.test(f)).map(f=>f.replace(/\.md$/,"")).sort();
const invSet = new Set(inv);
const BUILTIN = new Set(["Explore","general-purpose","Plan","workflow-subagent","statusline-setup"]);
const norm = (n)=>String(n||"?").replace(/^ork:/,"");

let g=0,o=0,other=0,unknown=0; const fires={}; let mn=null,mx=null;
for (const s of spawns){
  const raw = s.subagent_type||s.agent||s.agent_type||"?";
  const n = norm(raw); const t = s.timestamp||s.ts;
  if (t){ if(!mn||t<mn)mn=t; if(!mx||t>mx)mx=t; }
  if (n==="?"||n===""){ unknown++; continue; }
  if (BUILTIN.has(raw)||BUILTIN.has(n)) g++;
  else if (invSet.has(n)){ o++; fires[n]=(fires[n]||0)+1; }
  else other++;
}
const tot = spawns.length || 1;
const pct = (x)=>Math.round(x/tot*100);
const fired = inv.filter(a=>fires[a]);
const never = inv.filter(a=>!fires[a]);
// skill-reference count per agent (the root-cause signal). grep exits non-zero on
// zero matches by design; we want the count, not its exit status.
const skillRefs = {};
for (const a of inv){
  let c = 0;
  try { c = parseInt(cp.execSync(`grep -rl "ork:${a}" "${repo}/src/skills/" | wc -l`,{encoding:"utf8",stdio:["pipe","pipe","ignore"]}).trim(),10) || 0; } // silent: best-effort — grep non-zero on no-match is expected, not an error
  catch { c = 0; }
  skillRefs[a] = c;
}
const top5 = Object.values(fires).sort((a,b)=>b-a).slice(0,5).reduce((a,b)=>a+b,0);
const conc = o ? Math.round(top5/o*100) : 0;

if (jsonMode){
  console.log(JSON.stringify({ window:[mn,mx], total:tot, totals:{generic:g,ork:o,other,unknown},
    agents: inv.map(a=>({name:a,fires:fires[a]||0,skillRefs:skillRefs[a]})), conc_top5_pct:conc }, null, 2));
  process.exit(0);
}

const bar=(p)=>"#".repeat(Math.round(p/2.7)).padEnd(37,".");
console.log(`\nAGENT SPAWNS (${tot} total · ${(mn||"?").slice(0,10)} -> ${(mx||"?").slice(0,10)})`);
console.log(`  generic CC    ${bar(pct(g))}  ${pct(g)}%`);
console.log(`  ork catalog   ${bar(pct(o))}  ${pct(o)}%`);
console.log(`  other-plugin  ${bar(pct(other))}  ${pct(other)}%`);
console.log(`\n  fired: ${fired.length}/${inv.length} · dormant: ${never.length} · top-5 = ${conc}% of ork spawns`);
console.log(`\n  TOP FIRED:`);
Object.entries(fires).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([n,c])=>console.log(`    ${String(c).padStart(4)}  ${n}  (skill-refs: ${skillRefs[n]})`));
console.log(`\n  NEVER FIRED (${never.length}) — classify via rules/activation-status.md:`);
never.forEach(n=>console.log(`    ${n}  (skill-refs: ${skillRefs[n]})  ${skillRefs[n]===0?"DEAD?":"wired — mis-triggered or niche"}`));
console.log(`\n  Next: wire mis-triggered agents via subagent_type= from a busy skill. Do NOT rewrite descriptions (A/B delta 0). Prune only 0-ref agents.\n`);
'
