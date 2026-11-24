#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fixture="$(mktemp -d "${TMPDIR:-/tmp}/ork-test-case-rules.XXXXXX")"
trap 'rm -rf "$fixture"' EXIT

skill_dir="$fixture/src/skills/sample"
mkdir -p "$fixture/bin" "$skill_dir/rules"
cp "$PROJECT_ROOT/bin/validate-test-case-rules.sh" "$fixture/bin/"
touch "$skill_dir/rules/existing.md"

check() {
  local label="$1" json="$2" expected_status="$3" expected_output="$4"
  local output status=0
  printf '%s\n' "$json" > "$skill_dir/test-cases.json"
  output="$(bash "$fixture/bin/validate-test-case-rules.sh" 2>&1)" || status=$?
  if [[ "$status" -ne "$expected_status" || "$output" != *"$expected_output"* ]]; then
    printf '%s: expected exit %s and %s; got exit %s:\n%s\n' \
      "$label" "$expected_status" "$expected_output" "$status" "$output" >&2
    return 1
  fi
  printf 'PASS: %s\n' "$label"
}

clean='All test-cases.json rule references match actual files'
check 'Empty array' '{"testCases":[]}' 0 "$clean"
check 'Existing and optional rules' '{"testCases":[{"rule":"existing"},{},{"rule":null},{"rule":""}]}' 0 "$clean"
check 'Snake-case array' '{"test_cases":[{"rule":"existing"}]}' 0 "$clean"
check 'Top-level array' '[{"rule":"existing"}]' 0 "$clean"
check 'Missing rule file' '{"testCases":[{"rule":"missing"}]}' 1 'rules/missing.md not found'
check 'Object in testCases' '{"testCases":{"rule":"missing"}}' 1 'src/skills/sample/test-cases.json: testCases must be an array'
check 'Null in testCases' '{"testCases":null,"test_cases":[]}' 1 'src/skills/sample/test-cases.json: testCases must be an array'
check 'Object in test_cases' '{"test_cases":{}}' 1 'src/skills/sample/test-cases.json: test_cases must be an array'
check 'Invalid JSON' '{"testCases":[' 1 'src/skills/sample/test-cases.json: invalid JSON'
