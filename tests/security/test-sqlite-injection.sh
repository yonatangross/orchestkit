#!/usr/bin/env bash
# Security Tests: SQL injection resistance of the coordination DB
#
# Priority: CRITICAL
# Reference: OWASP A03:2021 Injection, CWE-89 (SQL Injection)
#
# =============================================================================
# WHAT THIS FILE USED TO BE
# =============================================================================
# 9 functions, 8 of which exercised `sqlite_escape` — a `sed "s/'/''/g"` helper
# defined in tests/fixtures/test-helpers.sh:1343 and called from NOWHERE in
# src/, bin/ or scripts/. The suite was asserting that a function belonging to
# the test harness escaped quotes correctly, which is the "test the test"
# failure mode: it could go red only if someone broke the harness, and it said
# nothing about whether production code was injectable.
#
# The 9th, test_ts_common_has_escape_functions, grepped src/hooks/src/lib/
# common.ts for /escape|sanitize|quote/. That matches `escapeRegex` (a REGEX
# escaper re-exported at common.ts:37) — unrelated to SQL. It passed for a
# reason that had nothing to do with the thing it claimed to check.
#
# The comment header also referenced a `file_locks` table and a
# hooks/_lib/common.sh that the TypeScript migration removed.
#
# =============================================================================
# WHAT IT TESTS NOW: the real SQLite surface, measured
# =============================================================================
# The coordination DB (src/hooks/src/lib/session-registry.ts, sessions.db at
# ~/.local/state/orchestkit) is reached from src/hooks/src/lifecycle/*,
# posttool/heartbeat.ts, worktree/exit-finalizer.ts, lib/settings-override.ts
# and lib/session-registry.ts. Every one of those builds SQL as a CONSTANT
# string and binds values with `?` placeholders. There is no escape function in
# production, because escaping is not how this code defends itself.
#
# So injection resistance here is two properties, and both are asserted below:
#
#   1. STATIC — no SQL is ever assembled from interpolation or concatenation.
#      Parameter binding is the whole defence; the day someone writes
#      db.prepare(`... WHERE sid = '${sid}'`) the defence is gone, and no
#      runtime payload test would necessarily catch it on the path they added.
#
#   2. RUNTIME — the one live end-to-end path where attacker-controlled text
#      reaches a SQL statement: the Skill tool's `skill` field flows through
#      pretool/skill/skill-tracker.ts:77 -> recordInvocation() ->
#      INSERT INTO skill_invocation (...) VALUES (?, ?, ?)
#      (session-registry.ts:283). Fire real payloads through the real hook and
#      read the real DB back.
#
# Every expectation below was MEASURED against HEAD before it was written.
# Measured runtime result: the payload `evil'); DROP TABLE skill_invocation; --`
# is stored as that literal string, the table survives, and rows keep
# accumulating. That is what the assertions encode.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../fixtures/test-helpers.sh"

TRACKER="pretool/skill/skill-tracker"
HOOK_SRC="$PROJECT_ROOT/src/hooks/src"
RUNNER="$PROJECT_ROOT/src/hooks/bin/run-hook.mjs"

PASS=0
FAIL=0

RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; NC=$'\033[0m'
log_pass() { echo "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
log_fail() { echo "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
section()  { echo; echo "${YELLOW}$1${NC}"; }

# check_eq <label> <expected> <actual>
check_eq() {
  if [[ "$2" == "$3" ]]; then
    log_pass "$1 (-> $3)"
  else
    log_fail "$1 — expected [$2], got [$3]"
  fi
}

echo "=========================================="
echo "  coordination DB: SQL injection resistance"
echo "=========================================="

# The runtime half is worthless if the hook cannot be reached: run-hook.mjs
# answers an unknown key with {"continue":true} and exit 0, so a renamed key
# would make the payload tests pass against a hook that never ran.
if ! assert_hook_registered "$TRACKER"; then
  echo "${RED}✗ $TRACKER is not registered — aborting rather than reporting green${NC}"
  exit 1
fi
if [[ ! -x "$RUNNER" ]]; then
  echo "${RED}✗ hook runner missing: $RUNNER${NC}"
  exit 1
fi
TMPD="$(mktemp -d)"
trap 'rm -rf "$TMPD"' EXIT

# The DB is read back through node:sqlite rather than the sqlite3 CLI. That is
# the same engine session-registry.ts:53 opens, it is already a hard requirement
# of the code under test (CI pins Node >= 22.5 for exactly this reason,
# ci.yml:361), and it means this file does not hard-fail on a runner image that
# happens to ship without the sqlite3 binary.
cat > "$TMPD/readback.mjs" <<'READBACK'
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(process.argv[2]);
const sql = process.argv[3];

// Statement-shaped reads come back as rows; anything else (the sessions seed)
// just executes. Values are printed tab-joined, one row per line, so the shell
// can compare them literally.
if (/^\s*(SELECT|PRAGMA)\b/i.test(sql)) {
  for (const row of db.prepare(sql).all()) {
    console.log(Object.values(row).join("\t"));
  }
} else {
  db.exec(sql);
}
db.close();
READBACK

# =============================================================================
section "1. Static: no SQL is built by interpolation or concatenation"
# =============================================================================
# Scanned with node rather than grep because the SQL in session-registrar.ts:175
# and exit-finalizer.ts:58 spans multiple lines inside backtick literals, which
# a line-oriented grep reads as unrelated fragments.

cat > "$TMPD/scan-sql.mjs" <<'SCANNER'
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];

// Statement-shaped, not bare keywords: "UPDATE" alone appears in prose and log
// strings, "UPDATE <ident> SET" does not.
const SQL_STMT =
  /\b(INSERT\s+INTO\s|DELETE\s+FROM\s|UPDATE\s+\w+\s+SET\b|SELECT\b[\s\S]{0,400}?\bFROM\s|CREATE\s+TABLE\b|DROP\s+TABLE\b)/i;

// Every string literal, with escapes consumed so a \" or \` cannot end it early.
const LITERAL = /`(?:\\[\s\S]|[^\\`])*`|"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'/g;

const violations = [];

// Comments are stripped first: an apostrophe in prose ("don't") otherwise opens
// a bogus single-quoted literal that swallows the following lines.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}

function scan(file) {
  const src = stripComments(readFileSync(file, "utf8"));
  LITERAL.lastIndex = 0;
  let m;
  while ((m = LITERAL.exec(src)) !== null) {
    const lit = m[0];
    if (!SQL_STMT.test(lit)) continue;

    const where = `${file}:${lineOf(src, m.index)}`;
    if (lit.startsWith("`") && lit.includes("${")) {
      violations.push(`${where} SQL template literal interpolates \${...}`);
    }
    if (/^\s*\+/.test(src.slice(m.index + lit.length, m.index + lit.length + 20))) {
      violations.push(`${where} SQL literal extended by string concatenation`);
    }
  }
}

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "__tests__" || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".ts")) scan(p);
  }
}

walk(root);
for (const v of violations) console.log(v);
process.exit(violations.length === 0 ? 0 : 1);
SCANNER

scan_rc=0
scan_out="$(node "$TMPD/scan-sql.mjs" "$HOOK_SRC" 2>&1)" || scan_rc=$?
if [[ $scan_rc -eq 0 ]]; then
  log_pass "no interpolated or concatenated SQL under src/hooks/src"
else
  log_fail "SQL assembled from untrusted-capable expressions:"
  printf '      %s\n' "$scan_out"
fi

# Defence-in-depth on the scanner itself: if it stopped finding the SQL that
# demonstrably exists at HEAD (broken regex, moved directory), it would report a
# clean bill of health for a codebase it never actually read.
sql_sites=0
while IFS= read -r f; do
  case "$f" in
    *__tests__*) ;;
    *) sql_sites=$((sql_sites + 1)) ;;
  esac
done < <(grep -rl --include='*.ts' -e 'INSERT INTO' -e 'DELETE FROM' "$HOOK_SRC")

if [[ "$sql_sites" -ge 3 ]]; then
  log_pass "scanner had real SQL to scan ($sql_sites files with DML)"
else
  log_fail "only $sql_sites files with DML found — scanner may be looking at nothing"
fi

# =============================================================================
section "2. Static: the sqlite3 CLI shell-out never goes through a shell"
# =============================================================================
# setup-maintenance.ts:161 passes a DB path AND a SQL string to the sqlite3
# binary. execFileSync takes an argv array, so neither can be reinterpreted by
# a shell; execSync would concatenate them into a single command line.
if grep -rn --include='*.ts' "execSync(.*sqlite3" "$HOOK_SRC" | grep -q '[^ ]'; then
  log_fail "sqlite3 invoked via execSync (shell) — argument injection is possible"
else
  log_pass "sqlite3 is never invoked through a shell"
fi

if grep -rq --include='*.ts' "execFileSync('sqlite3'" "$HOOK_SRC"; then
  log_pass "sqlite3 shell-out uses execFileSync with an argv array"
else
  log_fail "expected an execFileSync('sqlite3', [...]) call site — did it move?"
fi

# =============================================================================
section "3. Runtime: injection payloads through the live skill-tracker hook"
# =============================================================================
# ORK_SESSION_DB (session-registry.ts:109) redirects the DB; HOME redirection
# keeps the hook's analytics writes inside the temp dir instead of the real
# ~/.claude.
export ORK_SESSION_DB="$TMPD/sessions.db"
PROJ="$TMPD/proj"
mkdir -p "$PROJ"
SID="sqli-test-session"

