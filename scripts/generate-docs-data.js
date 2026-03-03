#!/usr/bin/env node
/**
 * OrchestKit Docs Data Generator
 *
 * FULLY DYNAMIC: Extracts ALL data from source files.
 * - totals: Counted from actual files
 * - plugins: skillCount from manifests + src/skills
 * - skillsSummary: Generated from skill tags
 * - skillsDetailed: Full metadata from SKILL.md
 *
 * Usage:
 *   node scripts/generate-docs-data.js
 *   npm run generate:docs-data
 */

const fs = require('fs');
const path = require('path');
const { parseYamlFrontmatter } = require('./lib/parse-frontmatter');

// Paths
const PROJECT_ROOT = path.join(__dirname, '..');
const SKILLS_DIR = path.join(PROJECT_ROOT, 'src', 'skills');
const AGENTS_DIR = path.join(PROJECT_ROOT, 'src', 'agents');
const MANIFESTS_DIR = path.join(PROJECT_ROOT, 'manifests');
const HOOKS_DIR = path.join(PROJECT_ROOT, 'src', 'hooks');
const TS_OUTPUT_FILE = path.join(PROJECT_ROOT, 'docs', 'site', 'lib', 'playground-data.ts');
const TS_OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs', 'site', 'lib', 'generated');

// Colors for console output
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

/**
 * Scan folder structure of a skill directory
 */
function scanFolderStructure(skillPath) {
  const structure = {};
  const knownFolders = ['references', 'assets', 'scripts', 'checklists'];

  for (const folder of knownFolders) {
    const folderPath = path.join(skillPath, folder);
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
      const files = fs.readdirSync(folderPath)
        .filter(f => !f.startsWith('.'))
        .sort();
      structure[folder] = files;
    }
  }

  return structure;
}

/**
 * Extract skill metadata from SKILL.md
 */
function extractSkillMetadata(skillName, skillPath) {
  const skillMdPath = path.join(skillPath, 'SKILL.md');

  if (!fs.existsSync(skillMdPath)) {
    console.log(`${YELLOW}  Warning: No SKILL.md found for ${skillName}${NC}`);
    return null;
  }

  const content = fs.readFileSync(skillMdPath, 'utf-8');
  const { frontmatter, body } = parseYamlFrontmatter(content);

  // Scan folder structure
  const structure = scanFolderStructure(skillPath);

  // Truncate body content for reasonable size (first 3000 chars)
  const truncatedBody = body.trim().slice(0, 3000);
  const bodyTruncated = body.trim().length > 3000;

  return {
    name: frontmatter.name || skillName,
    description: frontmatter.description || '',
    version: frontmatter.version || '1.0.0',
    author: frontmatter.author || 'OrchestKit',
    tags: frontmatter.tags || [],
    userInvocable: frontmatter['user-invocable'] === true,
    context: frontmatter.context || 'fork',
    allowedTools: frontmatter['allowed-tools'] || [],
    skills: frontmatter.skills || [],
    agent: frontmatter.agent || null,
    structure: structure,
    content: truncatedBody,
    contentTruncated: bodyTruncated
  };
}

/**
 * Read manifest file and return parsed JSON
 */
