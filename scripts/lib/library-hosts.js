'use strict';
// ============================================================================
// Which host ships which library item, read from the pack manifests
// ============================================================================
// The home page library shows a per-host line under the live terminal and an "on: <hosts>"
// mark under every list row. Neither is written by hand: this file reads what each pack
// actually contains. docs/site/lib/generated/library-data.ts carries the result as
// LIBRARY_HOSTS, and tests/unit/test-library-hosts.mjs re-reads the manifests and fails when
// the committed file differs.
//
//   claude    every skill, agent and hook of the library (the source of the data)
//   cursor    .cursor-plugin/marketplace.json: the skills and agents of each listed plugin
//             (ork and ork-extras). Hook scripts are not registered there.
//   codex     plugins/ork-codex/skills (ork-<name>) and plugins/ork-codex/roles (4 roles).
//   pi        package.json pi.skills (plugins/ork/skills)
//   muse, agy   plugins/ork sets: both import the Claude Code plugin (measured
//               2026-11-22: `muse plugins inspect ork` capabilities.skills lists every skill,
//               `agy plugin list` "Source: claude-code"). opencode: the skills.sh starter
//               list in docs/site/lib/host-installs.ts.
//   devin     plugins/ork sets, measured 2026-11-22 on devin 3000.14.30821: the plugin
//             cache (git-subdir plugins/ork) holds skills/, agents/ and hooks/hooks.json;
//             hooks land on Devin's 9 supported events (58 of 103 entries) -> 'partial'.

const fs = require('node:fs');
const path = require('node:path');

const STARTER_HOSTS = ['muse', 'opencode', 'agy'];

function dirNames(dir, { files = false } = {}) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => (files ? e.isFile() : e.isDirectory()))
      .map((e) => e.name)
      .filter((n) => !n.startsWith('.'))
      .sort();
  } catch {
    return [];
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** `-s name` pairs of SKILLS_SH_STARTER in docs/site/lib/host-installs.ts. */
function starterSkills(root) {
  try {
    const src = fs.readFileSync(path.join(root, 'docs/site/lib/host-installs.ts'), 'utf8');
    const line = src.match(/SKILLS_SH_STARTER\s*=\s*"([^"]+)"/);
    return line ? [...line[1].matchAll(/-s\s+([a-z0-9-]+)/g)].map((m) => m[1]) : [];
  } catch {
    return [];
  }
}

/** Skill names of one plugin dir, agent names from its agents/*.md. */
function pluginSets(root, pluginDir) {
  const base = path.join(root, pluginDir);
  return {
    skills: dirNames(path.join(base, 'skills')),
    agents: dirNames(path.join(base, 'agents'), { files: true })
      .filter((n) => n.endsWith('.md'))
      .map((n) => n.slice(0, -3)),
  };
}

function buildLibraryHosts(root) {
  const cursorManifest = readJson(path.join(root, '.cursor-plugin/marketplace.json'));
  const cursorPlugins = ((cursorManifest && cursorManifest.plugins) || [])
    .map((p) => String(p.source || ''))
    .filter(Boolean);
  const cursor = { skills: new Set(), agents: new Set() };
  for (const source of cursorPlugins) {
    const sets = pluginSets(root, source);
    sets.skills.forEach((s) => cursor.skills.add(s));
    sets.agents.forEach((a) => cursor.agents.add(a));
  }

  const codexSkills = dirNames(path.join(root, 'plugins/ork-codex/skills'))
    .filter((n) => n.startsWith('ork-'))
    .map((n) => n.slice('ork-'.length));
  const codexRoles = dirNames(path.join(root, 'plugins/ork-codex/roles'), { files: true })
    .filter((n) => n.endsWith('.toml'))
    .map((n) => n.slice(0, -'.toml'.length));

  const pkg = readJson(path.join(root, 'package.json'));
  const piDirs = ((pkg && pkg.pi && pkg.pi.skills) || [])
    .filter((p) => !String(p).startsWith('-'))
    .map((p) => String(p).replace(/^\.\//, ''));
  const piSkills = [...new Set(piDirs.flatMap((d) => dirNames(path.join(root, d))))].sort();

  const starter = [...new Set(starterSkills(root))].sort();

  const ork = pluginSets(root, 'plugins/ork');
  const sorted = (set) => [...set].sort();
  return {
    // hooks: 'claude' all run; 'partial' a measured subset runs (Devin, 9 of 31 events);
    // 'none' the pack registers none; 'unknown' unmeasured.
    claude: { skills: 'all', agents: 'all', hooks: 'claude' },
    cursor: { skills: sorted(cursor.skills), agents: sorted(cursor.agents), hooks: 'none' },
    codex: { skills: codexSkills, agents: [], roles: codexRoles, hooks: 'none' },
    devin: { skills: ork.skills, agents: ork.agents, hooks: 'partial' },
    opencode: { skills: starter, agents: [], hooks: 'none' },
    muse: { skills: ork.skills, agents: [], hooks: 'none' },
    pi: { skills: piSkills, agents: [], hooks: 'none' },
    agy: { skills: ork.skills, agents: ork.agents, hooks: 'none' },
  };
}

module.exports = { buildLibraryHosts, STARTER_HOSTS };