# Hook stdout/stderr is discarded on purpose: the verdict this file cares about
# is what landed in the DB, and a hook that failed to run leaves the row counts
# below wrong, which is a loud failure rather than a swallowed one.
fire_skill() { # fire_skill <skill-name>
  jq -n --arg sid "$SID" --arg pd "$PROJ" --arg s "$1" \
    '{tool_name:"Skill",session_id:$sid,project_dir:$pd,tool_input:{skill:$s}}' \
    | HOME="$TMPD" ORK_SESSION_DB="$ORK_SESSION_DB" node "$RUNNER" "$TRACKER" >/dev/null 2>&1
}

# --disable-warning is scoped to ExperimentalWarning (node:sqlite emits one per
# process); every other warning still reaches stderr. session-registry.ts:31
# suppresses the same string for the same reason.
db() { node --disable-warning=ExperimentalWarning "$TMPD/readback.mjs" "$ORK_SESSION_DB" "$1"; }

# First fire creates the DB and runs the migrations.
fire_skill "benign-skill"
if [[ -f "$ORK_SESSION_DB" ]]; then
  log_pass "hook created the coordination DB at the overridden path"
else
  log_fail "no DB at $ORK_SESSION_DB — the hook never reached session-registry"
  echo; echo "  ${RED}${FAIL} failed${NC} (cannot continue without a DB)"
  exit 1
fi
check_eq "skill_invocation table exists (002-skill-analytics.sql)" \
  "skill_invocation" \
  "$(db "SELECT name FROM sqlite_master WHERE type='table' AND name='skill_invocation';")"

# skill_invocation.session_id is an FK onto sessions(sid) with foreign_keys=ON,
# so rows only land once a session row exists. Seeding it is test setup, not a
# reimplementation of anything under test.
now=$(date +%s)
db "INSERT INTO sessions (sid,pid,cwd,repo_hash,repo_path,status,started_at,last_heartbeat)
    VALUES ('$SID',1,'$PROJ','testhash','$PROJ','running',$now,$now);"

fire_skill "benign-skill"
check_eq "benign invocation recorded" "1" "$(db 'SELECT COUNT(*) FROM skill_invocation;')"

DROP_PAYLOAD="evil'); DROP TABLE skill_invocation; --"
fire_skill "$DROP_PAYLOAD"

check_eq "DROP TABLE payload did not drop the table" \
  "skill_invocation" \
  "$(db "SELECT name FROM sqlite_master WHERE type='table' AND name='skill_invocation';")"
check_eq "DROP TABLE payload inserted exactly one row" \
  "2" "$(db 'SELECT COUNT(*) FROM skill_invocation;')"
check_eq "payload stored as a literal value, not executed" \
  "$DROP_PAYLOAD" \
  "$(db 'SELECT skill FROM skill_invocation ORDER BY rowid LIMIT 1 OFFSET 1;')"

DELETE_PAYLOAD="x'; DELETE FROM skill_invocation WHERE '1'='1"
fire_skill "$DELETE_PAYLOAD"
check_eq "DELETE-injection payload deleted nothing" \
  "3" "$(db 'SELECT COUNT(*) FROM skill_invocation;')"
check_eq "DELETE payload also stored literally" \
  "$DELETE_PAYLOAD" \
  "$(db 'SELECT skill FROM skill_invocation ORDER BY rowid LIMIT 1 OFFSET 2;')"

# A UNION payload is the read-side equivalent; it must land as text rather than
# widening any result set.
UNION_PAYLOAD="a' UNION SELECT sid,cwd,1 FROM sessions --"
fire_skill "$UNION_PAYLOAD"
check_eq "UNION payload stored literally" \
  "$UNION_PAYLOAD" \
  "$(db 'SELECT skill FROM skill_invocation ORDER BY rowid LIMIT 1 OFFSET 3;')"

check_eq "sessions table untouched by every payload above" \
  "1" "$(db 'SELECT COUNT(*) FROM sessions;')"

# =============================================================================
section "4. Runtime: the DB is still structurally sound afterwards"
# =============================================================================
check_eq "PRAGMA integrity_check" "ok" "$(db 'PRAGMA integrity_check;')"

# Views are included deliberately. routing_edge is a VIEW (003-routing-edges.sql
# builds it with CREATE VIEW), so a type='table' filter would silently stop
# noticing if a payload ever managed to drop or redefine it. The type prefix
# also makes a table-swapped-for-view substitution visible.
check_eq "schema is exactly what the migrations declare — nothing added or lost" \
  "table:locks view:routing_edge table:sessions table:settings_overrides table:skill_invocation table:worktree_links" \
  "$(db "SELECT type||':'||name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND type IN ('table','view') ORDER BY name;" | tr '\n' ' ' | sed 's/ $//')"

echo
echo "=========================================="
echo "  ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "=========================================="
[[ $FAIL -eq 0 ]]
