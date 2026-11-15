/**
 * Library stations: every skill, agent and hook placed at the one workflow station where it acts.
 *
 * Used by scripts/generate-docs-data.js to write docs/site/lib/generated/library-data.ts, the data
 * behind the home page library. The rules moved here from a desk script (real-map/stations.py) so
 * the site and the generator can never disagree.
 *
 * Rules:
 * - A skill or agent named in SKILL_STATION or AGENT_STATION goes there; every other one is a
 *   pattern or knowledge item loaded by the agents that build, so it goes to "build".
 * - A hook goes to the station of its event. An event with no station is an error: a new hook
 *   event must be placed on purpose, never fall into a default.
 */

const STATIONS = [
  { key: 'ask', label: 'Ask', line: 'A plain request comes in; the front door picks the skill.' },
  { key: 'plan', label: 'Plan', line: 'Research and plan before code: options, scores, a written plan.' },
  { key: 'build', label: 'Build', line: 'Agents work in parallel, each with the pattern skills it loads.' },
  { key: 'guard', label: 'Guard', line: 'Hooks check every tool call before it runs.' },
  { key: 'check', label: 'Check', line: 'Review, tests and browser checks grade the work.' },
  { key: 'ship', label: 'Ship', line: 'Commit, PR, CI and release.' },
  { key: 'remember', label: 'Remember', line: 'Decisions and telemetry carry into the next session.' },
];

const DEFAULT_STATION = 'build';

const SKILL_STATION = invert({
  ask: ['auto', 'help', 'setup', 'doctor', 'configure', 'prd-to-goal', 'dev', 'portless', 'page-serve', 'glyph'],
  plan: [
    'brainstorm', 'create-research', 'iterate-research', 'create-plan', 'iterate-plan', 'explore', 'assess',
    'write-prd', 'visualize-plan', 'architecture-decision-record', 'scope-appropriate-architecture',
    'review-artifact-comments', 'business-case', 'competitive-analysis', 'market-sizing', 'okr-design',
    'prioritization', 'product-analytics', 'product-frameworks', 'user-research', 'quality-gates',
  ],
  guard: ['careful', 'freeze', 'security-patterns', 'paired-probe'],
  check: [
    'review-pr', 'verify', 'expect', 'cover', 'code-review-playbook', 'testing-unit', 'testing-integration',
    'testing-e2e', 'testing-llm', 'testing-perf', 'bare-eval', 'error-analysis', 'golden-dataset',
    'storybook-testing', 'audit-full', 'audit-activation', 'errors',
  ],
  ship: [
    'commit', 'create-pr', 'ci-debug', 'ci-sentinel', 'release-management', 'release-sync', 'devops-deployment',
    'github-operations', 'issue-progress-tracking', 'swarm-migrate', 'fix-issue', 'disk-cleanup',
  ],
  remember: [
    'memory', 'remember', 'dream', 'memory-fabric', 'analytics', 'telemetry-inspect', 'prompt-focus',
    'chain-patterns', 'task-dependency-patterns', 'monitoring-observability', 'documentation-patterns',
  ],
});

const AGENT_STATION = invert({
  plan: ['product-strategist', 'market-intelligence', 'system-design-reviewer', 'workflow-architect', 'web-research-analyst'],
  guard: ['security-auditor', 'security-layer-auditor', 'ai-safety-auditor'],
  check: ['code-quality-reviewer', 'test-generator', 'expect-agent', 'eval-runner', 'debug-investigator', 'accessibility-specialist'],
  ship: ['ci-cd-engineer', 'deployment-manager', 'release-engineer', 'git-operations-engineer', 'infrastructure-architect', 'monitoring-engineer'],
});

const HOOK_EVENT_STATION = invert({
  ask: [
    'UserPromptSubmit', 'UserPromptExpansion', 'SessionStart', 'Setup', 'InstructionsLoaded', 'ConfigChange',
    'CwdChanged', 'Elicitation', 'ElicitationResult', 'DirectoryAdded', 'PreModelSwitch', 'PostModelSwitch',
  ],
  guard: ['PreToolUse', 'PermissionRequest', 'PermissionDenied'],
  check: ['PostToolUse', 'PostToolUseFailure', 'PostToolBatch', 'FileChanged'],
  build: ['SubagentStart', 'SubagentStop', 'TaskCreated', 'TaskCompleted', 'TeammateIdle', 'WorktreeCreate', 'WorktreeRemove'],
  ship: ['Stop', 'StopFailure'],
  remember: ['SessionEnd', 'PreCompact', 'PostCompact', 'Notification', 'MessageDisplay'],
});

