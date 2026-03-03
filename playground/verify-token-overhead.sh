#!/usr/bin/env bash
# verify-token-overhead.sh — Measure OrchestKit's token footprint
# Run before/after changes to verify savings.
# Usage: bash playground/verify-token-overhead.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGINS_DIR="$ROOT/plugins"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Token estimation: ~4 chars per token (conservative)
estimate_tokens() {
  local chars=$1
  echo $(( chars / 4 ))
}

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║          OrchestKit Token Overhead Verification             ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# --- 1. Plugin count ---
plugin_count=$(ls -d "$PLUGINS_DIR"/*/  2>/dev/null | wc -l | tr -d ' ')
echo -e "${CYAN}1. Plugin Directories${NC}"
echo "   Plugins found: $plugin_count"
for dir in "$PLUGINS_DIR"/*/; do
  name=$(basename "$dir")
  echo "     - $name"
done
if [ "$plugin_count" -gt 1 ]; then
  echo -e "   ${RED}WARNING: Multiple plugins = duplicate skill listings in CC system-reminder${NC}"
else
  echo -e "   ${GREEN}GOOD: Single plugin = no duplication${NC}"
fi
echo ""

# --- 2. CLAUDE.md per plugin ---
echo -e "${CYAN}2. CLAUDE.md Files (loaded into system prompt)${NC}"
total_claude_chars=0
for dir in "$PLUGINS_DIR"/*/; do
  name=$(basename "$dir")
  claude_file="$dir/CLAUDE.md"
  if [ -f "$claude_file" ]; then
    chars=$(wc -c < "$claude_file" | tr -d ' ')
    tokens=$(estimate_tokens "$chars")
    total_claude_chars=$((total_claude_chars + chars))
    echo "   $name/CLAUDE.md: ${chars} chars (~${tokens} tokens)"
  fi
done
total_claude_tokens=$(estimate_tokens "$total_claude_chars")
echo "   TOTAL: ${total_claude_chars} chars (~${total_claude_tokens} tokens)"
echo ""

# --- 3. AGENTS.md per plugin (should not exist) ---
echo -e "${CYAN}3. AGENTS.md Files (duplicate of CLAUDE.md)${NC}"
agents_count=0
total_agents_chars=0
for dir in "$PLUGINS_DIR"/*/; do
  name=$(basename "$dir")
  agents_file="$dir/AGENTS.md"
  if [ -f "$agents_file" ]; then
    agents_count=$((agents_count + 1))
    chars=$(wc -c < "$agents_file" | tr -d ' ')
    tokens=$(estimate_tokens "$chars")
    total_agents_chars=$((total_agents_chars + chars))
    echo -e "   ${RED}$name/AGENTS.md: ${chars} chars (~${tokens} tokens) — DUPLICATE!${NC}"
  fi
done
if [ "$agents_count" -eq 0 ]; then
  echo -e "   ${GREEN}GOOD: No AGENTS.md files — no duplication${NC}"
else
  total_agents_tokens=$(estimate_tokens "$total_agents_chars")
  echo -e "   ${RED}TOTAL WASTED: ${total_agents_chars} chars (~${total_agents_tokens} tokens)${NC}"
fi
echo ""

# --- 4. User-invocable skills (commands/) ---
echo -e "${CYAN}4. User-Invocable Skills (listed in system-reminder EVERY message)${NC}"
total_commands=0
total_cmd_chars=0
for dir in "$PLUGINS_DIR"/*/; do
  name=$(basename "$dir")
  cmd_dir="$dir/commands"
  if [ -d "$cmd_dir" ]; then
    count=$(ls "$cmd_dir" 2>/dev/null | wc -l | tr -d ' ')
    total_commands=$((total_commands + count))
    # Estimate skill listing overhead: each entry ~80 chars description
    entry_chars=$((count * 120))
    entry_tokens=$(estimate_tokens "$entry_chars")
    echo "   $name/commands/: $count skills (~${entry_tokens} tokens/message)"
    total_cmd_chars=$((total_cmd_chars + entry_chars))
  fi
done
total_cmd_tokens=$(estimate_tokens "$total_cmd_chars")
echo "   TOTAL skill listings: $total_commands entries (~${total_cmd_tokens} tokens/message)"
if [ "$total_commands" -gt 30 ]; then
  echo -e "   ${RED}WARNING: ${total_commands} skill listings per message is excessive${NC}"
elif [ "$total_commands" -gt 20 ]; then
  echo -e "   ${YELLOW}CAUTION: ${total_commands} skill listings is moderate${NC}"
else
  echo -e "   ${GREEN}GOOD: ${total_commands} skill listings is reasonable${NC}"
fi
echo ""

# --- 5. Agent definitions ---
echo -e "${CYAN}5. Agent Definitions${NC}"
total_agents=0
for dir in "$PLUGINS_DIR"/*/; do
  name=$(basename "$dir")
  agent_dir="$dir/agents"
  if [ -d "$agent_dir" ]; then
    count=$(ls "$agent_dir" 2>/dev/null | wc -l | tr -d ' ')
    total_agents=$((total_agents + count))
    echo "   $name/agents/: $count agents"
  fi
done
echo "   TOTAL: $total_agents agent definitions"
echo ""

# --- 6. Hooks ---
echo -e "${CYAN}6. Hooks${NC}"
for dir in "$PLUGINS_DIR"/*/; do
  name=$(basename "$dir")
  hooks_file="$dir/hooks.json"
  if [ -f "$hooks_file" ]; then
    desc=$(grep -o '"description"[^"]*"[^"]*"' "$hooks_file" | head -1 | sed 's/"description"[^"]*"//' | tr -d '"')
    echo "   $name: $desc"
  fi
done
echo ""

# --- SUMMARY ---
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                    TOKEN COST SUMMARY                       ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}"

per_session=$((total_claude_tokens + total_agents_chars / 4))
per_message=$total_cmd_tokens

echo -e "${BOLD}║  Per-Session (loaded once):                                 ║${NC}"
echo -e "${BOLD}║    CLAUDE.md chain:        ~${total_claude_tokens} tokens                       ${NC}"
if [ "$agents_count" -gt 0 ]; then
  echo -e "${BOLD}║    AGENTS.md (duplicate):  ~$(estimate_tokens $total_agents_chars) tokens                       ${NC}"
fi
echo -e "${BOLD}║                                                             ║${NC}"
echo -e "${BOLD}║  Per-Message (every turn):                                  ║${NC}"
echo -e "${BOLD}║    Skill listings:         ~${per_message} tokens                       ${NC}"
echo -e "${BOLD}║    Hooks (capped):         ~800 tokens                      ${NC}"
echo -e "${BOLD}║                                                             ║${NC}"

total_7msg=$(( per_session + (per_message + 800) * 7 ))
echo -e "${BOLD}║  7-Message Session Total:  ~${total_7msg} tokens overhead   ${NC}"
echo -e "${BOLD}║  (excludes MCP tools — that's user config)                  ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Score
if [ "$total_7msg" -lt 20000 ]; then
  echo -e "${GREEN}SCORE: GOOD — overhead is under 20K tokens for 7 messages${NC}"
elif [ "$total_7msg" -lt 40000 ]; then
  echo -e "${YELLOW}SCORE: MODERATE — consider reducing skill count or compressing indexes${NC}"
else
  echo -e "${RED}SCORE: EXCESSIVE — users will burn Pro plan tokens on infrastructure${NC}"
fi
echo ""
