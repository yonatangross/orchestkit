import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkFrontmatterHookShapes } from '../../src/hooks/scripts/validate-registry.mjs';

const delimiter = '-'.repeat(3);
const wrap = yaml => `${delimiter}\n${yaml}\n${delimiter}\n`;
const check = yaml => checkFrontmatterHookShapes(wrap(yaml), 'fixture');
const fixture = name => readFileSync(new URL(`../fixtures/frontmatter-hooks/${name}.yaml`, import.meta.url), 'utf8');

assert.deepEqual(check(fixture('flat')), [
  'fixture: hooks.PreToolUse[0] is flat (command on the matcher item); nest it under hooks: - type: command',
]);
assert.deepEqual(check(fixture('nested')), []);
for (const item of ['{}', '{hooks: []}', '{hooks: [{command: test}]}', '{command: test, hooks: [{type: command}]}']) {
  assert.equal(check(`hooks: {PostToolUse: [${item}]}`).length, 1);
}
assert.equal(check('hooks: {PreToolUse: invalid}').length, 1);
assert.equal(check('hooks: [invalid').length, 1);
assert.equal(checkFrontmatterHookShapes(`${delimiter}\nname: fixture`, 'fixture').length, 1);
assert.deepEqual(check('name: fixture'), []);
console.log('PASS: flat, mixed, missing handlers, missing type, invalid YAML and nested frontmatter shapes');
