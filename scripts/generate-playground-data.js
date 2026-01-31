#!/usr/bin/env node
/**
 * Generate Playground Data
 * Generates docs/playgrounds/data.js from manifests/*.json and src/agents/*.md
 *
 * This script updates the plugins and agents sections of data.js while preserving
 * hand-crafted sections like compositions, demoStyles, categories, and pages.
 *
 * Usage: node scripts/generate-playground-data.js
 */

const fs = require('fs');
const path = require('path');

const MANIFESTS_DIR = path.join(__dirname, '../manifests');
const AGENTS_DIR = path.join(__dirname, '../src/agents');
const DATA_JS_PATH = path.join(__dirname, '../docs/playgrounds/data.js');
const PACKAGE_JSON = path.join(__dirname, '../package.json');

// Plugin metadata not in manifests (hand-curated)
const PLUGIN_METADATA = {
  'ork-core': {
    category: 'development',
    color: '#8b5cf6',
    required: true,
    shortDescription: 'Core foundation - context engineering, architecture decisions, project structure',
    fullDescription: 'The required foundation plugin. Provides context engineering, architecture decision records, project structure enforcement, brainstorming workflows, quality gates, and task dependency patterns. All 119 lifecycle hooks live here.'
  },
  'ork-workflows': {
    category: 'development',
    color: '#8b5cf6',
    required: true,
    shortDescription: 'Implement, explore, verify, review-pr, commit, doctor, feedback',
    fullDescription: 'Essential workflow commands that power the core development loop. Implements parallel subagent execution for feature building, deep codebase exploration, comprehensive verification, PR review with 6+ agents, smart commits, and skill evolution tracking.'
  },
  'ork-memory-graph': {
    category: 'development',
    color: '#8b5cf6',
    required: false,
    shortDescription: 'Knowledge graph memory - remember, recall, load-context',
    fullDescription: 'Zero-config knowledge graph memory that always works. Store decisions, patterns, and context as graph entities. Recall by semantic search. Auto-load relevant context at session start.'
  },
  'ork-memory-mem0': {
    category: 'development',
    color: '#8b5cf6',
    required: false,
    shortDescription: 'Mem0 cloud memory - semantic search, cross-session sync',
    fullDescription: 'Optional cloud memory layer using Mem0 API. Provides semantic search across sessions, automatic sync of decisions and patterns. Requires MEM0_API_KEY environment variable.'
  },
  'ork-memory-fabric': {
    category: 'development',
    color: '#8b5cf6',
    required: false,
    shortDescription: 'Memory orchestration - parallel query, cross-reference boosting',
    fullDescription: 'Orchestration layer that merges results from graph and mem0 memory with deduplication and cross-reference boosting. Dispatches queries to both memory backends in parallel.'
  },
  'ork-rag': { category: 'ai', color: '#06b6d4', required: false },
  'ork-langgraph': { category: 'ai', color: '#06b6d4', required: false },
  'ork-llm': { category: 'ai', color: '#06b6d4', required: false },
  'ork-ai-observability': { category: 'ai', color: '#06b6d4', required: false },
  'ork-evaluation': { category: 'data', color: '#6366f1', required: false },
  'ork-product': { category: 'product', color: '#a855f7', required: false },
  'ork-api': { category: 'backend', color: '#f59e0b', required: false },
  'ork-database': { category: 'backend', color: '#f59e0b', required: false },
  'ork-async': { category: 'backend', color: '#f59e0b', required: false },
  'ork-backend-patterns': { category: 'backend', color: '#f59e0b', required: false },
  'ork-react-core': { category: 'frontend', color: '#ec4899', required: false },
  'ork-ui-design': { category: 'frontend', color: '#ec4899', required: false },
  'ork-frontend': { category: 'frontend', color: '#ec4899', required: false },
  'ork-testing': { category: 'testing', color: '#22c55e', required: false },
  'ork-security': { category: 'security', color: '#ef4444', required: false },
  'ork-devops': { category: 'devops', color: '#f97316', required: false },
  'ork-git': { category: 'development', color: '#8b5cf6', required: false },
  'ork-accessibility': { category: 'accessibility', color: '#14b8a6', required: false },
  'ork-mcp': { category: 'development', color: '#8b5cf6', required: false },
  'ork-video': { category: 'development', color: '#8b5cf6', required: false },
};

