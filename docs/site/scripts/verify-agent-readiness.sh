#!/usr/bin/env bash
# Live probe of the five agent-readiness contracts, against a deployed origin.
#
# Unit tests invoke middleware directly and the build proves the routes exist,
# but neither observes the composed result: middleware headers landing on a
# CDN-served, prerendered response. That only becomes true on a real deployment,
# so this script is the post-deploy gate. Run it against a preview URL before
# promoting, and against production after.
#
#   bash docs/site/scripts/verify-agent-readiness.sh [origin]
#
# Exits non-zero if any contract fails, so it can gate a deploy.
set -uo pipefail

ORIGIN="${1:-https://orchestkit.yonyon.ai}"
FAILURES=0

pass() { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

check_status() { # path expected_status label
  local got
  got=$(curl -s -o /dev/null -w '%{http_code}' "$ORIGIN$1")
  [ "$got" = "$2" ] && pass "$3 ($got)" || fail "$3: expected $2, got $got"
}

check_header() { # path header label [accept]
  local hdrs
  hdrs=$(curl -s -D- -o /dev/null ${4:+-H "Accept: $4"} "$ORIGIN$1")
  if printf '%s' "$hdrs" | grep -qi "^$2:"; then
    pass "$3"
  else
    fail "$3: no '$2' header on $1"
  fi
}

# NOTE: the body is captured into a variable BEFORE grepping, deliberately.
# The obvious `curl ... | grep -q` is wrong under `set -o pipefail`: grep -q
# exits on the first match, curl then dies of SIGPIPE with status 141, and
# pipefail reports the whole pipeline as failed. The result is a probe that
# passes on small bodies and reports a false FAIL on large ones purely because
# curl was still streaming. It cost a live investigation on /openapi.json
# (42 kB), where the pattern was demonstrably present.
check_body() { # path grep_pattern label [accept]
  local body
  body=$(curl -s ${4:+-H "Accept: $4"} "$ORIGIN$1")
  if printf '%s' "$body" | grep -qi -- "$2"; then
    pass "$3"
  else
    fail "$3: '$2' not found in $1"
  fi
}

echo "Agent-readiness probe: $ORIGIN"

echo
echo "1. Agent-friendly 404s"
check_status "/some-path-that-does-not-exist" 404 "unknown path returns a real 404"
check_status "/developers.md" 200 "documented .md convention resolves"
check_body "/some-path-that-does-not-exist" "# 404" "markdown 404 has a heading" "text/markdown"
check_body "/some-path-that-does-not-exist" "llms.txt" "markdown 404 names llms.txt" "text/markdown"
check_body "/some-path-that-does-not-exist" "sitemap.xml" "markdown 404 names the sitemap" "text/markdown"
check_body "/some-path-that-does-not-exist" '"links"' "json 404 carries recovery links" "application/json"

echo
echo "2. Developer resource discoverability"
check_status "/developers" 200 "/developers"
check_status "/yonyon.md" 200 "/yonyon.md"
# Match the Markdown H1, not just the word: against the pre-fix site
# /developers.md served the HTML 404 shell, whose nav also contains "Yonyon",
# so a bare word match reported a pass on a broken endpoint.
check_body "/developers.md" "# OrchestKit by Yonyon" "developers.md is Markdown and names the studio"
check_body "/llms.txt" "/developers.md" "llms.txt advertises the twin"

echo
echo "3. Rate-limit headers on live responses"
for path in /api/health /openapi.json /llms.txt /.well-known/api-catalog /api/search?query=x; do
  check_header "$path" "ratelimit-limit" "RateLimit-Limit on $path" "application/json"
done
check_header "/api/search?query=x" "ratelimit-policy" "RateLimit-Policy present" "application/json"

echo
echo "4. Versioning / deprecation policy"
check_status "/api-policy" 200 "HTML policy page"
check_status "/api-policy.md" 200 "Markdown policy twin"
check_body "/api-policy" "Sunset" "policy page states the sunset guarantee"
check_body "/openapi.json" "components/headers/Sunset" "OpenAPI declares the Sunset header"
check_header "/api/health" "link" "Link header advertises the policy" "application/json"

echo
echo "5. CLI"
if curl -sf "https://registry.npmjs.org/orchestkit" >/dev/null 2>&1; then
  pass "orchestkit is published on npm"
else
  fail "orchestkit is not published on npm (packages/cli is built but unreleased)"
fi

echo
if [ "$FAILURES" -eq 0 ]; then
  echo "All contracts hold."
else
  echo "$FAILURES check(s) failed."
fi
exit $((FAILURES > 0))