function readManifest(manifestPath) {
  const content = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Get skills list for a manifest
 */
function getManifestSkills(manifest, allSkillNames) {
  if (manifest.skills === 'all') {
    return allSkillNames;
  }
  return manifest.skills || [];
}

/**
 * Get which plugins contain a skill
 */
function getSkillPlugins(skillName, manifestData, allSkillNames) {
  const plugins = [];

  for (const [pluginName, manifest] of Object.entries(manifestData)) {
    const skills = getManifestSkills(manifest, allSkillNames);
    if (skills.includes(skillName)) {
      plugins.push(pluginName);
    }
  }

  return plugins;
}

/**
 * Extract agent metadata from agent .md file
 */
function extractAgentMetadata(agentPath) {
  const content = fs.readFileSync(agentPath, 'utf-8');
  const { frontmatter } = parseYamlFrontmatter(content);

  return {
    name: frontmatter.name || path.basename(agentPath, '.md'),
    description: frontmatter.description || '',
    model: frontmatter.model || 'inherit',
    tools: frontmatter.tools || [],
    skills: frontmatter.skills || [],
    hooks: frontmatter.hooks || []
  };
}

/**
 * Find related agents that use a skill
 */
function findRelatedAgents(skillName, agentsData) {
  const related = [];

  for (const agent of Object.values(agentsData)) {
    if (agent.skills && agent.skills.includes(skillName)) {
      related.push(agent.name);
    }
  }

  return related;
}

/**
 * Count hooks from hooks.json AND agent/skill frontmatter
 * - hooks.json: { hooks: { PreToolUse: [{matcher, hooks: [...]}], ... } } = global hooks
 * - Agent .md files may have `hooks:` in frontmatter = agent-scoped hooks
 */
function countHooks(agentsData) {
  let globalCount = 0;
  let scopedCount = 0;

  // Count global hooks from hooks.json
  const hooksJsonPath = path.join(HOOKS_DIR, 'hooks.json');
  if (fs.existsSync(hooksJsonPath)) {
    const hooksData = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf-8'));

    if (hooksData.hooks && typeof hooksData.hooks === 'object') {
      for (const eventType of Object.keys(hooksData.hooks)) {
        const matchers = hooksData.hooks[eventType];
        if (Array.isArray(matchers)) {
          for (const matcher of matchers) {
            if (matcher.hooks && Array.isArray(matcher.hooks)) {
              globalCount += matcher.hooks.length;
            }
          }
        }
      }
    }
  }

  // Count agent-scoped hooks from agent frontmatter
  for (const agent of Object.values(agentsData)) {
    if (agent.hooks && Array.isArray(agent.hooks)) {
      scopedCount += agent.hooks.length;
    }
  }

  // Count skill-scoped hooks (command:.*run-hook in SKILL.md frontmatter)
  let skillScopedCount = 0;
  const skillsDir = path.join(PROJECT_ROOT, 'src', 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const skillName of fs.readdirSync(skillsDir)) {
      const skillMd = path.join(skillsDir, skillName, 'SKILL.md');
      if (fs.existsSync(skillMd)) {
        const content = fs.readFileSync(skillMd, 'utf-8');
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (fmMatch) {
          const fm = fmMatch[1];
          const hookMatches = fm.match(/command:.*run-hook/g);
          if (hookMatches) skillScopedCount += hookMatches.length;
        }
      }
    }
  }

  return { global: globalCount, scoped: scopedCount + skillScopedCount, total: globalCount + scopedCount + skillScopedCount };
}

/**
 * Generate skillsSummary by grouping skills by tags
 */
function generateSkillsSummary(skillsDetailed, manifestData, allSkillNames) {
  // Define category mappings based on common tags
  const categoryMappings = {
    workflows: ['workflow', 'implement', 'explore', 'verify', 'commit'],
    memory: ['memory', 'knowledge-graph', 'mem0'],
    product: ['product', 'strategy', 'business', 'requirements', 'prioritization', 'okr', 'kpi'],
    git: ['git', 'pr', 'github', 'version-control'],
    video: ['video', 'demo', 'remotion', 'vhs', 'manim'],
    accessibility: ['accessibility', 'a11y', 'wcag', 'aria'],
    devops: ['devops', 'ci-cd', 'deployment', 'kubernetes', 'terraform', 'monitoring'],
    testing: ['testing', 'test', 'e2e', 'unit-test', 'integration'],
    security: ['security', 'owasp', 'auth', 'vulnerability'],
    python: ['python', 'fastapi', 'sqlalchemy', 'celery', 'pytest', 'asyncio'],
    react: ['react', 'typescript', 'frontend', 'tanstack', 'zustand'],
    llm: ['llm', 'openai', 'anthropic', 'prompt', 'function-calling', 'streaming'],
    rag: ['rag', 'embeddings', 'vector', 'retrieval', 'pgvector', 'chunking'],
    backend: ['backend', 'api', 'architecture', 'cqrs', 'event-sourcing', 'ddd', 'microservice']
  };

  const summary = {
    ork: {}
  };

  // Get skills for the single plugin
  const orkManifest = manifestData['ork'];
  const orkSkills = orkManifest ? getManifestSkills(orkManifest, allSkillNames) : [];

  // Categorize ork skills
  for (const [category, keywords] of Object.entries(categoryMappings)) {
    const matchingSkills = orkSkills.filter(skillName => {
      const skill = skillsDetailed[skillName];
      if (!skill) return false;
      const tags = skill.tags || [];
      const name = skillName.toLowerCase();
      return keywords.some(kw =>
        tags.some(t => t.toLowerCase().includes(kw)) ||
        name.includes(kw)
      );
    });

    if (matchingSkills.length > 0) {
      // Take top 8 representative skills per category
      summary.ork[category] = matchingSkills.slice(0, 8);
    }
  }

  return summary;
}