// Agent to plugin mapping (derived from manifest skills)
const AGENT_PLUGIN_MAP = {
  'accessibility-specialist': ['ork-accessibility'],
  'ai-safety-auditor': ['ork-security'],
  'backend-system-architect': ['ork-api', 'ork-async', 'ork-backend-patterns'],
  'business-case-builder': ['ork-product'],
  'ci-cd-engineer': ['ork-devops'],
  'code-quality-reviewer': ['ork-workflows'],
  'data-pipeline-engineer': ['ork-evaluation', 'ork-rag'],
  'database-engineer': ['ork-database'],
  'debug-investigator': ['ork-core'],
  'demo-producer': ['ork-video'],
  'deployment-manager': ['ork-devops'],
  'documentation-specialist': ['ork-core'],
  'event-driven-architect': ['ork-backend-patterns'],
  'frontend-ui-developer': ['ork-react-core', 'ork-ui-design', 'ork-frontend'],
  'git-operations-engineer': ['ork-git'],
  'infrastructure-architect': ['ork-devops'],
  'llm-integrator': ['ork-llm'],
  'market-intelligence': ['ork-product'],
  'metrics-architect': ['ork-product'],
  'monitoring-engineer': ['ork-devops', 'ork-ai-observability'],
  'multimodal-specialist': ['ork-llm', 'ork-rag'],
  'performance-engineer': ['ork-frontend'],
  'prioritization-analyst': ['ork-product'],
  'product-strategist': ['ork-product'],
  'prompt-engineer': ['ork-llm'],
  'python-performance-engineer': ['ork-async'],
  'rapid-ui-designer': ['ork-ui-design'],
  'release-engineer': ['ork-devops'],
  'requirements-translator': ['ork-product'],
  'security-auditor': ['ork-security'],
  'security-layer-auditor': ['ork-security'],
  'system-design-reviewer': ['ork-core'],
  'test-generator': ['ork-testing'],
  'ux-researcher': ['ork-ui-design'],
  'workflow-architect': ['ork-langgraph'],
};

function parseAgentFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.substring(0, colonIdx).trim();
    let value = line.substring(colonIdx + 1).trim();

    // Handle arrays
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(s => s.trim().replace(/"/g, ''));
    }

    frontmatter[key] = value;
  }

  return frontmatter;
}

function loadManifests() {
  const files = fs.readdirSync(MANIFESTS_DIR).filter(f => f.endsWith('.json') && f !== 'ork.json');
  const manifests = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(MANIFESTS_DIR, file), 'utf8');
    const manifest = JSON.parse(content);
    manifests.push(manifest);
  }

  // Sort: required plugins first, then alphabetically
  return manifests.sort((a, b) => {
    const aMeta = PLUGIN_METADATA[a.name] || {};
    const bMeta = PLUGIN_METADATA[b.name] || {};
    if (aMeta.required && !bMeta.required) return -1;
    if (!aMeta.required && bMeta.required) return 1;
    return a.name.localeCompare(b.name);
  });
}

function loadAgents() {
  const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
  const agents = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
    const frontmatter = parseAgentFrontmatter(content);
    if (frontmatter && frontmatter.name) {
      agents.push({
        name: frontmatter.name,
        description: frontmatter.description || '',
        model: frontmatter.model || 'sonnet',
        tools: Array.isArray(frontmatter.tools) ? frontmatter.tools : [],
        skills: Array.isArray(frontmatter.skills) ? frontmatter.skills : [],
        plugins: AGENT_PLUGIN_MAP[frontmatter.name] || [],
      });
    }
  }

  return agents.sort((a, b) => a.name.localeCompare(b.name));
}

function getVersion() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  return pkg.version;
}

function countHooks(manifest) {
  // Only ork-core has hooks
  if (manifest.name === 'ork-core' && manifest.hooks === 'all') {
    return 119; // Current hook count
  }
  return 0;
}

function getCommands(manifest) {
  // Commands are user-invocable skills
  // We'd need to check SKILL.md frontmatter, but for now use a known list
  const KNOWN_COMMANDS = {
    'ork-core': ['assess', 'assess-complexity', 'brainstorming', 'configure', 'doctor'],
    'ork-workflows': ['implement', 'explore', 'verify', 'review-pr', 'commit', 'doctor', 'feedback', 'worktree-coordination', 'decision-history', 'skill-evolution'],
    'ork-memory-graph': ['remember', 'recall', 'load-context'],
    'ork-memory-mem0': ['mem0-sync'],
    'ork-evaluation': ['add-golden'],
    'ork-ai-observability': ['drift-detection', 'silent-failure-detection'],
    'ork-testing': ['run-tests'],
    'ork-devops': ['performance-testing', 'release-management'],
    'ork-git': ['create-pr', 'fix-issue', 'git-recovery-command'],
    'ork-mcp': ['agent-browser', 'browser-content-capture'],
    'ork-video': ['demo-producer', 'remotion-composer'],
  };
  return KNOWN_COMMANDS[manifest.name] || [];
}

