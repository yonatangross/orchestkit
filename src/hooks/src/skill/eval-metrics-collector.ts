/**
 * Eval Metrics Collector Hook
 * Runs on Stop for llm-evaluation skill
 * Collects and summarizes evaluation metrics
 * CC 2.1.7 Compliant
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getProjectDir } from '../lib/common.js';

/**
 * Collect and summarize LLM evaluation metrics
 */
export function evalMetricsCollector(_input: HookInput): HookResult {
  const projectDir = getProjectDir();
  const messages: string[] = [];

  messages.push('::group::LLM Evaluation Summary');

  // Check for evaluation results
  const evalResultsPath = `${projectDir}/eval_results.json`;
  if (existsSync(evalResultsPath)) {
    messages.push('Evaluation results found:');
    try {
      const content = readFileSync(evalResultsPath, 'utf8');
      const data = JSON.parse(content);

      if (typeof data === 'object' && data !== null) {
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'number') {
            const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(2);
            messages.push(`  ${key}: ${formatted}`);
          }
        }
      }
    } catch {
      // If JSON parsing fails, show first 20 lines
      try {
        const content = readFileSync(evalResultsPath, 'utf8');
        const lines = content.split('\n').slice(0, 20);
        messages.push(...lines);
      } catch {
        messages.push('  (Unable to read file)');
      }
    }
  }

  // Check for DeepEval results
  const deepevalDir = `${projectDir}/.deepeval`;
  if (existsSync(deepevalDir)) {
    messages.push('');
    messages.push('DeepEval results directory found');
    try {
      const files = readdirSync(deepevalDir).slice(0, 5);
      for (const file of files) {
        messages.push(`  ${file}`);
      }
    } catch {
      // Ignore
    }
  }

  // Check for RAGAS results
  const ragasPath = `${projectDir}/ragas_results.json`;
  if (existsSync(ragasPath)) {
    messages.push('');
    messages.push('RAGAS evaluation results found');
  }

  messages.push('');
  messages.push('Evaluation complete - review metrics above');
  messages.push('::endgroup::');

  // Log to stderr for visibility during development
  for (const msg of messages) {
    process.stderr.write(msg + '\n');
  }

  return outputSilentSuccess();
}
