#!/usr/bin/env node
/**
 * esbuild configuration for OrchestKit hooks
 *
 * Phase 4: Code splitting - builds multiple event-based bundles
 * for faster per-hook load times (~77% reduction in load size)
 */

import { build, context } from 'esbuild';
import { writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const isWatch = process.argv.includes('--watch');

/**
 * Entry points for code splitting
 * Each entry point produces a separate bundle containing only hooks for that event type
 */
const entryPoints = {
  // Core event-based bundles (CC hook events)
  permission: './src/entries/permission.ts', // PreToolUse (permission decisions)
  pretool: './src/entries/pretool.ts', // PreToolUse (validation)
  posttool: './src/entries/posttool.ts', // PostToolUse
  prompt: './src/entries/prompt.ts', // UserPromptSubmit
  lifecycle: './src/entries/lifecycle.ts', // SessionStart/SessionEnd
  stop: './src/entries/stop.ts', // Stop
  subagent: './src/entries/subagent.ts', // SubagentStart/SubagentStop
  notification: './src/entries/notification.ts', // Notification
  setup: './src/entries/setup.ts', // Setup (--init, --maintenance)
  skill: './src/entries/skill.ts', // Skill-specific hooks
  agent: './src/entries/agent.ts', // Agent-specific hooks
};

const commonBuildOptions = {
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  minify: !isWatch,
  sourcemap: true,
  metafile: true,
  // No `external` deps (#2017): hooks ship WITHOUT node_modules, so every dep
  // must be inlined or a node: builtin — an external would throw
  // ERR_MODULE_NOT_FOUND in the installed plugin. The SQLite engine is the
  // built-in `node:sqlite` (lazily loaded in session-registry.ts since #2005),
  // not the old native `better-sqlite3`; nothing in shipped code imports it.
  drop: isWatch ? [] : ['debugger'],
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
};

/**
 * Build split bundles (one per event type) + unified bundle for CLI tools
 */
async function buildSplitBundles() {
  const startTime = Date.now();
  // Deterministic (#2360): no generatedAt/buildTimeMs in the stats FILE — it is
  // committed (src/hooks/dist + plugins/ork/hooks/dist) and must only change
  // when the bundles change. Build time is logged to the console instead.
  const stats = {
    mode: 'split',
    bundles: {},
    totalSize: 0,
    totalSizeKB: '0',
    inputs: 0,
  };

  console.log('Building split bundles...\n');

  for (const [name, entryPoint] of Object.entries(entryPoints)) {
    const outfile = `./dist/${name}.mjs`;
    const result = await build({
      ...commonBuildOptions,
      entryPoints: [entryPoint],
      outfile,
      // No timestamps in banners or stats (#2360): identical source must produce
      // byte-identical dist output, so committed bundles only diff when code
      // actually changes and the plugins/ drift gate can catch stale bundles.
      banner: {
        js: `// OrchestKit Hooks - ${name} bundle
`,
      },
    });

    const outputFile = result.metafile.outputs[`dist/${name}.mjs`];
    stats.bundles[name] = {
      size: outputFile.bytes,
      sizeKB: (outputFile.bytes / 1024).toFixed(2),
      exports: outputFile.exports.length,
    };
    stats.totalSize += outputFile.bytes;
    stats.inputs = Math.max(stats.inputs, Object.keys(result.metafile.inputs).length);

    console.log(`  ${name}.mjs: ${stats.bundles[name].sizeKB} KB (${outputFile.exports.length} exports)`);
  }

  // The unified dist/hooks.mjs bundle was removed with src/index.ts (dead-hook
  // triage 2026-07-15): the runtime loads only the split bundles via
  // bin/run-hook.mjs, and the monolith's sole consumer was the never-invoked
  // bin/decision-history.mjs CLI.

  const buildTimeMs = Date.now() - startTime;
  stats.totalSizeKB = (stats.totalSize / 1024).toFixed(2);
  stats.avgBundleSizeKB = (stats.totalSize / Object.keys(entryPoints).length / 1024).toFixed(2);

  writeFileSync('./dist/bundle-stats.json', JSON.stringify(stats, null, 2));

  console.log(`\nBuild complete in ${buildTimeMs}ms`);
  console.log(`Split bundles: ${stats.totalSizeKB} KB (${Object.keys(entryPoints).length} bundles)`);
}

/**
 * Ship migration SQL next to the bundles (#2012). The migration runner reads
 * .sql from its own directory (import.meta.url) at runtime; in the distributed
 * plugin that directory is dist/, and build-plugins.sh rsyncs dist/ into the
 * plugin. The source .sql live under src/lib/sqlite-migrations/, which rsync
 * EXCLUDES (--exclude='src') — so without this copy runMigrations() finds zero
 * files and NO tables are ever created in the installed plugin (silent no-op).
 */
function copyMigrations() {
  const srcDir = './src/lib/sqlite-migrations';
  let copied = 0;
  for (const f of readdirSync(srcDir)) {
    if (/^\d{3}-.+\.sql$/.test(f)) {
      copyFileSync(join(srcDir, f), join('./dist', f));
      copied++;
    }
  }
  console.log(`Copied ${copied} migration .sql → dist/ (ship next to bundles, #2012)`);
}

async function main() {
  mkdirSync('./dist', { recursive: true });

  if (isWatch) {
    // Watch mode rebuilds the same split bundles the runtime loads — the old
    // "unified bundle for simplicity" watched src/index.ts, which is gone.
    const ctx = await context({
      ...commonBuildOptions,
      entryPoints,
      outdir: './dist',
      outExtension: { '.js': '.mjs' },
      banner: {
        js: `// OrchestKit Hooks - Development Build
`,
      },
    });
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await buildSplitBundles();
  }

  // #2012: migrations must travel with the bundles (see copyMigrations).
  copyMigrations();
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