/**
 * Generate the full data.js content
 */
function generateDataJs(data) {
  const {
    version,
    totals,
    plugins,
    agents,
    categories,
    skillsSummary,
    compositions,
    skillsDetailed
  } = data;

  // Build JS content with proper formatting
  let js = `/**
 * OrchestKit Shared Data Layer
 * Single source of truth for all playground pages.
 * Uses window global (not ES modules) for file:// protocol compatibility.
 *
 * AUTO-GENERATED by scripts/generate-docs-data.js
 * DO NOT EDIT MANUALLY - your changes will be overwritten.
 *
 * Updated for v${version} two-tier plugin architecture.
 */
window.ORCHESTKIT_DATA = {
  version: "${version}",

  // Totals for the full ork plugin (superset) - AUTO-GENERATED
  totals: ${JSON.stringify(totals, null, 4).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},

  // Navigation pages for index
  pages: [
    { id: "wizard", label: "Setup Wizard", href: "setup-wizard.html", icon: "&#x2728;", description: "Interactive plugin recommendation wizard" },
    { id: "explorer", label: "Marketplace Explorer", href: "marketplace-explorer.html", icon: "&#x1f50d;", description: "Browse all plugins and agents" },
    { id: "gallery", label: "Demo Gallery", href: "demo-gallery.html", icon: "&#x1f3ac;", description: "Browse skill demo videos and compositions" }
  ],

  plugins: ${JSON.stringify(plugins, null, 4).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},

  agents: ${JSON.stringify(agents, null, 4).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},

  categories: ${JSON.stringify(categories, null, 4).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},

  // Skills summary for the two-tier system - AUTO-GENERATED from skill tags
  skillsSummary: ${JSON.stringify(skillsSummary, null, 4).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},

  // Demo compositions (updated plugin references)
  compositions: ${JSON.stringify(compositions, null, 4).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')},

  // Detailed skill metadata - AUTO-GENERATED from src/skills/*/SKILL.md
  skillsDetailed: ${JSON.stringify(skillsDetailed, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')}
};
`;

  return js;
}

/**
 * Generate barrel TypeScript module for backward compatibility.
 * Re-exports from split generated modules.
 */
function generateBarrelModule() {
  return [
    '// AUTO-GENERATED barrel — re-exports from split modules for backward compatibility.',
    '// DO NOT EDIT MANUALLY — your changes will be overwritten.',
    '// Run: npm run build (or node scripts/generate-docs-data.js)',
    '//',
    '// For new code, import directly from @/lib/generated/* for better tree-shaking.',
    '',
    'export type { SkillDetail, SkillMeta, Plugin, AgentSummary, Composition, CategoryMeta, Totals } from "./generated/types";',
    '',
    'export { TOTALS, AGENTS, CATEGORIES, SKILLS_SUMMARY } from "./generated/shared-data";',
    'export { PLUGINS } from "./generated/plugins-data";',
    'export { COMPOSITIONS } from "./generated/compositions-data";',
    '',
    '// Full SKILLS with content — backward compat merge of meta + content',
    'import { SKILLS as SKILLS_META } from "./generated/skills-data";',
    'import { SKILL_CONTENT } from "./generated/skill-content-data";',
    'import type { SkillDetail } from "./generated/types";',
    '',
    'export const SKILLS: Record<string, SkillDetail> = Object.fromEntries(',
    '  Object.entries(SKILLS_META).map(([key, meta]) => [',
    '    key,',
    '    { ...meta, ...(SKILL_CONTENT[key] ?? { content: "", contentTruncated: false }) },',
    '  ]),',
    ');',
    '',
  ].join('\n');
}

