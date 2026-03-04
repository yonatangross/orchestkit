#!/usr/bin/env bash
# create-release-notebook.sh
#
# Creates a versioned NotebookLM notebook for the current OrchestKit release.
# Reads the version from package.json, extracts the matching CHANGELOG section,
# and documents the manual steps required to complete the Release KB via the
# notebooklm-mcp-cli tool (`nlm`) or the Claude Code MCP integration.
#
# This script validates preconditions and prints the exact MCP calls to run.
# The actual notebook creation must be performed through Claude Code (the MCP
# client) because NotebookLM MCP tools require an authenticated browser session
# that cannot be driven from a plain shell script.
#
# Usage:
#   ./scripts/create-release-notebook.sh
#   ./scripts/create-release-notebook.sh --version 7.0.1   # override version
#
# Requires:
#   - jq (JSON parsing)
#   - nlm CLI (notebooklm-mcp-cli): uv tool install notebooklm-mcp-cli
#   - Active nlm session: nlm login

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
VERSION_OVERRIDE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION_OVERRIDE="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '3,18p' "$0"   # Print the header comment block
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Resolve version
# ---------------------------------------------------------------------------
PACKAGE_JSON="$REPO_ROOT/package.json"
if [[ ! -f "$PACKAGE_JSON" ]]; then
  echo "ERROR: package.json not found at $PACKAGE_JSON" >&2
  exit 1
fi

if [[ -n "$VERSION_OVERRIDE" ]]; then
  FULL_VERSION="$VERSION_OVERRIDE"
else
  if ! command -v jq &>/dev/null; then
    echo "ERROR: jq is required to parse package.json. Install with: brew install jq" >&2
    exit 1
  fi
  FULL_VERSION="$(jq -r '.version' "$PACKAGE_JSON")"
fi

if [[ -z "$FULL_VERSION" || "$FULL_VERSION" == "null" ]]; then
  echo "ERROR: Could not read version from $PACKAGE_JSON" >&2
  exit 1
fi

# Derive MAJOR.MINOR label (strip patch)
MINOR_LABEL="$(echo "$FULL_VERSION" | cut -d. -f1-2)"
NOTEBOOK_TITLE="OrchestKit v${MINOR_LABEL} — Release KB"

# ---------------------------------------------------------------------------
# Validate CHANGELOG entry exists
# ---------------------------------------------------------------------------
CHANGELOG="$REPO_ROOT/CHANGELOG.md"
if [[ ! -f "$CHANGELOG" ]]; then
  echo "ERROR: CHANGELOG.md not found at $CHANGELOG" >&2
  exit 1
fi

if ! grep -qF "## [${FULL_VERSION}]" "$CHANGELOG"; then
  echo "ERROR: CHANGELOG.md has no entry for v${FULL_VERSION}." >&2
  echo "       Add a changelog entry before creating the Release KB." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Check nlm auth status (non-fatal: warn if unavailable)
# ---------------------------------------------------------------------------
NLM_STATUS="unknown"
if command -v nlm &>/dev/null; then
  if nlm login --check &>/dev/null 2>&1; then
    NLM_STATUS="active"
  else
    NLM_STATUS="expired"
  fi
else
  NLM_STATUS="not-installed"
fi

# ---------------------------------------------------------------------------
# Print summary and instructions
# ---------------------------------------------------------------------------
echo ""
echo "OrchestKit Release KB — Setup Summary"
echo "======================================"
echo ""
echo "  Version        : ${FULL_VERSION}"
echo "  Notebook title : ${NOTEBOOK_TITLE}"
echo "  CHANGELOG      : entry found for v${FULL_VERSION}"
echo "  nlm auth       : ${NLM_STATUS}"
echo ""

if [[ "$NLM_STATUS" == "expired" ]]; then
  echo "WARNING: Your nlm session has expired. Run 'nlm login' before proceeding."
  echo ""
elif [[ "$NLM_STATUS" == "not-installed" ]]; then
  echo "WARNING: nlm CLI not found. Install with: uv tool install notebooklm-mcp-cli"
  echo "         Then authenticate with: nlm login"
  echo ""
fi

echo "Sources to upload:"
echo "  1. CHANGELOG.md  — section for v${FULL_VERSION}"
echo "  2. CLAUDE.md     — project instructions"
echo "  3. manifests/ork.json — plugin manifest"
echo ""
echo "To create the Release KB, invoke the 'release-notebook' skill in Claude Code:"
echo ""
echo "  /ork:release-notebook"
echo ""
echo "Or run these MCP calls manually inside a Claude Code session:"
echo ""
echo "  # 1. Create notebook"
echo "  mcp__notebooklm__notebook_create(title=\"${NOTEBOOK_TITLE}\")"
echo ""
echo "  # 2. Add sources (replace NOTEBOOK_ID with the returned ID)"
echo "  mcp__notebooklm__source_add(notebook_id=NOTEBOOK_ID, type=\"text\","
echo "    title=\"CHANGELOG v${FULL_VERSION}\", content=<changelog-section>)"
echo ""
echo "  mcp__notebooklm__source_add(notebook_id=NOTEBOOK_ID, type=\"text\","
echo "    title=\"CLAUDE.md — Project Instructions\", content=<claude-md>)"
echo ""
echo "  mcp__notebooklm__source_add(notebook_id=NOTEBOOK_ID, type=\"text\","
echo "    title=\"manifests/ork.json — Plugin Manifest\", content=<manifest>)"
echo ""
echo "  # 3. Generate audio overview (async — poll studio_status until complete)"
echo "  mcp__notebooklm__studio_create(notebook_id=NOTEBOOK_ID, type=\"audio_overview\")"
echo ""
echo "  # 4. Share with project owner"
echo "  mcp__notebooklm__notebook_share_invite(notebook_id=NOTEBOOK_ID,"
echo "    email=\"\${ORCHESTKIT_OWNER_EMAIL:-yonatan2gross@gmail.com}\", role=\"writer\")"
echo ""
echo "See src/skills/release-notebook/SKILL.md for the full workflow."
echo ""
