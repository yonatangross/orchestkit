// skill-fitness — dynamic-workflow harness (template).
//
// Fan-out fitness eval of ork skills: one ISOLATED-CONTEXT agent scores each
// skill against a rubric, then synthesize a ranked scorecard. This is the
// workflow-backed complement to the STATIC conformance grader
// (scripts/eval/conformance-check.mjs): the static grader catches mechanical
// drift (model IDs, hook counts) with zero tokens; this catches QUALITATIVE
// fitness (description/router clarity, internal-count drift, structural dups,
// install-portability, version drift) that needs a reading agent per skill.
//
// Distribution: shipped template-in-skill (Thariq's pattern). Run it with the
// Workflow tool — treat as a TEMPLATE, adapt SKILLS/rubric per use:
//   Workflow({ scriptPath: "<this file>", args: ["assess","commit",...] })
//
// COST (Thariq's warning is real): ~50k tokens/skill. The default is a small
// sample. Scoring all ~112 skills is ~6M tokens — pass an explicit batch via
// `args` and/or a token budget ("use 200k tokens") rather than running blind.
//
// Workflow runtime notes: no fs/process/Date.now in the SCRIPT body; the
// spawned AGENTS read files via their Read tool (cwd = repo root, so use
// REPO-RELATIVE paths — never absolute user paths, which break on other installs).

export const meta = {
  name: 'skill-fitness',
  description: 'Fan-out fitness eval of ork skills: isolated agent per skill scores a rubric, then synthesize a ranked scorecard.',
  phases: [
    { title: 'Score', detail: 'one isolated-context agent per skill, scored against the fitness rubric' },
    { title: 'Synthesize', detail: 'rank weakest-first + flag below-bar skills' },
  ],
}

// args = JSON array of skill names (memory: args may arrive as a string — guard it).
const SKILLS = Array.isArray(args)
  ? args
  : (typeof args === 'string' && args.trim() ? JSON.parse(args) : ['assess', 'brainstorm', 'commit', 'doctor', 'explore', 'verify'])

// Small schema (big StructuredOutput schemas flake on heavy agents — keep it tight).
const SCORE = {
  type: 'object',
  additionalProperties: false,
  properties: {
    skill: { type: 'string' },
    freshness: { type: 'integer', minimum: 0, maximum: 10, description: 'current CC idioms/model IDs/version refs; no drift' },
    clarity: { type: 'integer', minimum: 0, maximum: 10, description: 'description triggers + when-to-use clear enough to route' },
    structure: { type: 'integer', minimum: 0, maximum: 10, description: 'valid frontmatter, body under ~500 lines, refs resolve, no dup headings' },
    top_issue: { type: 'string', description: 'the single biggest fitness problem, or "none"' },
  },
  required: ['skill', 'freshness', 'clarity', 'structure', 'top_issue'],
}

log(`skill-fitness: scoring ${SKILLS.length} skills via isolated-context fan-out (~50k tokens/skill)`)

phase('Score')
const scored = await pipeline(
  SKILLS,
  (s) => agent(
    `Read src/skills/${s}/SKILL.md (repo-relative to your cwd) and score this ONE skill's fitness for current Claude Code (mid-2026, floor 2.1.148, current model Opus 4.8).

Score 0-10 each:
- freshness: no stale model IDs (Opus 4.6/4.7 cited as current), no CC version requirement below the floor, no drifting hardcoded counts
- clarity: the YAML 'description' has clear trigger keywords + a "use when / NOT when"; a router could pick this skill correctly from intent alone
- structure: valid frontmatter, body under ~500 lines, internal references resolve, no duplicate headings, no install-specific absolute paths (must use \${CLAUDE_SKILL_DIR}/\${CLAUDE_PLUGIN_ROOT})

Set top_issue to the single biggest problem (or "none"). Strict grader — reserve 9-10 for genuinely exemplary.`,
    { label: `score:${s}`, phase: 'Score', schema: SCORE }
  ).then((r) => ({ ...r, skill: s }))
)

phase('Synthesize')
const valid = scored.filter(Boolean)
const withTotal = valid.map((r) => ({ ...r, total: r.freshness + r.clarity + r.structure }))
withTotal.sort((a, b) => a.total - b.total) // weakest first
const flagged = withTotal.filter((r) => r.total < 24 || (r.top_issue && r.top_issue !== 'none'))
log(`scored ${valid.length}/${SKILLS.length}; ${flagged.length} below-bar or flagged`)

return {
  scored_count: valid.length,
  mean_total: valid.length ? Math.round((withTotal.reduce((a, r) => a + r.total, 0) / valid.length) * 10) / 10 : 0,
  flagged_count: flagged.length,
  weakest: withTotal.slice(0, 10),
  all: withTotal,
}
