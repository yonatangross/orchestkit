#!/usr/bin/env node
/**
 * OrchestKit Passive Index Generator (Node.js)
 *
 * Replaces generate-indexes.sh — eliminates ~1,000 subprocess forks.
 * Generates compressed indexes for passive agent/skill routing.
 *
 * Two-tier passive index system:
 *   Tier 1: agent-index.md  — agent routing map (~3KB per plugin)
 *   Tier 2: skill-indexes/  — per-agent skill file maps (~2KB each)
 *
 * Stages:
 *   1. Tier 1: agent-index.md per plugin (grouped by category, sorted)
 *   2. Tier 2: skill-indexes/*.md per agent (with tags + references)
 *   3. Composite index merging all plugins
 *   4. CLAUDE.md wrapper per plugin
 *   5. AGENTS.md wrapper per plugin (cross-tool compat)
 *   6. Tier 2 injection into agent .md files (idempotent)
 *
 * Usage:
 *   node scripts/generate-indexes.js          # Standalone
 *   Called automatically by build-plugins.sh   # As build phase
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseYamlFrontmatter } = require('./lib/parse-frontmatter');

// Paths
const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.join(SCRIPT_DIR, '..');
const PLUGINS_DIR = path.join(PROJECT_ROOT, 'plugins');

// Colors
const GREEN = '\x1b[32m';
// const YELLOW = '\x1b[33m'; // available for warnings
const BLUE = '\x1b[34m';
const NC = '\x1b[0m';

// Stats
let indexesGenerated = 0;
let skillIndexesGenerated = 0;

// ============================================================================
// Category constants
// ============================================================================

const CATEGORY_ORDER = [
  'backend', 'frontend', 'security', 'devops', 'llm', 'testing',
  'product', 'data', 'git', 'design', 'research', 'docs', 'other'
];

const CATEGORY_LABELS = {
  backend: 'Backend & Data',
  frontend: 'Frontend & UI',
  security: 'Security',
  devops: 'DevOps & Infrastructure',
  llm: 'LLM & AI',
  testing: 'Testing & Quality',
  product: 'Product & Strategy',
  docs: 'Documentation',
  data: 'Data Pipelines',
  git: 'Git Operations',
  design: 'Design & Architecture',
  research: 'Research & Analysis',
  other: 'Other',
};

// Category inference rules — order matters (most specific first within each category)
const CATEGORY_PATTERNS = [
  ['backend',  /backend|api|database|microservice|schema|migration/],
  ['frontend', /frontend|react|ui|component|css|tailwind/],
  ['security', /security|audit|vulnerability|owasp|injection/],
  ['devops',   /ci\/cd|deploy|infrastructure|kubernetes|terraform|release|devops/],
  ['llm',      /llm|ai|prompt|openai|anthropic|multimodal|vision/],
  ['testing',  /test|debug|coverage|quality/],
  ['product',  /product|strategy|business|market|roi|okr|kpi|user research|persona/],
  ['docs',     /documentation|readme|api-docs|changelog/],
  ['data',     /data pipeline|embedding|chunking|etl/],
  ['git',      /git|branch|commit|rebase/],
  ['design',   /demo|video|design|architecture/],
];

// ============================================================================
// Keyword extraction
// ============================================================================

/**
 * Extract activation keywords from an agent's description field.
 * Handles: "Activates for ...", "Auto Mode keywords - ...",
 *          "Auto-activates for ...", "Use for ...", "Use when ..."
 */
function extractAgentKeywords(description) {
  let keywords = '';

  // Try each known pattern (most specific first)
  const patterns = [
    /[Aa]ctivates for (.*)/,
    /[Aa]uto-activates for (.*)/,
    /Auto Mode keywords - (.*)/,
    /Auto Mode keywords: (.*)/,
    /Use for (.*)/,
  ];

  for (const re of patterns) {
    const m = description.match(re);
    if (m) {
      keywords = m[1];
      break;
    }
  }

  // Strip trailing period and "keywords." suffix
  keywords = keywords.replace(/\s*keywords\.$/, '').replace(/\.$/, '');

  if (keywords) {
    return keywords
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .join(',');
  }

  // Fallback: "Use when ..." clause
  const useWhenMatch = description.match(/Use when (.*)/);
  if (useWhenMatch) {
    return useWhenMatch[1]
      .split(',')
      .map(s => s.trim().replace(/\.$/, '').replace(/^or /, ''))
      .filter(Boolean)
      .join(',');
  }

  // Last resort: extract capitalized terms
  const words = description.split(/[ ,.;:]+/);
  const caps = words.filter(w => /^[A-Z][a-z]+$/.test(w) || /^[A-Z]{2,}$/.test(w));
  const unique = [...new Set(caps)].sort().slice(0, 10);
  return unique.join(',');
}

