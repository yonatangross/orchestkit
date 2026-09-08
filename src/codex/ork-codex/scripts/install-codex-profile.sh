#!/usr/bin/env bash
# Install the OrchestKit mech profile into a Codex home.
#
# `codex --profile <name>` layers $CODEX_HOME/<name>.config.toml over the base
# config (measured on codex-cli 0.153.4). This copies the shipped profile there
# and refuses the two states that would otherwise fail silently or loudly later:
# an existing file it would clobber, and a legacy `[profiles.ork-mech]` table
# left in config.toml, which makes `--profile ork-mech` a hard config-load error.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/../profiles/ork-mech.config.toml"
DESTINATION="${1:-${CODEX_HOME:-$HOME/.codex}}"
NAME="ork-mech"
TARGET="$DESTINATION/$NAME.config.toml"

if [[ ! -f "$SOURCE" ]]; then
  echo "profile template not found: $SOURCE" >&2
  exit 1
fi

mkdir -p "$DESTINATION"

if [[ -e "$TARGET" ]]; then
  echo "refusing to overwrite existing profile: $TARGET" >&2
  echo "diff it against $SOURCE, then remove it to reinstall" >&2
  exit 1
fi

BASE_CONFIG="$DESTINATION/config.toml"
if [[ -f "$BASE_CONFIG" ]] && grep -qE "^\s*(\[profiles\.$NAME\]|profile\s*=\s*\"$NAME\")" "$BASE_CONFIG"; then
  echo "refusing to install: $BASE_CONFIG carries a legacy [profiles.$NAME] table" >&2
  echo "codex rejects --profile $NAME while that table exists; remove it first" >&2
  exit 1
fi

install -m 0644 "$SOURCE" "$TARGET"

echo "Installed OrchestKit Codex profile: $TARGET"
echo "Run: codex exec --profile $NAME \"<task>\" </dev/null"
