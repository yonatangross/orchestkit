#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
python3 - "$ROOT" <<'PY'
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
gate = (root / 'tests/performance/test-token-overhead.sh').read_text()
cap = int(re.search(r'^SKILL_DESC_MAX_BYTES=(\d+)$', gate, re.M)[1])
paths = [
    'src/skills/CONTRIBUTING-SKILLS.md',
    '.claude/rules/skill-authoring.md',
    'tests/evals/scripts/optimize-description.sh',
]
failures = []
for path in paths:
    text = (root / path).read_text()
    if not re.search(rf'\b{cap} (?:UTF-8 )?bytes\b', text):
        failures.append(f'{path}: missing {cap}-byte cap')
    if not re.search(r'description[^\n]*when_to_use', text):
        failures.append(f'{path}: missing combined description + when_to_use scope')
    for line in text.splitlines():
        if re.search(r'(?:skill descriptions?|the description)\b.*\b\d+(?:\s*[-–]\s*\d+)?\s+words\b', line, re.I):
            failures.append(f'{path}: conflicting word rule: {line.strip()}')

for failure in failures:
    print(f'FAIL: {failure}')
if failures:
    sys.exit(1)
print(f'PASS: {len(paths)} authoring guides match SKILL_DESC_MAX_BYTES={cap}; no conflicting word rules')
PY
