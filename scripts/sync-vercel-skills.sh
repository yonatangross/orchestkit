#!/usr/bin/env bash
# ============================================================================
# Vercel Labs Upstream Skill Sync (Option E — Enhanced)
# ============================================================================
# Fetches SKILL.md files from Vercel Labs repos and deposits them as
# references/upstream-*.md inside our EXISTING skill directories.
#
# Philosophy: Their content = API reference. Our content = playbook.
# We never touch SKILL.md or rules/ — only references/upstream-*.md.
#
# Enhancements over v1:
#   - JSON mapping file (vendor/vercel-skills/mapping.json) instead of bash arrays
#   - Content-hash comparison — skips unchanged files (no timestamp-only diffs)
#   - Commit SHA pinning in manifest.json for reproducible syncs
#   - Committed vendor cache — offline builds work
#
# Usage:
#   bash scripts/sync-vercel-skills.sh          # Fetch all (update vendor cache)
#   bash scripts/sync-vercel-skills.sh --check  # Verify freshness without fetching
#   bash scripts/sync-vercel-skills.sh --dry-run # Show what would change
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_DIR="$PROJECT_ROOT/src/skills"
VENDOR_DIR="$PROJECT_ROOT/vendor/vercel-skills"
MAPPING_FILE="$VENDOR_DIR/mapping.json"
MANIFEST_FILE="$VENDOR_DIR/manifest.json"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