/**
 * Generate split TypeScript modules for Fumadocs site
 * Outputs to docs/site/lib/generated/ for tree-shaking
 */
function generateSplitModules(data) {
  const { totals, plugins, agents, categories, compositions, skillsDetailed, skillsSummary } = data;

  // Ensure output dir exists
  if (!fs.existsSync(TS_OUTPUT_DIR)) {
    fs.mkdirSync(TS_OUTPUT_DIR, { recursive: true });
  }

  // 1. types.ts — All interfaces
  const typesContent = [
    '// AUTO-GENERATED by scripts/generate-docs-data.js',
    '// DO NOT EDIT MANUALLY — your changes will be overwritten.',
    '',
    'export interface SkillDetail {',
    '  name: string;',
    '  description: string;',
    '  version: string;',
    '  author: string;',
    '  tags: string[];',
    '  userInvocable: boolean;',
    '  context: string;',
    '  allowedTools: string[];',
    '  skills: string[];',
    '  agent: string | null;',
    '  structure: Record<string, string[]>;',
    '  content: string;',
    '  contentTruncated: boolean;',
    '  plugins: string[];',
    '  relatedAgents: string[];',
    '}',
    '',
    '/** Skill metadata without content fields — used by skill-browser */  ',
    'export type SkillMeta = Omit<SkillDetail, "content" | "contentTruncated">;',
    '',
    'export interface Plugin {',
    '  name: string;',
    '  description: string;',
    '  fullDescription: string;',
    '  category: string;',
    '  version: string;',
    '  skillCount: number;',
    '  agentCount: number;',
    '  hooks: number;',
    '  commandCount: number;',
    '  color: string;',
    '  required: boolean;',
    '  recommended: boolean;',
    '  skills: string[];',
    '  agents: string[];',
    '  commands: string[];',
    '}',
    '',
    'export interface AgentSummary {',
    '  name: string;',
    '  description: string;',
    '  plugins: string[];',
    '  model: string;',
    '  category: string;',
    '}',
    '',
    'export interface Composition {',
    '  id: string;',
    '  skill: string;',
    '  command: string;',
    '  hook: string;',
    '  style: string;',
    '  format: string;',
    '  width: number;',
    '  height: number;',
    '  fps: number;',
    '  durationSeconds: number;',
    '  folder: string;',
    '  category: string;',
    '  primaryColor: string;',
    '  relatedPlugin: string;',
    '  tags: string[];',
    '  thumbnailCdn?: string;',
    '  videoCdn?: string;',
    '}',
    '',
    'export interface CategoryMeta {',
    '  color: string;',
    '  label: string;',
    '}',
    '',
    'export interface Totals {',
    '  plugins: number;',
    '  skills: number;',
    '  agents: number;',
    '  hooks: number;',
    '  commands: number;',
    '  compositions: number;',
    '}',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(TS_OUTPUT_DIR, 'types.ts'), typesContent);

  // 2. shared-data.ts — TOTALS, CATEGORIES, AGENTS, SKILLS_SUMMARY
  const sharedContent = [
    '// AUTO-GENERATED by scripts/generate-docs-data.js',
    '// DO NOT EDIT MANUALLY — your changes will be overwritten.',
    '',
    'import type { Totals, AgentSummary, CategoryMeta } from "./types";',
    '',
    `export const TOTALS: Totals = ${JSON.stringify(totals, null, 2)};`,
    '',
    `export const AGENTS: AgentSummary[] = ${JSON.stringify(agents, null, 2)};`,
    '',
    `export const CATEGORIES: Record<string, CategoryMeta> = ${JSON.stringify(categories, null, 2)};`,
    '',
    `export const SKILLS_SUMMARY = ${JSON.stringify(skillsSummary, null, 2)};`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(TS_OUTPUT_DIR, 'shared-data.ts'), sharedContent);

  // 3. plugins-data.ts — PLUGINS
  const pluginsContent = [
    '// AUTO-GENERATED by scripts/generate-docs-data.js',
    '// DO NOT EDIT MANUALLY — your changes will be overwritten.',
    '',
    'import type { Plugin } from "./types";',
    '',
    `export const PLUGINS: Plugin[] = ${JSON.stringify(plugins, null, 2)};`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(TS_OUTPUT_DIR, 'plugins-data.ts'), pluginsContent);

  // 4. compositions-data.ts — COMPOSITIONS
  const compositionsContent = [
    '// AUTO-GENERATED by scripts/generate-docs-data.js',
    '// DO NOT EDIT MANUALLY — your changes will be overwritten.',
    '',
    'import type { Composition } from "./types";',
    '',
    `export const COMPOSITIONS: Composition[] = ${JSON.stringify(compositions, null, 2)};`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(TS_OUTPUT_DIR, 'compositions-data.ts'), compositionsContent);

  // 5. skills-data.ts — SKILLS (metadata only, no content/contentTruncated)
  const skillsMeta = {};
  for (const [key, skill] of Object.entries(skillsDetailed)) {
    const { content, contentTruncated, ...meta } = skill;
    skillsMeta[key] = meta;
  }
  const skillsContent = [
    '// AUTO-GENERATED by scripts/generate-docs-data.js',
    '// DO NOT EDIT MANUALLY — your changes will be overwritten.',
    '',
    'import type { SkillMeta } from "./types";',
    '',
    `export const SKILLS: Record<string, SkillMeta> = ${JSON.stringify(skillsMeta, null, 2)};`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(TS_OUTPUT_DIR, 'skills-data.ts'), skillsContent);

  // 6. skill-content-data.ts — SKILL_CONTENT (content + contentTruncated only)
  const skillContentMap = {};
  for (const [key, skill] of Object.entries(skillsDetailed)) {
    skillContentMap[key] = { content: skill.content, contentTruncated: skill.contentTruncated };
  }
  const skillContentContent = [
    '// AUTO-GENERATED by scripts/generate-docs-data.js',
    '// DO NOT EDIT MANUALLY — your changes will be overwritten.',
    '// Only import this module when skill content is actually needed (on-demand).',
    '',
    `export const SKILL_CONTENT: Record<string, { content: string; contentTruncated: boolean }> = ${JSON.stringify(skillContentMap, null, 2)};`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(TS_OUTPUT_DIR, 'skill-content-data.ts'), skillContentContent);

  console.log(`${GREEN}  Split modules written to ${TS_OUTPUT_DIR}/${NC}`);
  console.log(`${GREEN}    types.ts, shared-data.ts, plugins-data.ts, compositions-data.ts, skills-data.ts, skill-content-data.ts${NC}`);
}