// ============================================================================
// Category inference
// ============================================================================

function getAgentCategory(frontmatter) {
  if (frontmatter.category) return frontmatter.category;

  const desc = (frontmatter.description || '').toLowerCase();
  for (const [cat, re] of CATEGORY_PATTERNS) {
    if (re.test(desc)) return cat;
  }
  return 'other';
}

// ============================================================================
// Skill helpers
// ============================================================================

function extractSkillTags(skillMdPath) {
  try {
    const content = fs.readFileSync(skillMdPath, 'utf-8');
    const { frontmatter } = parseYamlFrontmatter(content);
    const tags = frontmatter.tags;
    if (!tags) return '';
    if (Array.isArray(tags)) return tags.join(',');
    // String form: "[a, b, c]" — strip brackets
    return String(tags).replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).join(',');
  } catch {
    return '';
  }
}

function listSkillReferences(skillDir) {
  const refsDir = path.join(skillDir, 'references');
  try {
    if (!fs.statSync(refsDir).isDirectory()) return '';
    return fs.readdirSync(refsDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .join(',');
  } catch {
    return '';
  }
}

// ============================================================================
// Read agent frontmatter (cached)
// ============================================================================

function readAgentFrontmatter(agentMdPath) {
  const content = fs.readFileSync(agentMdPath, 'utf-8');
  return parseYamlFrontmatter(content).frontmatter;
}

// ============================================================================
// Stage 1: Generate Tier 1 agent-index.md per plugin
// ============================================================================

function generateAgentIndex(pluginName, pluginDir) {
  const agentsDir = path.join(pluginDir, 'agents');
  if (!fs.existsSync(agentsDir)) return;

  const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).sort();
  if (agentFiles.length === 0) return;

  // Collect agents by category
  const byCategory = {};
  let agentCount = 0;

  for (const file of agentFiles) {
    const agentPath = path.join(agentsDir, file);
    const fm = readAgentFrontmatter(agentPath);
    const agentName = fm.name || path.basename(file, '.md');
    const description = fm.description || '';
    const keywords = extractAgentKeywords(description);

    if (agentName && keywords) {
      const category = getAgentCategory(fm);
      if (!byCategory[category]) byCategory[category] = [];
      byCategory[category].push(`|${agentName}:{${agentName}.md}|${keywords}`);
      agentCount++;
    }
  }

  // Output grouped by category order
  const lines = [
    `[${pluginName} Agent Routing Index]`,
    '|root: ./agents',
    '|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.',
    '|When a task matches keywords below, spawn that agent using the Task tool.',
    '|Do NOT rely on training data — consult agent expertise first.',
    '|',
  ];

  for (const cat of CATEGORY_ORDER) {
    if (byCategory[cat]) {
      lines.push(`|# ${CATEGORY_LABELS[cat]}`);
      // Sort entries within category
      byCategory[cat].sort();
      lines.push(...byCategory[cat]);
    }
  }

  const outputDir = path.join(pluginDir, '.claude-plugin');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'agent-index.md'), lines.join('\n') + '\n');

  if (agentCount > 0) {
    indexesGenerated++;
    console.log(`    ${GREEN}Tier 1: ${agentCount} agents indexed (grouped)${NC}`);
  }
}

// ============================================================================
// Stage 2: Generate Tier 2 skill-indexes per agent per plugin
// ============================================================================