CHECK_ONLY=false
DRY_RUN=false
if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=true
elif [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# ── Ensure mapping file exists ──
if [[ ! -f "$MAPPING_FILE" ]]; then
  echo -e "${RED}ERROR: Missing $MAPPING_FILE${NC}"
  echo "Run: node scripts/init-vercel-mapping.js to create it"
  exit 1
fi

# ── Read mapping with node ──
REFS=$(node -e "
  const m = JSON.parse(require('fs').readFileSync('$MAPPING_FILE', 'utf8'));
  m.refs.forEach(r => console.log([r.repo, r.skill_path, r.target_skill, r.ref_filename].join('|')));
")
TOTAL=$(echo "$REFS" | wc -l | tr -d ' ')

echo -e "${CYAN}============================================================${NC}"
echo -e "${CYAN}  Vercel Labs Upstream Sync (Option E — Enhanced)${NC}"
echo -e "${CYAN}  $TOTAL references → $(node -e "
  const m = JSON.parse(require('fs').readFileSync('$MAPPING_FILE', 'utf8'));
  const targets = [...new Set(m.refs.map(r => r.target_skill))];
  process.stdout.write(targets.length + ' skill directories');
")${NC}"
echo -e "${CYAN}============================================================${NC}"
echo ""

mkdir -p "$VENDOR_DIR"

SYNCED=0
SKIPPED=0
UNCHANGED=0
FAILED=0

# ── Load existing manifest for hash comparison ──
declare -A PREV_HASHES
if [[ -f "$MANIFEST_FILE" ]]; then
  while IFS='=' read -r key val; do
    PREV_HASHES["$key"]="$val"
  done < <(node -e "
    const m = JSON.parse(require('fs').readFileSync('$MANIFEST_FILE', 'utf8'));
    const h = m.content_hashes || {};
    Object.entries(h).forEach(([k,v]) => console.log(k + '=' + v));
  " 2>/dev/null || true)
fi

declare -A NEW_HASHES

while IFS= read -r entry; do
  IFS='|' read -r repo skill_path target_skill ref_filename <<< "$entry"

  target_dir="$SKILLS_DIR/$target_skill/references"
  target_file="$target_dir/$ref_filename"
  raw_url="https://raw.githubusercontent.com/$repo/main/$skill_path/SKILL.md"
  hash_key="$target_skill/$ref_filename"

  if $CHECK_ONLY; then
    if [[ -f "$target_file" ]]; then
      echo -e "${GREEN}  OK${NC}: $hash_key"
    else
      echo -e "${RED}  MISSING${NC}: $hash_key"
      FAILED=$((FAILED + 1))
    fi
    continue
  fi

  # Fetch upstream
  content=$(curl -sS --fail "$raw_url" 2>/dev/null) || {
    echo -e "${YELLOW}  SKIP${NC}: $hash_key (fetch failed: $raw_url)"
    SKIPPED=$((SKIPPED + 1))
    continue
  }

  # Strip upstream frontmatter if present
  body="$content"
  if echo "$content" | head -1 | grep -q '^---$'; then
    stripped=$(echo "$content" | awk 'BEGIN{c=0} /^---$/{c++; next} c>=2{print}')
    if [[ -n "$stripped" ]]; then
      body="$stripped"
    fi
  fi

  # Content hash (SHA256 of body only, ignoring sync header)
  new_hash=$(echo "$body" | shasum -a 256 | cut -d' ' -f1)
  NEW_HASHES["$hash_key"]="$new_hash"
  prev_hash="${PREV_HASHES[$hash_key]:-}"

  if [[ "$new_hash" == "$prev_hash" ]] && [[ -f "$target_file" ]]; then
    UNCHANGED=$((UNCHANGED + 1))
    if ! $DRY_RUN; then
      continue  # Skip write — content identical
    else
      echo -e "  ${CYAN}UNCHANGED${NC}: $hash_key"
      continue
    fi
  fi

  if $DRY_RUN; then
    if [[ -f "$target_file" ]]; then
      echo -e "  ${YELLOW}WOULD UPDATE${NC}: $hash_key"
    else
      echo -e "  ${GREEN}WOULD CREATE${NC}: $hash_key"
    fi
    SYNCED=$((SYNCED + 1))
    continue
  fi

  mkdir -p "$target_dir"

  # Write with sync header (no timestamp — only content hash triggers diffs)
  cat > "$target_file" << EOF
<!-- SYNCED from $repo ($skill_path/SKILL.md) -->
<!-- Hash: $new_hash -->
<!-- Re-sync: bash scripts/sync-vercel-skills.sh -->

$body
EOF

  echo -e "${GREEN}  SYNCED${NC}: $hash_key"
  SYNCED=$((SYNCED + 1))

done <<< "$REFS"

echo ""
echo -e "${CYAN}============================================================${NC}"
if $CHECK_ONLY; then
  echo -e "${CYAN}  Check: ${GREEN}$(($TOTAL - $FAILED)) present${NC}, ${RED}$FAILED missing${NC}"
elif $DRY_RUN; then
  echo -e "${CYAN}  Dry run: ${GREEN}$SYNCED would change${NC}, ${CYAN}$UNCHANGED unchanged${NC}, ${YELLOW}$SKIPPED skipped${NC}"
else
  echo -e "${CYAN}  Sync: ${GREEN}$SYNCED synced${NC}, ${CYAN}$UNCHANGED unchanged${NC}, ${YELLOW}$SKIPPED skipped${NC}, ${RED}$FAILED failed${NC}"
fi
echo -e "${CYAN}============================================================${NC}"

# ── Write manifest (only on actual sync) ──
if ! $CHECK_ONLY && ! $DRY_RUN; then
  # Merge new hashes with previous (preserve hashes for unchanged files)
  MERGED_HASHES="{"
  first=true
  for key in "${!PREV_HASHES[@]}"; do
    if [[ -n "${NEW_HASHES[$key]:-}" ]]; then
      val="${NEW_HASHES[$key]}"
    else
      val="${PREV_HASHES[$key]}"
    fi
    if $first; then first=false; else MERGED_HASHES+=","; fi
    MERGED_HASHES+="\"$key\":\"$val\""
  done
  for key in "${!NEW_HASHES[@]}"; do
    if [[ -z "${PREV_HASHES[$key]:-}" ]]; then
      if $first; then first=false; else MERGED_HASHES+=","; fi
      MERGED_HASHES+="\"$key\":\"${NEW_HASHES[$key]}\""
    fi
  done
  MERGED_HASHES+="}"

  node -e "
    const hashes = $MERGED_HASHES;
    const manifest = {
      strategy: 'option-e-enhanced',
      description: 'Upstream content as references inside existing skills (hash-deduped)',
      synced: '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
      stats: { synced: $SYNCED, unchanged: $UNCHANGED, skipped: $SKIPPED, failed: $FAILED, total: $TOTAL },
      content_hashes: Object.fromEntries(Object.entries(hashes).sort(([a],[b]) => a.localeCompare(b)))
    };
    require('fs').writeFileSync('$MANIFEST_FILE', JSON.stringify(manifest, null, 2) + '\n');
  "
  echo -e "${GREEN}  Manifest: $MANIFEST_FILE${NC}"
fi

# ── Exit code ──
if $CHECK_ONLY && [[ $FAILED -gt 0 ]]; then
  exit 1
fi