/**
 * Main generator function
 */
function generate() {
  console.log(`${CYAN}============================================================${NC}`);
  console.log(`${CYAN}        OrchestKit Playground Data Generator${NC}`);
  console.log(`${CYAN}        FULLY DYNAMIC - All data from source${NC}`);
  console.log(`${CYAN}============================================================${NC}`);
  console.log('');

  // Step 1: Read all manifests
  console.log(`${CYAN}[1/6] Reading manifests...${NC}`);
  const manifestData = {};
  const manifestFiles = fs.readdirSync(MANIFESTS_DIR)
    .filter(f => f.endsWith('.json'));

  for (const file of manifestFiles) {
    const pluginName = path.basename(file, '.json');
    const manifestPath = path.join(MANIFESTS_DIR, file);
    manifestData[pluginName] = readManifest(manifestPath);
  }
  console.log(`${GREEN}  Found ${manifestFiles.length} manifests${NC}`);

  // Step 2: Get all skill names
  console.log(`${CYAN}[2/6] Scanning skills directory...${NC}`);
  const allSkillNames = fs.readdirSync(SKILLS_DIR)
    .filter(d => {
      const skillPath = path.join(SKILLS_DIR, d);
      return fs.statSync(skillPath).isDirectory() && !d.startsWith('.');
    })
    .sort();
  console.log(`${GREEN}  Found ${allSkillNames.length} skills${NC}`);

  // Step 3: Read agent metadata
  console.log(`${CYAN}[3/6] Reading agents...${NC}`);
  const agentsData = {};
  const agentFiles = fs.readdirSync(AGENTS_DIR)
    .filter(f => f.endsWith('.md'));

  for (const file of agentFiles) {
    const agentPath = path.join(AGENTS_DIR, file);
    const agentName = path.basename(file, '.md');
    agentsData[agentName] = extractAgentMetadata(agentPath);
  }
  console.log(`${GREEN}  Found ${agentFiles.length} agents${NC}`);

  // Step 4: Extract detailed skill metadata
  console.log(`${CYAN}[4/6] Extracting skill metadata...${NC}`);
  const skillsDetailed = {};
  let userInvocableCount = 0;

  for (const skillName of allSkillNames) {
    const skillPath = path.join(SKILLS_DIR, skillName);
    const metadata = extractSkillMetadata(skillName, skillPath);

    if (metadata) {
      // Add plugin information
      metadata.plugins = getSkillPlugins(skillName, manifestData, allSkillNames);
      // Add related agents
      metadata.relatedAgents = findRelatedAgents(skillName, agentsData);
      skillsDetailed[skillName] = metadata;

      if (metadata.userInvocable) {
        userInvocableCount++;
      }
    }
  }
  console.log(`${GREEN}  Processed ${Object.keys(skillsDetailed).length} skills (${userInvocableCount} user-invocable)${NC}`);

  // Step 5: Count hooks
  console.log(`${CYAN}[5/6] Counting hooks...${NC}`);
  const hookCounts = countHooks(agentsData);
  console.log(`${GREEN}  Found ${hookCounts.total} hooks (${hookCounts.global} global + ${hookCounts.scoped} scoped)${NC}`);

  // Step 6: Generate data structure
  console.log(`${CYAN}[6/6] Generating data.js...${NC}`);

  // Calculate plugin skill counts from manifest
  const orkSkills = getManifestSkills(manifestData['ork'], allSkillNames);

  // Build totals
  const totals = {
    plugins: 1,
    skills: allSkillNames.length,
    agents: agentFiles.length,
    hooks: hookCounts.total,
    commands: userInvocableCount,
    compositions: 14  // Static - demo compositions
  };

  // Build plugins array with dynamic skillCounts
  const plugins = [
    {
      name: "ork",
      description: `The complete AI development toolkit — ${orkSkills.length} skills, ${agentFiles.length} agents, ${hookCounts.total} hooks.`,
      fullDescription: "The complete OrchestKit toolkit. Includes all workflow skills (implement, explore, verify, review-pr, commit), all memory skills (remember, memory, mem0, fabric), product/UX skills, accessibility, specialized patterns for Python (FastAPI, SQLAlchemy, Celery), React (RSC, TanStack, Zustand), LLM integration, RAG retrieval, and all specialized agents.",
      category: "development",
      version: manifestData['ork'].version || "7.0.0",
      skillCount: orkSkills.length,
      agentCount: agentFiles.length,
      hooks: hookCounts.total,
      commandCount: userInvocableCount,
      color: "#06b6d4",
      required: false,
      recommended: true,
      skills: orkSkills.slice(0, 24),  // Sample for display
      agents: Object.keys(agentsData).sort(),
      commands: Object.entries(skillsDetailed)
        .filter(([_, s]) => s.userInvocable)
        .map(([name]) => name)
        .sort()
    }
  ];

  // Build agents array for display
  const agentCategories = {
    'accessibility-specialist': 'frontend',
    'ai-safety-auditor': 'security',
    'backend-system-architect': 'backend',
    'business-case-builder': 'product',
    'ci-cd-engineer': 'devops',
    'code-quality-reviewer': 'testing',
    'data-pipeline-engineer': 'data',
    'database-engineer': 'backend',
    'debug-investigator': 'testing',
    'demo-producer': 'development',
    'deployment-manager': 'devops',
    'documentation-specialist': 'development',
    'event-driven-architect': 'backend',
    'frontend-ui-developer': 'frontend',
    'git-operations-engineer': 'development',
    'infrastructure-architect': 'devops',
    'llm-integrator': 'ai',
    'market-intelligence': 'product',
    'metrics-architect': 'product',
    'monitoring-engineer': 'devops',
    'multimodal-specialist': 'ai',
    'performance-engineer': 'frontend',
    'prioritization-analyst': 'product',
    'product-strategist': 'product',
    'prompt-engineer': 'ai',
    'python-performance-engineer': 'backend',
    'rapid-ui-designer': 'frontend',
    'release-engineer': 'devops',
    'requirements-translator': 'product',
    'security-auditor': 'security',
    'security-layer-auditor': 'security',
    'system-design-reviewer': 'development',
    'test-generator': 'testing',
    'ux-researcher': 'frontend',
    'web-research-analyst': 'research',
    'workflow-architect': 'ai'
  };

  const agents = Object.entries(agentsData).map(([name, data]) => {
    // Determine which plugins contain this agent
    const plugins = [];
    for (const [pluginName, manifest] of Object.entries(manifestData)) {
      const agentList = manifest.agents === 'all'
        ? Object.keys(agentsData)
        : (manifest.agents || []);
      if (agentList.includes(name)) {
        plugins.push(pluginName);
      }
    }
    return {
      name,
      description: data.description,
      plugins: plugins.sort(),
      model: data.model,
      category: agentCategories[name] || 'development'
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Static categories definition
  const categories = {
    development: { color: "#8b5cf6", label: "Development" },
    ai: { color: "#06b6d4", label: "AI" },
    backend: { color: "#f59e0b", label: "Backend" },
    frontend: { color: "#ec4899", label: "Frontend" },
    testing: { color: "#22c55e", label: "Testing" },
    security: { color: "#ef4444", label: "Security" },
    devops: { color: "#f97316", label: "DevOps" },
    product: { color: "#a855f7", label: "Product" },
    data: { color: "#6366f1", label: "Data" },
    research: { color: "#14b8a6", label: "Research" }
  };

  // Generate skills summary dynamically
  const skillsSummary = generateSkillsSummary(skillsDetailed, manifestData, allSkillNames);

  // Static compositions (demo gallery items)
  const compositions = [
    { id: "Implement", skill: "implement", command: "/ork:implement", hook: "Add auth in seconds, not hours", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Core-Skills", category: "core", primaryColor: "#8b5cf6", relatedPlugin: "ork", tags: ["core","landscape","tri-terminal"] },
    { id: "Verify", skill: "verify", command: "/ork:verify", hook: "6 agents validate your feature", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Core-Skills", category: "core", primaryColor: "#22c55e", relatedPlugin: "ork", tags: ["core","landscape","tri-terminal"] },
    { id: "Commit", skill: "commit", command: "/ork:commit", hook: "Conventional commits in seconds", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Core-Skills", category: "core", primaryColor: "#06b6d4", relatedPlugin: "ork", tags: ["core","landscape","tri-terminal"] },
    { id: "Explore", skill: "explore", command: "/ork:explore", hook: "Understand codebases in minutes", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Core-Skills", category: "core", primaryColor: "#06b6d4", relatedPlugin: "ork", tags: ["core","landscape","tri-terminal"] },
    { id: "Remember", skill: "remember", command: "/ork:remember", hook: "Build your team's knowledge base", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Memory-Skills", category: "memory", primaryColor: "#8b5cf6", relatedPlugin: "ork", tags: ["memory","landscape","tri-terminal"] },
    { id: "Memory", skill: "memory", command: "/ork:memory", hook: "Search, load, sync, visualize your knowledge", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Memory-Skills", category: "memory", primaryColor: "#06b6d4", relatedPlugin: "ork", tags: ["memory","landscape","tri-terminal"] },
    { id: "ReviewPR", skill: "review-pr", command: "/ork:review-pr", hook: "Expert PR review in minutes", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Review-Skills", category: "review", primaryColor: "#f97316", relatedPlugin: "ork", tags: ["review","landscape","tri-terminal"] },
    { id: "CreatePR", skill: "create-pr", command: "/ork:create-pr", hook: "PRs that pass review the first time", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Review-Skills", category: "review", primaryColor: "#22c55e", relatedPlugin: "ork", tags: ["review","landscape","tri-terminal"] },
    { id: "FixIssue", skill: "fix-issue", command: "/ork:fix-issue", hook: "From bug report to merged fix in minutes", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Review-Skills", category: "review", primaryColor: "#ef4444", relatedPlugin: "ork", tags: ["review","landscape","tri-terminal"] },
    { id: "Doctor", skill: "doctor", command: "/ork:doctor", hook: "Health diagnostics for OrchestKit systems", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/DevOps-Skills", category: "devops", primaryColor: "#ef4444", relatedPlugin: "ork", tags: ["devops","landscape","tri-terminal"] },
    { id: "Configure", skill: "configure", command: "/ork:configure", hook: "Your AI toolkit, your rules", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/DevOps-Skills", category: "devops", primaryColor: "#f59e0b", relatedPlugin: "ork", tags: ["devops","landscape","tri-terminal"] },
    { id: "Brainstorming", skill: "brainstorming", command: "/ork:brainstorming", hook: "Generate ideas in parallel. 4 specialists.", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/AI-Skills", category: "ai", primaryColor: "#f59e0b", relatedPlugin: "ork", tags: ["ai","landscape","tri-terminal"] },
    { id: "Assess", skill: "assess", command: "/ork:assess", hook: "Evaluate quality across 6 dimensions", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/AI-Skills", category: "ai", primaryColor: "#22c55e", relatedPlugin: "ork", tags: ["ai","landscape","tri-terminal"] },
    { id: "DemoProducer", skill: "demo-producer", command: "/ork:demo-producer", hook: "Professional demos in minutes, not days", style: "TriTerminalRace", format: "landscape", width: 1920, height: 1080, fps: 30, durationSeconds: 20, folder: "Production/Landscape-16x9/Advanced-Skills", category: "advanced", primaryColor: "#ec4899", relatedPlugin: "ork", tags: ["advanced","landscape","tri-terminal"] }
  ];

  // Merge CDN URLs from orchestkit-demos/out/cdn-urls.json (if it exists)
  const cdnUrlsPath = path.join(PROJECT_ROOT, 'orchestkit-demos', 'out', 'cdn-urls.json');
  if (fs.existsSync(cdnUrlsPath)) {
    try {
      const cdnUrls = JSON.parse(fs.readFileSync(cdnUrlsPath, 'utf-8'));
      for (const comp of compositions) {
        const cdn = cdnUrls[comp.id];
        if (cdn) {
          if (cdn.thumbnailCdn) comp.thumbnailCdn = cdn.thumbnailCdn;
          if (cdn.videoCdn) comp.videoCdn = cdn.videoCdn;
        }
      }
      const videoCount = compositions.filter(c => c.videoCdn).length;
      const thumbCount = compositions.filter(c => c.thumbnailCdn).length;
      console.log(`${GREEN}  CDN URLs merged: ${thumbCount} thumbnails, ${videoCount} videos${NC}`);
    } catch (err) {
      console.log(`${YELLOW}  Warning: Could not parse cdn-urls.json: ${err.message}${NC}`);
    }
  } else {
    console.log(`${YELLOW}  Note: cdn-urls.json not found — CDN fields omitted${NC}`);
  }

  // Generate split modules for tree-shaking (docs/site/lib/generated/)
  generateSplitModules({
    totals,
    plugins,
    agents,
    categories,
    compositions,
    skillsDetailed,
    skillsSummary
  });

  // Generate barrel file for backward compatibility
  const tsOutputDir = path.dirname(TS_OUTPUT_FILE);
  if (!fs.existsSync(tsOutputDir)) {
    fs.mkdirSync(tsOutputDir, { recursive: true });
  }
  fs.writeFileSync(TS_OUTPUT_FILE, generateBarrelModule());
  console.log(`${GREEN}  Barrel module: ${TS_OUTPUT_FILE}${NC}`);

  // Summary
  console.log('');
  console.log(`${CYAN}============================================================${NC}`);
  console.log(`${CYAN}                    GENERATION COMPLETE${NC}`);
  console.log(`${CYAN}============================================================${NC}`);
  console.log(`  Total skills:           ${GREEN}${allSkillNames.length}${NC}`);
  console.log(`  Total agents:           ${GREEN}${agentFiles.length}${NC}`);
  console.log(`  Total hooks:            ${GREEN}${hookCounts.total}${NC}`);
  console.log(`  User-invocable:         ${GREEN}${userInvocableCount}${NC}`);
  console.log(`  ork skill count:        ${GREEN}${orkSkills.length}${NC}`);
  console.log(`  Output:                 ${GREEN}${TS_OUTPUT_FILE}${NC}`);
  console.log(`${CYAN}============================================================${NC}`);
  console.log('');
}

// Run
generate();
