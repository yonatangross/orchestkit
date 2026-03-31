#!/usr/bin/env bash
# ============================================================================
# Vercel Labs Skill Sync Script
# ============================================================================
# Fetches SKILL.md files from Vercel Labs repos and wraps them with
# OrchestKit YAML frontmatter. Run manually or via npm run build.
#
# Usage:
#   bash scripts/sync-vercel-skills.sh          # Fetch all
#   bash scripts/sync-vercel-skills.sh --check  # Verify without fetching
#
# Repos synced:
#   - vercel-labs/agent-browser (5 skills)
#   - vercel-labs/json-render   (27 skills)
#   - vercel-labs/emulate       (4 skills)
#   - vercel-labs/portless      (2 skills)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/src/skills"
VENDOR_DIR="$PROJECT_ROOT/vendor/vercel-skills"
MANIFEST_FILE="$VENDOR_DIR/manifest.json"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

CHECK_ONLY=false
if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=true
fi

# ── Skill definitions ──────────────────────────────────────────
# Format: repo|skill-dir|ork-name|description|tags|complexity
SKILLS=(
  # agent-browser (5 skills)
  "vercel-labs/agent-browser|skills/agent-browser|vercel-agent-browser|Browser automation CLI for AI agents. Navigate, snapshot, interact, extract data, test web apps. Covers headless Chrome, Lightpanda, iOS Simulator, cloud providers, batch commands, HAR capture, and session management.|browser,automation,testing,e2e,agent-browser|medium"
  "vercel-labs/agent-browser|skills/dogfood|vercel-agent-browser-dogfood|Internal dogfooding patterns for agent-browser development and testing.|browser,internal,testing|low"
  "vercel-labs/agent-browser|skills/electron|vercel-agent-browser-electron|Electron app automation with agent-browser. Test desktop apps via CDP.|browser,electron,desktop,testing|low"
  "vercel-labs/agent-browser|skills/slack|vercel-agent-browser-slack|Slack workspace automation via agent-browser. Navigate channels, send messages, interact with Slack UI.|browser,slack,automation|low"
  "vercel-labs/agent-browser|skills/vercel-sandbox|vercel-agent-browser-sandbox|Vercel Sandbox integration for agent-browser. Ephemeral cloud environments for browser testing.|browser,sandbox,cloud,vercel|low"

  # json-render (27 skills)
  "vercel-labs/json-render|skills/core|vercel-json-render-core|Core json-render: schema, catalog, AI prompt generation, SpecStream, dynamic expressions, state, validation. The foundation for all json-render renderers.|json-render,generative-ui,ai,schema,catalog|medium"
  "vercel-labs/json-render|skills/react|vercel-json-render-react|React renderer for json-render. JSON specs become React component trees with data binding, visibility, actions, validation, streaming.|json-render,react,renderer,frontend|low"
  "vercel-labs/json-render|skills/vue|vercel-json-render-vue|Vue 3 renderer for json-render with composables, state binding, and full feature parity with React renderer.|json-render,vue,renderer,frontend|low"
  "vercel-labs/json-render|skills/svelte|vercel-json-render-svelte|Svelte 5 renderer with runes-based reactivity for json-render specs.|json-render,svelte,renderer,frontend|low"
  "vercel-labs/json-render|skills/solid|vercel-json-render-solid|SolidJS renderer for json-render. Reactive rendering with schema export and catalog support.|json-render,solid,renderer,frontend|low"
  "vercel-labs/json-render|skills/next|vercel-json-render-next|Next.js integration patterns for json-render with RSC, streaming, and App Router support.|json-render,next,react,ssr|low"
  "vercel-labs/json-render|skills/shadcn|vercel-json-render-shadcn|shadcn/ui component catalog for json-render. Pre-built components with Zod-typed props for AI-safe generative UI.|json-render,shadcn,components,ui|medium"
  "vercel-labs/json-render|skills/shadcn-svelte|vercel-json-render-shadcn-svelte|shadcn-svelte component catalog for json-render Svelte renderer.|json-render,shadcn,svelte,components|low"
  "vercel-labs/json-render|skills/mcp|vercel-json-render-mcp|MCP Apps integration — serve json-render UIs as interactive apps inside Claude, ChatGPT, Cursor, VS Code. createMcpApp, useJsonRenderApp, buildAppHtml.|json-render,mcp,interactive,dashboard|medium"
  "vercel-labs/json-render|skills/react-pdf|vercel-json-render-react-pdf|PDF renderer for json-render. Generate PDFs from JSON specs with React PDF components.|json-render,pdf,renderer,document|low"
  "vercel-labs/json-render|skills/react-email|vercel-json-render-react-email|React Email renderer. 17 standard components, renderToHtml/renderToPlainText for email generation from JSON specs.|json-render,email,renderer,react-email|low"
  "vercel-labs/json-render|skills/react-three-fiber|vercel-json-render-r3f|React Three Fiber renderer. JSON specs become 3D scenes with meshes, lights, models, cameras.|json-render,3d,three,renderer|low"
  "vercel-labs/json-render|skills/image|vercel-json-render-image|Image renderer powered by Satori. SVG/PNG output for OG images, social cards, banners from JSON specs.|json-render,image,og,satori,renderer|low"
  "vercel-labs/json-render|skills/remotion|vercel-json-render-remotion|Remotion video renderer. JSON specs become video compositions with timeline and animation support.|json-render,video,remotion,renderer|low"
  "vercel-labs/json-render|skills/ink|vercel-json-render-ink|Ink CLI renderer. JSON specs become terminal UIs with React-like components.|json-render,cli,terminal,ink|low"
  "vercel-labs/json-render|skills/yaml|vercel-json-render-yaml|YAML mode for json-render. Token-optimized spec format for AI generation with 40-60% token savings.|json-render,yaml,optimization,tokens|low"
  "vercel-labs/json-render|skills/jotai|vercel-json-render-jotai|Jotai state store adapter for json-render StateStore interface.|json-render,jotai,state,adapter|low"
  "vercel-labs/json-render|skills/redux|vercel-json-render-redux|Redux/RTK state store adapter for json-render StateStore interface.|json-render,redux,state,adapter|low"
  "vercel-labs/json-render|skills/zustand|vercel-json-render-zustand|Zustand state store adapter for json-render StateStore interface.|json-render,zustand,state,adapter|low"
  "vercel-labs/json-render|skills/xstate|vercel-json-render-xstate|XState Store atom adapter for json-render StateStore interface.|json-render,xstate,state,adapter|low"
  "vercel-labs/json-render|skills/react-native|vercel-json-render-react-native|React Native renderer for json-render. Mobile UI from JSON specs.|json-render,react-native,mobile,renderer|low"
  "vercel-labs/json-render|skills/cli|vercel-json-render-cli|CLI tool for json-render. Validate, preview, and generate specs from the terminal.|json-render,cli,tooling|low"
  "vercel-labs/json-render|skills/docs|vercel-json-render-docs|Documentation patterns and conventions for json-render.|json-render,docs,conventions|low"
  "vercel-labs/json-render|skills/forms|vercel-json-render-forms|Dynamic form patterns with validation, conditional fields, and multi-step flows.|json-render,forms,validation,dynamic|medium"
  "vercel-labs/json-render|skills/streaming|vercel-json-render-streaming|Streaming UI patterns with SpecStream, JSON Patch, and progressive rendering.|json-render,streaming,realtime,progressive|medium"
  "vercel-labs/json-render|skills/testing|vercel-json-render-testing|Testing patterns for json-render catalogs, registries, and rendered output.|json-render,testing,quality|low"
  "vercel-labs/json-render|skills/validation|vercel-json-render-validation|Validation patterns for json-render specs, schemas, and runtime prop checking.|json-render,validation,schema|low"

  # emulate (4 skills)
  "vercel-labs/emulate|skills/emulate|vercel-emulate|Stateful API emulation for CI and no-network sandboxes. CLI + programmatic API for GitHub, Vercel, Google, Slack, Apple, Entra, AWS.|emulate,testing,api,mock,stateful|medium"
  "vercel-labs/emulate|skills/github|vercel-emulate-github|GitHub API emulation: repos, PRs, issues, webhooks, GitHub Apps, installations. HMAC-SHA256 signed webhooks.|emulate,github,api,testing|low"
  "vercel-labs/emulate|skills/google|vercel-emulate-google|Google API emulation: OAuth, Gmail, Calendar, Drive.|emulate,google,oauth,api|low"
  "vercel-labs/emulate|skills/vercel|vercel-emulate-vercel|Vercel Platform API emulation: projects, deployments, environment variables.|emulate,vercel,api,deployment|low"

  # portless (2 skills)
  "vercel-labs/portless|skills/portless|vercel-portless|Named .localhost URLs for local dev. Replaces port numbers with stable subdomains. HTTPS, git worktree support, PORTLESS_URL env var.|portless,dev-server,localhost,https|medium"
  "vercel-labs/portless|skills/oauth|vercel-portless-oauth|OAuth callback handling with portless stable URLs. Eliminates port-mismatch issues in local OAuth flows.|portless,oauth,auth,dev|low"
)

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  Vercel Labs Skill Sync${NC}"
echo -e "${CYAN}  ${#SKILLS[@]} skills from 4 repos${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

