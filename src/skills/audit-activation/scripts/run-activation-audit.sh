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
const allRows = rd(spawnFile);
const inv = fs.readdirSync(`${repo}/src/agents`).filter(f=>f.endsWith(".md")&&!/^(README|INDEX|CONTRIBUTING)\.md$/i.test(f)).map(f=>f.replace(/\.md$/,"")).sort();
const invSet = new Set(inv);
const BUILTIN = new Set(["Explore","general-purpose","Plan","workflow-subagent","statusline-setup"]);
const norm = (n)=>String(n||"?").replace(/^ork:/,"");

// M170/#3128: exclude synthetic sessions before computing ANY share. A single
// test session (test-123) once spawned all 36 catalog agents and made this
// audit report "dormant 0, ork 24%" — the tool graded its own test data.
// Two signatures: session_id starting with test-, or a session spawning more
// distinct catalog agents than any real workflow does (>20).
const perSession = {};
for (const s of allRows){
  const sid = s.session_id || "?";
  const n = norm(s.subagent_type||s.agent||s.agent_type||"?");
  if (invSet.has(n)) (perSession[sid] ||= new Set()).add(n);
}
const sessionsAll = new Set(allRows.map(s => s.session_id || "?"));
const excluded = new Set([...sessionsAll].filter(sid => /^test-/i.test(sid) || (perSession[sid]?.size||0) > 20));
const spawns = allRows.filter(s => !excluded.has(s.session_id || "?"));
const excludedRows = allRows.length - spawns.length;

// M170/#3129: SubagentStart rows for NAMED spawns carry the custom name in
// subagent_type (CC payload shadowing). Pretool rows record the (type, name)
// pair — build a name->type map and resolve shadowed start rows through it.
// Keyed by session_id+name, NOT bare name (found in /ork:assess review):
// two different sessions can reuse the same custom name for different
// specialists, and a bare-name map lets a later session write silently
// overwrite an earlier mapping -- the exact shadowing shape this fix
// exists to resolve, reintroduced one level up. NOTE: this bash script
// wraps the whole node program in single quotes -- never use an
// apostrophe in any comment or string literal below this line.
const nameToType = {};
for (const s of spawns){
  if (s.agent_name && s.subagent_type && s.agent_name !== s.subagent_type)
    nameToType[`${s.session_id||"?"}::${s.agent_name}`] = s.subagent_type;
}
let g=0,o=0,gp=0,other=0,unknown=0,resolved=0; const fires={}; let mn=null,mx=null;
for (const s of spawns){
  let raw = s.subagent_type||s.agent||s.agent_type||"?";
  const nameKey = `${s.session_id||"?"}::${raw}`;
  if (s.source === "start" && nameToType[nameKey]){ raw = nameToType[nameKey]; resolved++; }
  const n = norm(raw); const t = s.timestamp||s.ts;
  if (t){ if(!mn||t<mn)mn=t; if(!mx||t>mx)mx=t; }
  if (n==="?"||n===""){ unknown++; continue; }
  if (raw==="general-purpose"||n==="general-purpose") gp++;
  if (BUILTIN.has(raw)||BUILTIN.has(n)) g++;
  else if (invSet.has(n)){ o++; fires[n]=(fires[n]||0)+1; }
  else other++;
}
// The advisor metric (#2632): of spawns the advisor can influence (ork + gp),
// what share reached the catalog? Baseline anchor 2026-06-23: 44.2%, ratio 0.79.
const addressableShare = (o+gp) ? Math.round(o/(o+gp)*1000)/10 : 0;
const addressableRatio = gp ? Math.round(o/gp*100)/100 : null;
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
  console.log(JSON.stringify({ window:[mn,mx], total:tot, totals:{generic:g,ork:o,general_purpose:gp,other,unknown},
    addressable:{share_pct:addressableShare, ratio:addressableRatio, baseline:{share_pct:44.2, ratio:0.79, date:"2026-06-23"}},
    excluded:{sessions:[...excluded], rows:excludedRows},
    agents: inv.map(a=>({name:a,fires:fires[a]||0,skillRefs:skillRefs[a]})), conc_top5_pct:conc }, null, 2));
  process.exit(0);
}

const bar=(p)=>"#".repeat(Math.round(p/2.7)).padEnd(37,".");
console.log(`\nADDRESSABLE RATIO (headline · ork:general-purpose · advisor #2632 success metric)`);
console.log(`  ork ${o} : gp ${gp}  ->  share ${addressableShare}% · ratio ${addressableRatio ?? "n/a"}   (baseline 2026-06-23: 44.2% · 0.79 — should climb toward 1.0)`);
if (excludedRows) console.log(`  excluded ${excludedRows} row(s) from ${excluded.size} synthetic session(s): ${[...excluded].slice(0,3).join(", ")}${excluded.size>3?" …":""}`);
if (resolved) console.log(`  resolved ${resolved} name-shadowed start row(s) via the pretool (type, name) map (#3129)`);
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
