#!/usr/bin/env node
/**
 * Decision History CLI - Visualize OrchestKit architecture decisions
 *
 * Usage:
 *   decision-history list [--cc-version VERSION] [--category CATEGORY] [--days N] [--limit N]
 *   decision-history show <decision-id>
 *   decision-history timeline [--group-by cc_version|category|month]
 *   decision-history stats
 *   decision-history mermaid [--output FILE]
 *   decision-history sync
 *   decision-history search <query>
 *
 * Issues: #203, #206, #207, #208
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, '..', 'dist');

// Try to import the module
let decisionHistory;
try {
  // First try the split bundle
  const splitPath = join(distDir, 'hooks.mjs');
  if (existsSync(splitPath)) {
    const mod = await import(splitPath);
    decisionHistory = mod;
  } else {
    // Fallback to direct source import (for development)
    const srcPath = join(__dirname, '..', 'src', 'lib', 'decision-history.js');
    if (existsSync(srcPath)) {
      decisionHistory = await import(srcPath);
    }
  }
} catch (err) {
  console.error('Failed to load decision-history module:', err.message);
  console.error('Run "npm run build" in hooks/ directory first.');
  process.exit(1);
}

if (!decisionHistory) {
  console.error('Decision history module not found.');
  console.error('Run "npm run build" in hooks/ directory first.');
  process.exit(1);
}

const {
  aggregateDecisions,
  filterDecisions,
  searchDecisions,
  formatTable,
  formatTimeline,
  formatStats,
  formatDecisionDetail,
  formatMermaid,
  generateMermaidDocument,
  loadChangelogDecisions,
  COLORS,
} = decisionHistory;

// =============================================================================
// Argument Parsing
// =============================================================================

function parseArgs(args) {
  const result = {
    command: args[0] || 'list',
    positional: [],
    options: {},
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-/g, '_');
      const nextArg = args[i + 1];

      // Check if next arg is a value or another flag
      if (nextArg && !nextArg.startsWith('--')) {
        result.options[key] = nextArg;
        i++;
      } else {
        result.options[key] = true;
      }
    } else {
      result.positional.push(arg);
    }
  }

  return result;
}

// =============================================================================
// Commands
// =============================================================================

async function cmdList(options) {
  const aggregated = await aggregateDecisions();

  const filterOpts = {
    ccVersion: options.cc_version,
    category: options.category,
    days: options.days ? parseInt(options.days, 10) : undefined,
    impact: options.impact,
    source: options.source,
    limit: options.limit ? parseInt(options.limit, 10) : 20,
  };

  const filtered = filterDecisions(aggregated.decisions, filterOpts);

  console.log(formatTable(filtered, filterOpts.limit));
  console.log(
    `\n${COLORS.dim}Total: ${aggregated.metadata.totalDecisions} decisions | Showing: ${filtered.length}${COLORS.reset}`
  );
}

async function cmdShow(decisionId) {
  if (!decisionId) {
    console.error('Usage: decision-history show <decision-id>');
    process.exit(1);
  }

  const aggregated = await aggregateDecisions();
  const decision = aggregated.decisions.find(
    (d) => d.id === decisionId || d.id.includes(decisionId)
  );

  if (!decision) {
    console.error(`Decision not found: ${decisionId}`);
    console.error('\nAvailable decision IDs (first 10):');
    aggregated.decisions.slice(0, 10).forEach((d) => console.error(`  - ${d.id}`));
    process.exit(1);
  }

  console.log(formatDecisionDetail(decision));
}

async function cmdTimeline(options) {
  const aggregated = await aggregateDecisions();

  const filterOpts = {
    ccVersion: options.cc_version,
    category: options.category,
    days: options.days ? parseInt(options.days, 10) : undefined,
  };

  const filtered = filterDecisions(aggregated.decisions, filterOpts);
  const groupBy = options.group_by || 'cc_version';

  console.log(formatTimeline(filtered, groupBy));
}

async function cmdStats() {
  const aggregated = await aggregateDecisions();
  console.log(formatStats(aggregated));
}

async function cmdMermaid(options) {
  const aggregated = await aggregateDecisions();

  const filterOpts = {
    ccVersion: options.cc_version,
    category: options.category,
    limit: options.limit ? parseInt(options.limit, 10) : undefined,
  };

  const filtered = filterDecisions(aggregated.decisions, filterOpts);

  let output;
  if (options.full) {
    output = generateMermaidDocument(filtered);
  } else {
    const groupBy = options.group_by || 'cc_version';
    output = formatMermaid(filtered, groupBy);
  }

  if (options.output) {
    writeFileSync(options.output, output);
    console.log(`Mermaid document written to: ${options.output}`);
  } else {
    console.log(output);
  }
}

async function cmdSync() {
  console.log(`${COLORS.cyan}Syncing decision history...${COLORS.reset}\n`);

  // Force reload changelog (clears cache)
  const decisions = loadChangelogDecisions();
  console.log(`  Parsed ${decisions.length} decisions from CHANGELOG.md`);

  // Aggregate all sources
  const aggregated = await aggregateDecisions();
  console.log(`  Session decisions: ${aggregated.metadata.sources.session || 0}`);
  console.log(`  Coordination decisions: ${aggregated.metadata.sources.coordination || 0}`);

  console.log(`\n${COLORS.green}Sync complete!${COLORS.reset}`);
  console.log(`Total decisions: ${aggregated.metadata.totalDecisions}`);
}

async function cmdSearch(query) {
  if (!query) {
    console.error('Usage: decision-history search <query>');
    process.exit(1);
  }

  const aggregated = await aggregateDecisions();
  const results = searchDecisions(aggregated.decisions, query);

  if (results.length === 0) {
    console.log(`No decisions found matching: "${query}"`);
    return;
  }

  console.log(`\n${COLORS.bold}Search Results for "${query}"${COLORS.reset}\n`);
  console.log(formatTable(results, 20));
}

function printHelp() {
  console.log(`
${COLORS.bold}Decision History CLI${COLORS.reset}
Visualize OrchestKit architecture decisions over time.

${COLORS.cyan}Usage:${COLORS.reset}
  decision-history <command> [options]

${COLORS.cyan}Commands:${COLORS.reset}
  list      List decisions (default)
  show      Show decision details
  timeline  Display timeline view
  stats     Show statistics
  mermaid   Generate Mermaid diagram
  sync      Sync from all sources
  search    Search decisions

${COLORS.cyan}List Options:${COLORS.reset}
  --cc-version VERSION  Filter by CC version (e.g., 2.1.16)
  --category CATEGORY   Filter by category (e.g., security)
  --days N              Show last N days only
  --impact LEVEL        Filter by impact (high/medium/low)
  --source SOURCE       Filter by source (changelog/session/coordination)
  --limit N             Limit results (default: 20)

${COLORS.cyan}Timeline Options:${COLORS.reset}
  --group-by FIELD      Group by: cc_version, category, month (default: cc_version)
  --days N              Show last N days only

${COLORS.cyan}Mermaid Options:${COLORS.reset}
  --output FILE         Write to file instead of stdout
  --group-by FIELD      Group by: cc_version, category
  --full                Generate full document with multiple diagrams

${COLORS.cyan}Examples:${COLORS.reset}
  decision-history list --cc-version 2.1.16
  decision-history timeline --group-by category
  decision-history stats
  decision-history mermaid --output timeline.md
  decision-history search "typescript hooks"
  decision-history show 4.28.0-architecture-1
`);
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const { command, positional, options } = parseArgs(args);

  try {
    switch (command) {
      case 'list':
        await cmdList(options);
        break;
      case 'show':
        await cmdShow(positional[0]);
        break;
      case 'timeline':
        await cmdTimeline(options);
        break;
      case 'stats':
        await cmdStats();
        break;
      case 'mermaid':
        await cmdMermaid(options);
        break;
      case 'sync':
        await cmdSync();
        break;
      case 'search':
        await cmdSearch(positional.join(' '));
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`${COLORS.red}Error:${COLORS.reset} ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();
