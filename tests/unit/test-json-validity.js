/**
 * JSON File Validator (Node.js)
 *
 * Validates all .json files in .claude/ and .claude-plugin/ for valid JSON syntax.
 * Uses JSON.parse instead of per-file jq — ~2,700 files in <0.5s vs ~71s.
 *
 * Usage: node tests/unit/test-json-validity.js [--verbose]
 * Exit codes: 0 = all pass, 1 = failures found
 */

'use strict';

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const NC = '\x1b[0m';

const verbose = process.argv.includes('--verbose');
const projectRoot = path.resolve(__dirname, '..', '..');
const claudeDir = path.join(projectRoot, '.claude');
const pluginJson = path.join(projectRoot, '.claude-plugin', 'plugin.json');

let passed = 0;
let failed = 0;

function collectJsonFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

function validateFile(filePath) {
  const relative = path.relative(projectRoot, filePath);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Match jq behavior: empty files are valid (jq empty succeeds on empty input)
    if (content.trim().length === 0) { passed++; return; }
    JSON.parse(content);
    passed++;
    if (verbose) {
      console.log(`${GREEN}\u2713${NC} ${relative}`);
    }
  } catch (err) {
    failed++;
    console.log(`${RED}\u2717${NC} ${relative}`);
    console.log(`  Error: ${err.message}`);
  }
}

// Main
console.log('==========================================');
console.log('  JSON Syntax Validation');
console.log('==========================================');
console.log('');

// Validate all JSON files in .claude/
const jsonFiles = collectJsonFiles(claudeDir);
for (const file of jsonFiles) {
  validateFile(file);
}

// Also check .claude-plugin/plugin.json
if (fs.existsSync(pluginJson)) {
  validateFile(pluginJson);
}

const total = passed + failed;

console.log('');
console.log('==========================================');
console.log(`  Results: ${passed}/${total} passed`);
console.log('==========================================');

if (failed > 0) {
  console.log(`${RED}FAILED: ${failed} JSON files are invalid${NC}`);
  process.exit(1);
} else {
  console.log(`${GREEN}SUCCESS: All JSON files are valid${NC}`);
  process.exit(0);
}