function generateSkillIndexes(pluginName, pluginDir) {
  const agentsDir = path.join(pluginDir, 'agents');
  const skillsDir = path.join(pluginDir, 'skills');
  if (!fs.existsSync(agentsDir) || !fs.existsSync(skillsDir)) return;

  const outputDir = path.join(pluginDir, '.claude-plugin', 'skill-indexes');
  fs.mkdirSync(outputDir, { recursive: true });

  const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));

  for (const file of agentFiles) {
    const agentPath = path.join(agentsDir, file);
    const fm = readAgentFrontmatter(agentPath);
    const agentName = fm.name || path.basename(file, '.md');
    if (!agentName) continue;

    const agentSkills = fm.skills;
    if (!Array.isArray(agentSkills) || agentSkills.length === 0) continue;

    const lines = [
      `[Skills for ${agentName}]`,
      '|root: ./skills',
      '|IMPORTANT: Read the specific SKILL.md file before advising on any topic.',
      '|Do NOT rely on training data for framework patterns.',
      '|',
    ];

    let skillCount = 0;

    for (const skillName of agentSkills) {
      const skillDirPath = path.join(skillsDir, skillName);
      if (!fs.existsSync(skillDirPath)) continue;

      const refs = listSkillReferences(skillDirPath);
      const skillMdPath = path.join(skillDirPath, 'SKILL.md');
      const tags = fs.existsSync(skillMdPath) ? extractSkillTags(skillMdPath) : '';

      let entry = `|${skillName}:{SKILL.md`;
      if (refs) {
        entry += `,references/{${refs}}`;
      }
      entry += '}';

      if (tags) {
        entry += `|${tags}`;
      }

      lines.push(entry);
      skillCount++;
    }

    fs.writeFileSync(path.join(outputDir, `${agentName}.md`), lines.join('\n') + '\n');

    if (skillCount > 0) {
      skillIndexesGenerated++;
    }
  }

  // Count total generated
  try {
    const totalAgents = fs.readdirSync(outputDir).filter(f => f.endsWith('.md')).length;
    if (totalAgents > 0) {
      console.log(`    ${GREEN}Tier 2: ${totalAgents} agent skill indexes generated${NC}`);
    }
  } catch { /* ignore */ }
}

// ============================================================================
// Stage 3: Generate composite index (merges all plugin agent indexes)
// ============================================================================

function generateCompositeIndex() {
  const lines = [
    '[OrchestKit Agent Routing Index]',
    '|root: ./agents',
    '|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.',
    '|When a task matches keywords below, spawn that agent using the Task tool.',
    '|Do NOT rely on training data — consult agent expertise first.',
    '|',
  ];

  const pluginDirs = getPluginDirs();
  for (const pluginDir of pluginDirs) {
    const indexFile = path.join(pluginDir, '.claude-plugin', 'agent-index.md');
    if (!fs.existsSync(indexFile)) continue;

    lines.push(`|# ${path.basename(pluginDir)}`);

    // Skip header lines (first 6), copy agent entries
    const content = fs.readFileSync(indexFile, 'utf-8');
    const allLines = content.split('\n');
    lines.push(...allLines.slice(6).filter(l => l !== ''));
  }

  const compositeFile = path.join(PLUGINS_DIR, '.composite-agent-index.md');
  fs.writeFileSync(compositeFile, lines.join('\n') + '\n');

  const compositeSize = fs.statSync(compositeFile).size;
  const compositeAgents = lines.filter(l => /^\|[a-z]/.test(l)).length;

  console.log('');
  console.log(`${GREEN}  Composite index: ${compositeAgents} agents, ${compositeSize} bytes${NC}`);
  console.log(`${GREEN}  Tier 1 indexes: ${indexesGenerated}${NC}`);
  console.log(`${GREEN}  Tier 2 indexes: ${skillIndexesGenerated}${NC}`);
}

// ============================================================================
// Stage 4: Generate per-plugin CLAUDE.md
// ============================================================================

