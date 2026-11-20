import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const cases = [
  ['src/skills/doctor/references/agents-validation.md', /^- TaskCreate,.*$/m],
  ['src/skills/task-dependency-patterns/SKILL.md', /^> \*\*CC 2\.1\.268 caveat:.*$/m],
  ['src/skills/doctor/references/version-compatibility.md', /^\|.*\| 2\.1\.233 \|.*$/m],
];
const tools = ['TaskCreate', 'TaskGet', 'TaskUpdate', 'TaskList', 'TodoWrite'];
const models = ['Claude 3.x', 'Opus 4.0 to 4.7', 'Sonnet 4.0 to 4.6', 'Haiku 4.5'];
let failures = 0;

for (const [file, pattern] of cases) {
  try {
    const content = readFileSync(new URL(file, root), 'utf8');
    const rule = content.match(pattern)?.[0];
    assert.ok(rule, `${file}: availability rule must exist`);
    for (const name of [...tools, ...models, '2.1.268', 'CLAUDE_CODE_ENABLE_TODO_TOOLS=1']) {
      assert.ok(rule.includes(name), `${file}: missing ${name}`);
    }
    assert.match(rule, /only on/);
    assert.match(rule, /outside (?:this|the) allowlist/);
    assert.match(rule, /only from user or managed settings \(or the shell\)/);
    assert.match(rule, /(?:plugin settings cannot|ork cannot ship)/);
    assert.doesNotMatch(rule, /newest models/);
    console.log(`PASS ${file}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${fileURLToPath(root)}${file}: ${error.message}`);
  }
}

console.log(`Task tool availability: ${cases.length - failures} passed, ${failures} failed`);
process.exitCode = failures ? 1 : 0;
