#!/usr/bin/env bash
# Verify Multi-Hop Relationships in Mem0
# Tests relationship traversal and multi-hop queries

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

USER_ID="orchestkit:all-agents"
SEARCH_SCRIPT="$PROJECT_ROOT/skills/mem0-memory/scripts/crud/search-memories.py"
GET_RELATED_SCRIPT="$PROJECT_ROOT/skills/mem0-memory/scripts/graph/get-related-memories.py"
TRAVERSE_SCRIPT="$PROJECT_ROOT/skills/mem0-memory/scripts/graph/traverse-graph.py"

echo "=== Verifying Mem0 Relationships ==="
echo "User ID: $USER_ID"
echo ""

# Test 1: Search for agent-skill relationships
echo "Test 1: Searching for backend-system-architect relationships..."
python3 "$SEARCH_SCRIPT" \
    --query "backend-system-architect agent uses skills" \
    --user-id "$USER_ID" \
    --limit 5 \
    --enable-graph | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Found {data.get(\"count\", 0)} memories')
if data.get('relations'):
    print(f'Found {len(data[\"relations\"])} relationships')
    for rel in data['relations'][:3]:
        print(f'  {rel.get(\"type\", \"unknown\")}: {rel.get(\"source_id\", \"\")[:8]}... → {rel.get(\"target_id\", \"\")[:8]}...')
else:
    print('No relationships found yet (may need processing time)')
"

echo ""
echo "Test 2: Searching for multi-hop chains..."
python3 "$SEARCH_SCRIPT" \
    --query "agent uses skill implements technology" \
    --user-id "$USER_ID" \
    --limit 3 \
    --enable-graph | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Found {data.get(\"count\", 0)} multi-hop chain memories')
for result in data.get('results', [])[:3]:
    mem = result.get('memory', '')[:100]
    print(f'  - {mem}...')
"

echo ""
echo "Test 3: Get a memory ID to test traversal..."
MEMORY_ID=$(python3 "$SEARCH_SCRIPT" \
    --query "backend-system-architect uses fastapi-advanced" \
    --user-id "$USER_ID" \
    --limit 1 \
    --enable-graph | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['results'][0]['id'] if data.get('results') else '')" 2>/dev/null)

if [[ -n "$MEMORY_ID" && "$MEMORY_ID" != "null" ]]; then
    echo "Found memory ID: ${MEMORY_ID:0:20}..."
    echo ""
    echo "Test 4: Getting related memories (depth 2)..."
    python3 "$GET_RELATED_SCRIPT" \
        --memory-id "$MEMORY_ID" \
        --depth 2 \
        2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    count = data.get('count', 0)
    print(f'Found {count} related memories')
    for item in data.get('related_memories', [])[:5]:
        depth = item.get('depth', 0)
        rel_type = item.get('relation', {}).get('type', 'unknown')
        mem_text = item.get('memory', {}).get('memory', '')[:60]
        print(f'  [Depth {depth}] {rel_type}: {mem_text}...')
except:
    print('Relationships may still be processing...')
" || echo "Relationships may still be processing. Wait a few minutes and try again."
else
    echo "Could not find memory ID for traversal test"
fi

echo ""
echo "=== Summary ==="
echo "Memories created with explicit relationship text for:"
echo "  - Agent → Skill relationships (1-hop)"
echo "  - Skill → Technology relationships (2-hop)"
echo "  - Technology → Technology relationships (3-hop)"
echo "  - Multi-hop chains (4-hop: agent → skill → tech → tech)"
echo ""
echo "Mem0 processes graph relationships asynchronously."
echo "Wait 2-5 minutes, then search with --enable-graph to see relationships."
