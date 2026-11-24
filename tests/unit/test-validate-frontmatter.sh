#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

node - "$PROJECT_ROOT" "${VALIDATOR_BASELINE:-}" <<'JS'
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const assert = require('assert/strict');
const [root, baseline] = process.argv.slice(2);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-frontmatter-'));
let passed = 0;
const agent = { name: 'sample', description: 'Description', category: 'testing', model: 'inherit' };
const skill = { name: 'sample', description: 'Description', tags: '[test]', version: '1.0.0', author: 'OrchestKit', 'user-invocable': 'false', complexity: 'low' };
const success = '  \x1b[0;32m✓\x1b[0m All agents and skills have valid frontmatter\n';
const error = message => `  \x1b[0;31m✗\x1b[0m ${message}\n`;
const document = fields => `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\nBody\n`;
try {
  for (const dir of ['bin', 'scripts/lib', 'src/agents', 'src/skills/sample']) {
    fs.mkdirSync(path.join(temp, dir), { recursive: true });
  }
  fs.copyFileSync(path.join(root, 'scripts/lib/parse-frontmatter.js'), path.join(temp, 'scripts/lib/parse-frontmatter.js'));
  fs.copyFileSync(path.join(root, 'bin/validate-frontmatter.sh'), path.join(temp, 'bin/validator.sh'));
  if (baseline) fs.copyFileSync(baseline, path.join(temp, 'bin/old.sh'));
  fs.writeFileSync(path.join(temp, 'bin/node'), '#!/bin/sh\nprintf x >> "$VALIDATOR_NODE_LOG"\nexec "$VALIDATOR_NODE" "$@"\n', { mode: 0o755 });
  const nodeLog = path.join(temp, 'node.log');
  function run(script, expectedStarts) {
    const options = { encoding: 'utf8' };
    if (expectedStarts !== undefined) {
      fs.writeFileSync(nodeLog, '');
      options.env = {
        ...process.env,
        PATH: `${path.join(temp, 'bin')}${path.delimiter}${process.env.PATH}`,
        VALIDATOR_NODE: process.execPath,
        VALIDATOR_NODE_LOG: nodeLog,
      };
    }
    const result = spawnSync('bash', [path.join(temp, 'bin', script)], options);
    if (expectedStarts !== undefined) assert.equal(fs.readFileSync(nodeLog, 'utf8').length, expectedStarts);
    return result;
  }
  function check(name, agentText, skillText, errors = []) {
    fs.writeFileSync(path.join(temp, 'src/agents/sample.md'), agentText);
    fs.writeFileSync(path.join(temp, 'src/skills/sample/SKILL.md'), skillText);
    const actual = run('validator.sh', 1);
    const expected = errors.length ? errors.map(error).join('') + `\n\x1b[0;31mFrontmatter validation FAILED: ${errors.length} error(s)\x1b[0m\n` : success;
    assert.equal(actual.status, errors.length ? 1 : 0, name);
    assert.equal(actual.stdout, expected, name);
    assert.equal(actual.stderr, '', name);
    if (baseline) {
      const old = run('old.sh');
      assert.deepEqual([actual.status, actual.stdout, actual.stderr], [old.status, old.stdout, old.stderr], name);
    }
    console.log(`  ok ${name}: exit=${actual.status}${baseline ? ', old/new identical' : ''}`);
    passed++;
  }
  check('valid', document(agent), document(skill));
  check('metadata and multiline values', document({ name: 'sample', description: '>\n  A folded\n  description', model: 'inherit', metadata: '\n  category: testing\n  critical_system_reminder: A long reminder' }), document({ name: 'sample', description: 'Description', 'user-invocable': 'false', metadata: '\n  tags: test, more\n  version: 1.0.0\n  author: OrchestKit\n  complexity: low' }));
  for (const [kind, fields] of [['Agent', agent], ['Skill', skill]]) {
    for (const key of Object.keys(fields)) {
      for (const empty of [false, true]) {
        const broken = { ...fields };
        if (empty) broken[key] = '""'; else delete broken[key];
        check(`${kind} ${empty ? 'empty' : 'missing'} ${key}`, document(kind === 'Agent' ? broken : agent), document(kind === 'Skill' ? broken : skill), [`${kind} 'sample': missing required field '${key}'`]);
      }
    }
  }
  for (const text of ['No frontmatter\n', '---\nname: sample\n']) {
    check(text.startsWith('---') ? 'unterminated frontmatter' : 'no frontmatter', text, text, [
      ...Object.keys(agent).map(key => `Agent 'sample': missing required field '${key}'`),
      ...Object.keys(skill).map(key => `Skill 'sample': missing required field '${key}'`),
    ]);
  }
  check('description at limit', document({ ...agent, description: 'x'.repeat(250) }), document(skill));
  check('description over limit', document({ ...agent, description: 'x'.repeat(251) }), document(skill), ["Agent 'sample': description 251 bytes > 250 limit"]);
  check('short reminder', document({ ...agent, critical_system_reminder: 'short' }), document(skill), ["Agent 'sample': critical_system_reminder too short (5 chars, min 10)"]);
  check('reminder at limit', document({ ...agent, critical_system_reminder: 'x'.repeat(10) }), document(skill));
  check('name mismatch', document(agent), document({ ...skill, name: 'other' }), ["Skill 'sample': name 'other' doesn't match directory"]);
  const earlierAgent = path.join(temp, 'src/agents/a with spaces.md');
  fs.writeFileSync(earlierAgent, document(agent));
  check('malformed field between valid files', document(agent).replace('description: Description', 'description = Description'), document(skill), ["Agent 'sample': missing required field 'description'"]);
  fs.rmSync(earlierAgent);
  fs.rmSync(path.join(temp, 'src/agents/sample.md'));
  fs.rmSync(path.join(temp, 'src/skills/sample/SKILL.md'));
  fs.writeFileSync(path.join(temp, 'src/agents/README.md'), 'Ignored');
  const empty = run('validator.sh', 0);
  assert.deepEqual([empty.status, empty.stdout, empty.stderr], [0, success, '']);
  if (baseline) {
    const old = run('old.sh');
    assert.deepEqual([empty.status, empty.stdout, empty.stderr], [old.status, old.stdout, old.stderr]);
  }
  console.log('  ok empty directories and skipped docs: exit=0');
  passed++;
  console.log(`${passed} passed, 0 failed`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
JS
