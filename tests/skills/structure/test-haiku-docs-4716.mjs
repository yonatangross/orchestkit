#!/usr/bin/env node
// #4716 (b) and (c): the Haiku 5.5 cost table names its 100K boundary and shows
// the higher tier, and the configure skill lists Claude Platform on AWS among the
// places where `haiku` still runs Haiku 4.5.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const failures = [];
const cost = read('src/skills/analytics/references/cost-estimation.md');
const configure = read('src/skills/configure/SKILL.md');

if (!/\| claude-haiku-5-5 \(prompts through 100K tokens\) \| \$0\.10 \| \$0\.50 \|/.test(cost)) {
  failures.push('cost-estimation.md: Haiku 5.5 base row does not say "through 100K tokens"');
}
if (!/\| claude-haiku-5-5 \(prompts over 100K tokens\) \| \$0\.50 \| \$2\.50 \|/.test(cost)) {
  failures.push('cost-estimation.md: no Haiku 5.5 over-100K row at $0.50 / $2.50');
}
if (!/Foundry, Claude Platform on AWS\)/.test(configure)) {
  failures.push('configure/SKILL.md: Haiku 4.5 provider list omits Claude Platform on AWS');
}

for (const f of failures) console.log(`FAIL ${f}`);
if (failures.length) process.exit(1);
console.log('PASS haiku docs: 100K tiers present, provider list complete');