function generatePluginsArray(manifests, version) {
  return manifests.map(m => {
    const meta = PLUGIN_METADATA[m.name] || { category: 'development', color: '#8b5cf6', required: false };
    const hooks = countHooks(m);
    const commands = getCommands(m);

    return {
      name: m.name,
      description: meta.shortDescription || m.description,
      fullDescription: meta.fullDescription || m.description,
      category: meta.category,
      version: m.version || version,
      skills: m.skills || [],
      agents: m.agents || [],
      commands,
      hooks,
      color: meta.color,
      required: meta.required || false,
    };
  });
}

function generateAgentsArray(agents) {
  return agents.map(a => ({
    name: a.name,
    description: a.description,
    plugins: a.plugins,
    model: a.model,
    tools: a.tools,
    skills: a.skills,
  }));
}

function main() {
  console.log('Generating playground data...\n');

  // Load current data.js to preserve hand-crafted sections
  let currentData = '';
  if (fs.existsSync(DATA_JS_PATH)) {
    currentData = fs.readFileSync(DATA_JS_PATH, 'utf8');
  }

  // Extract preserved sections (compositions, demoStyles, categories, pages, totals)
  const compositionsMatch = currentData.match(/compositions:\s*\[([\s\S]*?)\],\s*\n\s*demoStyles:/);
  const demoStylesMatch = currentData.match(/demoStyles:\s*\[([\s\S]*?)\],\s*\n\s*get totals/);
  const totalsMatch = currentData.match(/get totals\(\)\s*\{[\s\S]*?\},\s*\n\s*pages:/);
  const pagesMatch = currentData.match(/pages:\s*\[([\s\S]*?)\],\s*\n\};/);
  const categoriesMatch = currentData.match(/categories:\s*\{([\s\S]*?)\},\s*\n\s*compositions:/);

  // Load data
  const version = getVersion();
  const manifests = loadManifests();
  const agents = loadAgents();

  // Generate arrays
  const plugins = generatePluginsArray(manifests, version);
  const agentsArray = generateAgentsArray(agents);

  console.log(`  Plugins: ${plugins.length}`);
  console.log(`  Agents: ${agentsArray.length}`);
  console.log(`  Version: ${version}`);

  // Format plugins array
  const pluginsStr = plugins.map(p => {
    const skillsStr = JSON.stringify(p.skills);
    const agentsStr = JSON.stringify(p.agents);
    const commandsStr = JSON.stringify(p.commands);
    return `    { name: "${p.name}", description: "${p.description.replace(/"/g, '\\"')}", fullDescription: "${p.fullDescription.replace(/"/g, '\\"')}", category: "${p.category}", version: "${p.version}",
      skills: ${skillsStr},
      agents: ${agentsStr},
      commands: ${commandsStr},
      hooks: ${p.hooks}, color: "${p.color}", required: ${p.required} }`;
  }).join(',\n\n');

  // Format agents array
  const agentsStr = agentsArray.map(a => {
    return `    { name: "${a.name}", description: "${a.description.replace(/"/g, '\\"')}", plugins: ${JSON.stringify(a.plugins)}, model: "${a.model}", tools: ${JSON.stringify(a.tools)}, skills: ${JSON.stringify(a.skills)} }`;
  }).join(',\n');

  // Build output
  let output = `/**
 * OrchestKit Shared Data Layer
 * Single source of truth for all playground pages.
 * Uses window global (not ES modules) for file:// protocol compatibility.
 *
 * GENERATED FILE - Do not edit plugins/agents sections manually!
 * Run: npm run generate:playground-data
 */
window.ORCHESTKIT_DATA = {
  version: "${version}",

  plugins: [
${pluginsStr}
  ],

  agents: [
${agentsStr}
  ],

`;

  // Add preserved sections
  if (categoriesMatch) {
    output += `  categories: {${categoriesMatch[1]}},\n\n`;
  }

  if (compositionsMatch) {
    output += `  compositions: [${compositionsMatch[1]}],\n\n`;
  }

  if (demoStylesMatch) {
    output += `  demoStyles: [${demoStylesMatch[1]}],\n\n`;
  }

  if (totalsMatch) {
    output += `  ${totalsMatch[0]}\n`;
  }

  if (pagesMatch) {
    output += `  pages: [${pagesMatch[1]}],\n`;
  }

  output += '};\n';

  // Write output
  fs.writeFileSync(DATA_JS_PATH, output);
  console.log(`\nWrote: ${DATA_JS_PATH}`);
  console.log('SUCCESS: Playground data generated');
}

main();
