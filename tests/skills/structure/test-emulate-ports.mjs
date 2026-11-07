#!/usr/bin/env node
// ============================================================================
// emulate default ports: one table, from one source
// ============================================================================
// emulate assigns default ports as 4000 + position in its service list. In
// emulate 0.12.0 (the emulate-seed skill's upstream-version-tested pin) that
// list is, in the built package (dist/chunk-*.js, and README "Quick Start"):
//   vercel github google slack apple microsoft okta aws resend stripe
//   mongoatlas clerk linear twilio
//
// The ports drifted: src/skills/emulate-seed/SKILL.md had AWS 4006, MongoDB
// Atlas 4007, Okta 4008, Resend 4009, Stripe 4010 and Clerk/Linear/Twilio
// "on-demand", while src/agents/emulate-engineer.md kept its own table with
// different numbers (Resend audit item 13, 2026-11-07).
//
// Fails if:
//   - the emulate-seed SKILL.md port table is not exactly the upstream list
//   - emulate-engineer.md carries its own port table instead of pointing at it
//   - any "<Service> (`:40NN`)" heading or "<Service> | 40NN" row in the
//     skill's references disagrees with the upstream port
//   - a localhost:40NN/inbox (Resend) or <SERVICE>_EMULATOR_URL line disagrees
// Usage: node tests/skills/structure/test-emulate-ports.mjs
// ============================================================================

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SKILL_DIR = path.join(ROOT, 'src', 'skills', 'emulate-seed');
const AGENT = path.join(ROOT, 'src', 'agents', 'emulate-engineer.md');

const ORDER = ['vercel', 'github', 'google', 'slack', 'apple', 'microsoft', 'okta', 'aws',
  'resend', 'stripe', 'mongoatlas', 'clerk', 'linear', 'twilio'];
const PORT = Object.fromEntries(ORDER.map((s, i) => [s, 4000 + i]));

// Display names used in the docs, mapped to the service id.
const ALIASES = [
  [/^vercel/i, 'vercel'], [/^github/i, 'github'], [/^google/i, 'google'], [/^slack/i, 'slack'],
  [/^apple/i, 'apple'], [/^(microsoft|entra)/i, 'microsoft'], [/^okta/i, 'okta'], [/^aws/i, 'aws'],
  [/^resend/i, 'resend'], [/^stripe/i, 'stripe'], [/^mongo/i, 'mongoatlas'], [/^clerk/i, 'clerk'],
  [/^linear/i, 'linear'], [/^twilio/i, 'twilio'],
];
const serviceOf = (label) => {
  const clean = label.replace(/[*`]/g, '').trim();
  const hit = ALIASES.find(([re]) => re.test(clean));
  return hit ? hit[1] : null;
};

const failures = [];
const rel = (f) => path.relative(ROOT, f);

// 1. The skill's table is the one table, and it must be the upstream list.
const skillPath = path.join(SKILL_DIR, 'SKILL.md');
const skill = readFileSync(skillPath, 'utf8');
const rows = [...skill.matchAll(/^\|\s*([^|]+?)\s*\|\s*`:(\d{4})`\s*\|/gm)]
  .map((m) => ({ service: serviceOf(m[1]), port: Number(m[2]), label: m[1].trim() }));
const tableServices = rows.map((r) => r.service);
if (JSON.stringify(tableServices) !== JSON.stringify(ORDER)) {
  failures.push(`${rel(skillPath)}: port table lists ${tableServices.join(',') || 'nothing'}, upstream order is ${ORDER.join(',')}`);
}
for (const r of rows) {
  if (r.service && PORT[r.service] !== r.port) failures.push(`${rel(skillPath)}: ${r.label} is :${r.port}, upstream is :${PORT[r.service]}`);
}
if (/\(on-demand\)/.test(skill)) failures.push(`${rel(skillPath)}: says "(on-demand)", but every service has a fixed default port`);

// 2. The agent points at the skill's table instead of keeping a second one.
const agent = readFileSync(AGENT, 'utf8');
if (/^\|\s*[^|]+\|\s*:?\s*40\d\d\s*\|/m.test(agent)) {
  failures.push(`${rel(AGENT)}: carries its own port table; point at emulate-seed's table instead`);
}
if (!/emulate-seed/.test(agent)) failures.push(`${rel(AGENT)}: does not point at the emulate-seed port table`);

// 3. Every port mention with a service name, in the skill and its references.
const files = [skillPath, AGENT, ...readdirSync(path.join(SKILL_DIR, 'references'))
  .filter((f) => f.endsWith('.md')).map((f) => path.join(SKILL_DIR, 'references', f))];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const checks = [
    // "## AWS (`:4006`)"
    ...[...text.matchAll(/^#{1,6}\s+([A-Za-z][\w ]*?)\s*\(`:(\d{4})`\)/gm)].map((m) => [m[1], m[2]]),
    // "| Okta | 4006 |"
    ...[...text.matchAll(/^\|\s*([A-Za-z][\w ]*?)\s*\|\s*(40\d\d)\s*\|/gm)].map((m) => [m[1], m[2]]),
    // "AWS_EMULATOR_URL=http://localhost:4007"
    ...[...text.matchAll(/\b([A-Z]+)_EMULATOR_URL=http:\/\/localhost:(40\d\d)/g)].map((m) => [m[1], m[2]]),
    // Resend's local inbox
    ...[...text.matchAll(/localhost:(40\d\d)\/inbox/g)].map((m) => ['resend', m[1]]),
    // "`okta:4008`"
    ...[...text.matchAll(/`([a-z]+):(40\d\d)`/g)].map((m) => [m[1], m[2]]),
  ];
  for (const [label, port] of checks) {
    const s = serviceOf(label);
    if (s && PORT[s] !== Number(port)) failures.push(`${rel(file)}: ${label.trim()} at :${port}, upstream is :${PORT[s]}`);
  }
}

for (const f of failures) console.log(`FAIL: ${f}`);
if (failures.length) process.exit(1);
console.log(`PASS: emulate ports match the upstream 0.12.0 order (${ORDER.length} services) in ${files.length} files`);
