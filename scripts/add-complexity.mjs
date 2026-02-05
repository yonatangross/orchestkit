#!/usr/bin/env node
/**
 * Batch add `complexity: low|medium|high` field to all SKILL.md frontmatters.
 * Based on classification from Opus 4.6 upgrade milestone (#328).
 *
 * Usage: node scripts/add-complexity.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKILLS_DIR = join(import.meta.dirname, '..', 'src', 'skills');

// Classification from agent analysis
const LOW = new Set([
  'a11y-testing', 'ascii-visualizer', 'assess', 'audio-mixing-patterns',
  'best-practices', 'biome-linting', 'browser-content-capture', 'business-case-analysis',
  'cache-cost-tracking', 'callout-positioning', 'code-review-playbook', 'commit',
  'configure', 'content-type-recipes', 'core-web-vitals', 'create-pr',
  'dashboard-patterns', 'demo-producer', 'design-system-starter', 'doctor',
  'elevenlabs-narration', 'embeddings', 'errors', 'evidence-verification',
  'explore', 'feedback', 'focus-management', 'help',
  'hook-formulas', 'i18n-date-patterns', 'image-optimization', 'input-validation',
  'langfuse-observability', 'lazy-loading-patterns', 'llm-streaming', 'manim-visualizer',
  'memory', 'music-sfx-selection', 'narration-scripting', 'okr-kpi-patterns',
  'pii-masking-patterns', 'prioritization-frameworks', 'prompt-caching', 'radix-primitives',
  'rate-limiting', 'recharts-patterns', 'release-management', 'remember',
  'scene-intro-cards', 'scroll-driven-animations', 'security-scanning', 'skill-analyzer',
  'stacked-prs', 'terminal-demo-generator', 'test-data-management', 'thumbnail-first-frame',
  'unit-testing', 'vcr-http-recording', 'verify', 'video-pacing',
  'view-transitions', 'web-research-workflow', 'worktree-coordination', 'zustand-patterns',
]);

const HIGH = new Set([
  'advanced-guardrails', 'agentic-rag-patterns', 'alternative-agent-frameworks',
  'aggregate-patterns', 'audio-language-models', 'backend-architecture-enforcer',
  'langgraph-human-in-loop', 'langgraph-parallel', 'langgraph-subgraphs',
  'langgraph-supervisor', 'langgraph-tools', 'mcp-advanced-patterns',
  'mcp-security-hardening', 'mcp-server-building', 'mem0-memory', 'memory-fabric',
  'multi-scenario-orchestration', 'quality-gates', 'rag-retrieval', 'saga-patterns',
  'temporal-io', 'vision-language-models',
]);

function getComplexity(skillName) {
  if (HIGH.has(skillName)) return 'high';
  if (LOW.has(skillName)) return 'low';
  return 'medium';
}

const dryRun = process.argv.includes('--dry-run');
const stats = { low: 0, medium: 0, high: 0, skipped: 0, errors: 0 };

const skillDirs = readdirSync(SKILLS_DIR).filter(d => {
  try { return statSync(join(SKILLS_DIR, d)).isDirectory(); } catch { return false; }
});

for (const dir of skillDirs) {
  const skillPath = join(SKILLS_DIR, dir, 'SKILL.md');
  let content;
  try {
    content = readFileSync(skillPath, 'utf-8');
  } catch {
    stats.errors++;
    console.error(`SKIP: ${dir}/SKILL.md not found`);
    continue;
  }

  // Check if complexity already exists
  if (/^complexity:/m.test(content)) {
    stats.skipped++;
    continue;
  }

  const complexity = getComplexity(dir);
  stats[complexity]++;

  // Insert complexity after tags line (or after description if no tags)
  // Strategy: find the second --- and insert before it
  const lines = content.split('\n');
  let frontmatterEnd = -1;
  let dashCount = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      dashCount++;
      if (dashCount === 2) {
        frontmatterEnd = i;
        break;
      }
    }
  }

  if (frontmatterEnd === -1) {
    stats.errors++;
    console.error(`ERROR: No frontmatter end found in ${dir}/SKILL.md`);
    continue;
  }

  // Insert complexity field before the closing ---
  lines.splice(frontmatterEnd, 0, `complexity: ${complexity}`);
  const newContent = lines.join('\n');

  if (dryRun) {
    console.log(`[DRY] ${dir}: complexity: ${complexity}`);
  } else {
    writeFileSync(skillPath, newContent);
    console.log(`${dir}: complexity: ${complexity}`);
  }
}

console.log(`\nDone! Low: ${stats.low}, Medium: ${stats.medium}, High: ${stats.high}, Skipped: ${stats.skipped}, Errors: ${stats.errors}`);
console.log(`Total processed: ${stats.low + stats.medium + stats.high + stats.skipped}`);