function generateClaudeMd() {
  let count = 0;
  const pluginDirs = getPluginDirs();

  for (const pluginDir of pluginDirs) {
    const localIndex = path.join(pluginDir, '.claude-plugin', 'agent-index.md');
    if (!fs.existsSync(localIndex)) continue;

    const indexContent = fs.readFileSync(localIndex, 'utf-8');
    const claudeMd = [
      '# OrchestKit Agent Routing',
      '',
      'Prefer retrieval-led reasoning over pre-training-led reasoning.',
      'When a user\'s task matches an agent\'s keywords below, spawn that agent using the Task tool with the matching `subagent_type`.',
      'Do NOT rely on training data — consult agent expertise first.',
      '',
      '```',
      indexContent.trimEnd(),
      '```',
      '',
    ].join('\n');

    fs.writeFileSync(path.join(pluginDir, 'CLAUDE.md'), claudeMd);
    count++;
  }

  console.log(`${GREEN}  Generated CLAUDE.md for ${count} plugins${NC}`);
}

// ============================================================================
// Stage 5: Generate AGENTS.md (cross-tool compat: Cursor, Codex, Amp, Zed)
// ============================================================================

function generateAgentsMd() {
  let count = 0;
  const pluginDirs = getPluginDirs();

  for (const pluginDir of pluginDirs) {
    const claudeMdPath = path.join(pluginDir, 'CLAUDE.md');
    if (!fs.existsSync(claudeMdPath)) continue;

    fs.copyFileSync(claudeMdPath, path.join(pluginDir, 'AGENTS.md'));
    count++;
  }

  console.log(`${GREEN}  Generated AGENTS.md for ${count} plugins (cross-tool compat)${NC}`);
}

// ============================================================================
// Stage 6: Inject Tier 2 skill indexes into agent markdown files
// ============================================================================

function injectSkillIndexes() {
  let injected = 0;
  const pluginDirs = getPluginDirs();

  for (const pluginDir of pluginDirs) {
    const agentsDir = path.join(pluginDir, 'agents');
    const skillIndexesDir = path.join(pluginDir, '.claude-plugin', 'skill-indexes');

    if (!fs.existsSync(agentsDir) || !fs.existsSync(skillIndexesDir)) continue;

    const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));

    for (const file of agentFiles) {
      const agentName = path.basename(file, '.md');
      const indexFile = path.join(skillIndexesDir, `${agentName}.md`);
      if (!fs.existsSync(indexFile)) continue;

      const agentMdPath = path.join(agentsDir, file);
      const agentContent = fs.readFileSync(agentMdPath, 'utf-8');

      // Idempotent: only inject if not already present
      if (agentContent.includes(`[Skills for ${agentName}]`)) continue;

      const indexContent = fs.readFileSync(indexFile, 'utf-8');
      const injection = [
        '',
        '## Skill Index',
        '',
        'Read the specific file before advising. Do NOT rely on training data.',
        '',
        '```',
        indexContent.trimEnd(),
        '```',
        '',
      ].join('\n');

      fs.appendFileSync(agentMdPath, injection);
      injected++;
    }
  }

  console.log(`${GREEN}  Injected Tier 2 indexes into ${injected} agent files${NC}`);
}

// ============================================================================
// Helpers
// ============================================================================

function getPluginDirs() {
  try {
    return fs.readdirSync(PLUGINS_DIR)
      .filter(d => {
        const p = path.join(PLUGINS_DIR, d);
        return fs.statSync(p).isDirectory() && !d.startsWith('.');
      })
      .sort()
      .map(d => path.join(PLUGINS_DIR, d));
  } catch {
    return [];
  }
}

// ============================================================================
// Main
// ============================================================================

function main() {
  console.log(`${BLUE}Generating passive indexes...${NC}`);

  // Stage 1 + 2: Per-plugin Tier 1 + Tier 2
  const pluginDirs = getPluginDirs();
  for (const pluginDir of pluginDirs) {
    const pluginName = path.basename(pluginDir);
    if (fs.existsSync(path.join(pluginDir, 'agents'))) {
      console.log(`  ${BLUE}${pluginName}:${NC}`);
      generateAgentIndex(pluginName, pluginDir);
      generateSkillIndexes(pluginName, pluginDir);
    }
  }

  // Stage 3: Composite index
  generateCompositeIndex();

  // Stage 4: CLAUDE.md
  generateClaudeMd();

  // Stage 5: AGENTS.md
  generateAgentsMd();

  // Stage 6: Inject Tier 2 into agent files
  injectSkillIndexes();
}

main();