function invert(byStation) {
  const out = {};
  for (const [station, names] of Object.entries(byStation)) {
    for (const name of names) {
      if (out[name]) throw new Error(`library-stations: ${name} is placed twice (${out[name]}, ${station})`);
      out[name] = station;
    }
  }
  return out;
}

/** The script a hooks.json handler runs, e.g. "pretool/bash/sync-bash-dispatcher". */
function hookScript(handler) {
  const parts = [handler.command || '', ...(handler.args || [])].join(' ');
  const match = parts.match(/run-hook[^ ]*\s+([\w./-]+)/);
  return match ? match[1] : parts.trim();
}

/** Every handler in a parsed src/hooks/hooks.json, in file order. */
function listHooks(hooksJson) {
  const out = [];
  for (const [event, matchers] of Object.entries((hooksJson && hooksJson.hooks) || {})) {
    for (const entry of matchers || []) {
      for (const handler of entry.hooks || []) {
        const script = hookScript(handler);
        out.push({ event, matcher: entry.matcher || '', script, name: script.split('/').pop() });
      }
    }
  }
  return out;
}

/**
 * Build the library: one item per skill, agent and hook, each with its station.
 * skills: { name: { description, userInvocable } }; agents: { name: { description, model } };
 * hooks: the output of listHooks(); skillScopedHooks: { skillName: handlerCount }.
 */
function buildLibrary({ skills, agents, hooks, skillScopedHooks = {} }) {
  const items = [];
  for (const name of Object.keys(skills).sort()) {
    const s = skills[name];
    items.push({
      id: `skill:${name}`,
      kind: 'skill',
      name,
      station: SKILL_STATION[name] || DEFAULT_STATION,
      description: s.description || '',
      command: Boolean(s.userInvocable),
      scopedHooks: skillScopedHooks[name] || 0,
    });
  }
  for (const name of Object.keys(agents).sort()) {
    const a = agents[name];
    items.push({
      id: `agent:${name}`,
      kind: 'agent',
      name,
      station: AGENT_STATION[name] || DEFAULT_STATION,
      description: a.description || '',
      model: a.model || null,
    });
  }
  const seen = new Set();
  for (const h of hooks) {
    const station = HOOK_EVENT_STATION[h.event];
    if (!station) throw new Error(`library-stations: hook event ${h.event} (${h.script}) has no station`);
    const id = `hook:${h.event}:${h.matcher}:${h.script}`;
    if (seen.has(id)) throw new Error(`library-stations: duplicate hook ${id}`);
    seen.add(id);
    items.push({ id, kind: 'hook', name: h.name, station, event: h.event, matcher: h.matcher, script: h.script });
  }

  for (const [map, kind, pool] of [[SKILL_STATION, 'skill', skills], [AGENT_STATION, 'agent', agents]]) {
    for (const name of Object.keys(map)) {
      if (!pool[name]) throw new Error(`library-stations: ${kind} ${name} is placed but does not exist`);
    }
  }

  const stations = STATIONS.map((s) => {
    const mine = items.filter((i) => i.station === s.key);
    return {
      ...s,
      skills: mine.filter((i) => i.kind === 'skill').length,
      agents: mine.filter((i) => i.kind === 'agent').length,
      hooks: mine.filter((i) => i.kind === 'hook').length,
    };
  });
  const scoped = Object.values(skillScopedHooks).reduce((a, b) => a + b, 0);
  const counts = {
    items: items.length,
    skills: items.filter((i) => i.kind === 'skill').length,
    agents: items.filter((i) => i.kind === 'agent').length,
    hooks: items.filter((i) => i.kind === 'hook').length,
    skillScopedHooks: scoped,
    skillsWithHooks: Object.values(skillScopedHooks).filter((n) => n > 0).length,
  };
  return { stations, items, counts };
}

module.exports = { STATIONS, DEFAULT_STATION, SKILL_STATION, AGENT_STATION, HOOK_EVENT_STATION, hookScript, listHooks, buildLibrary };
