#!/usr/bin/env node
/**
 * esbuild configuration for OrchestKit hooks
 *
 * Phase 4: Code splitting - builds multiple event-based bundles
 * for faster per-hook load times (~77% reduction in load size)
 */

import { build, context } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';

const isWatch = process.argv.includes('--watch');
const useSplitBundles = process.argv.includes('--split') || !process.argv.includes('--single');

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
  external: [],
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
  const stats = {
    generatedAt: new Date().toISOString(),
    buildTimeMs: 0,
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
      banner: {
        js: `// OrchestKit Hooks - ${name} bundle
// Generated: ${new Date().toISOString()}
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

  // Also build unified bundle for CLI tools (decision-history, etc.)
  const unifiedResult = await build({
    ...commonBuildOptions,
    entryPoints: ['./src/index.ts'],
    outfile: './dist/hooks.mjs',
    banner: {
      js: `// OrchestKit Hooks - Unified Bundle (for CLI tools)
// Generated: ${new Date().toISOString()}
// Use split bundles (permission.mjs, pretool.mjs, etc.) for hooks
`,
    },
  });

  const unifiedOutput = unifiedResult.metafile.outputs['dist/hooks.mjs'];
  stats.bundles['hooks'] = {
    size: unifiedOutput.bytes,
    sizeKB: (unifiedOutput.bytes / 1024).toFixed(2),
    exports: unifiedOutput.exports.length,
    unified: true,
  };

  console.log(`\n  hooks.mjs (unified): ${stats.bundles['hooks'].sizeKB} KB (for CLI tools)`);

  stats.buildTimeMs = Date.now() - startTime;
  stats.totalSizeKB = (stats.totalSize / 1024).toFixed(2);
  stats.avgBundleSizeKB = (stats.totalSize / Object.keys(entryPoints).length / 1024).toFixed(2);

  writeFileSync('./dist/bundle-stats.json', JSON.stringify(stats, null, 2));

  console.log(`\nBuild complete in ${stats.buildTimeMs}ms`);
  console.log(`Split bundles: ${stats.totalSizeKB} KB (${Object.keys(entryPoints).length} bundles)`);
  console.log(`Unified bundle: ${stats.bundles['hooks'].sizeKB} KB`);
}

/**
 * Build single unified bundle (legacy mode)
 */
async function buildSingleBundle() {
  const startTime = Date.now();

  const result = await build({
    ...commonBuildOptions,
    entryPoints: ['./src/index.ts'],
    outfile: './dist/hooks.mjs',
    banner: {
      js: `// OrchestKit Hooks - TypeScript/ESM Bundle
// Generated: ${new Date().toISOString()}
// https://github.com/yonatangross/orchestkit
`,
    },
  });

  const outputFile = result.metafile.outputs['dist/hooks.mjs'];
  const stats = {
    generatedAt: new Date().toISOString(),
    buildTimeMs: Date.now() - startTime,
    mode: 'single',
    size: outputFile.bytes,
    sizeKB: (outputFile.bytes / 1024).toFixed(2),
    inputs: Object.keys(result.metafile.inputs).length,
    exports: outputFile.exports,
  };

  writeFileSync('./dist/bundle-stats.json', JSON.stringify(stats, null, 2));

  console.log(`Build complete in ${stats.buildTimeMs}ms`);
  console.log(`Bundle size: ${stats.sizeKB} KB`);
  console.log(`Input files: ${stats.inputs}`);

  if (stats.size > 100 * 1024) {
    console.warn(`WARNING: Bundle size (${stats.sizeKB} KB) exceeds 100KB target`);
  }
}

async function main() {
  mkdirSync('./dist', { recursive: true });

  if (isWatch) {
    // Watch mode uses unified bundle for simplicity
    const ctx = await context({
      ...commonBuildOptions,
      entryPoints: ['./src/index.ts'],
      outfile: './dist/hooks.mjs',
      banner: {
        js: `// OrchestKit Hooks - Development Build
// Generated: ${new Date().toISOString()}
`,
      },
    });
    await ctx.watch();
    console.log('Watching for changes...');
  } else if (useSplitBundles) {
    await buildSplitBundles();
  } else {
    await buildSingleBundle();
  }
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