# Create vendor dir
mkdir -p "$VENDOR_DIR"

SYNCED=0
FAILED=0
SKIPPED=0

for entry in "${SKILLS[@]}"; do
  IFS='|' read -r repo skill_path ork_name description tags complexity <<< "$entry"

  skill_dir="$SKILLS_DIR/$ork_name"
  skill_file="$skill_dir/SKILL.md"
  raw_url="https://raw.githubusercontent.com/$repo/main/$skill_path/SKILL.md"

  if $CHECK_ONLY; then
    if [[ -d "$skill_dir" ]]; then
      echo -e "${GREEN}  OK${NC}: $ork_name"
    else
      echo -e "${RED}  MISSING${NC}: $ork_name"
      FAILED=$((FAILED + 1))
    fi
    continue
  fi

  # Create skill directory
  mkdir -p "$skill_dir"

  # Fetch upstream SKILL.md
  upstream_content=$(curl -sS --fail "$raw_url" 2>/dev/null) || {
    echo -e "${YELLOW}  SKIP${NC}: $ork_name (fetch failed: $raw_url)"
    SKIPPED=$((SKIPPED + 1))

    # If we already have a local copy, keep it
    if [[ -f "$skill_file" ]]; then
      echo -e "${YELLOW}        Using cached version${NC}"
    else
      # Create a minimal placeholder
      IFS=',' read -ra tag_arr <<< "$tags"
      tag_yaml=""
      for t in "${tag_arr[@]}"; do
        tag_yaml="$tag_yaml  - $t
"
      done

      cat > "$skill_file" << PLACEHOLDER
---
name: $ork_name
description: "$description"
tags:
$tag_yaml
version: 0.0.1
author: Vercel Labs (synced by OrchestKit)
user-invocable: false
complexity: $complexity
upstream:
  repo: $repo
  path: $skill_path/SKILL.md
  synced: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  status: fetch-failed
---

# $ork_name

> **Upstream fetch failed.** Run \`bash scripts/sync-vercel-skills.sh\` to sync.
>
> Source: https://github.com/$repo/tree/main/$skill_path

$description
PLACEHOLDER
    fi
    continue
  }

  # Strip upstream frontmatter if present (they use plain markdown, but just in case)
  body="$upstream_content"
  if echo "$upstream_content" | head -1 | grep -q '^---$'; then
    body=$(echo "$upstream_content" | awk 'BEGIN{skip=0; found=0} /^---$/{found++; if(found<=2){skip=1; next}} {if(found>=2) print}')
    # If awk produced nothing, the file had no closing --- so use original
    if [[ -z "$body" ]]; then
      body="$upstream_content"
    fi
  fi

  # Build tag YAML
  IFS=',' read -ra tag_arr <<< "$tags"
  tag_yaml=""
  for t in "${tag_arr[@]}"; do
    tag_yaml="$tag_yaml  - $t
"
  done

  # Write wrapped SKILL.md
  cat > "$skill_file" << SKILLEOF
---
name: $ork_name
description: "$description"
tags:
$tag_yaml
version: 0.1.0
author: Vercel Labs (synced by OrchestKit)
user-invocable: false
complexity: $complexity
upstream:
  repo: $repo
  path: $skill_path/SKILL.md
  synced: "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  status: synced
---

$body
SKILLEOF

  echo -e "${GREEN}  SYNCED${NC}: $ork_name (from $repo)"
  SYNCED=$((SYNCED + 1))
done

echo ""
echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  Sync complete: ${GREEN}$SYNCED synced${NC}, ${YELLOW}$SKIPPED skipped${NC}, ${RED}$FAILED failed${NC}"
echo -e "${CYAN}============================================================${NC}"

# Write manifest
cat > "$MANIFEST_FILE" << MANIFESTEOF
{
  "synced": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "repos": {
    "vercel-labs/agent-browser": {"skills": 5},
    "vercel-labs/json-render": {"skills": 27},
    "vercel-labs/emulate": {"skills": 4},
    "vercel-labs/portless": {"skills": 2}
  },
  "total": ${#SKILLS[@]},
  "synced_count": $SYNCED,
  "skipped_count": $SKIPPED,
  "failed_count": $FAILED
}
MANIFESTEOF

echo -e "${GREEN}  Manifest written to $MANIFEST_FILE${NC}"
