#!/usr/bin/env bash
set -euo pipefail
# Route Map for /ork:expect (Phase 3)
# Maps changed source files to testable URLs by detecting web framework conventions.
# Usage: bash route-map.sh [file1 file2 ...] (or stdin, one per line)
# Output: JSON { framework, routes: {url: [files]}, unmapped: [files] }

CHANGED=()
if [[ $# -gt 0 ]]; then CHANGED=("$@")
else while IFS= read -r line; do [[ -n "$line" ]] && CHANGED+=("$line"); done; fi
[[ ${#CHANGED[@]} -eq 0 ]] && echo '{"framework":"unknown","routes":{},"unmapped":[]}' && exit 0

detect_framework() {
  for d in src/app app; do
    [[ -d "$d" ]] && find "$d" -name "page.tsx" -o -name "page.jsx" 2>/dev/null | head -1 | grep -q . && echo "nextjs-app" && return
  done
  { [[ -d "src/pages" ]] || [[ -d "pages" ]]; } && echo "nextjs-pages" && return
  [[ -d "app/routes" ]] && find app/routes \( -name "*.tsx" -o -name "*.jsx" \) 2>/dev/null | head -1 | grep -q . && echo "remix" && return
  [[ -d "src/routes" ]] && find src/routes -name "+page.svelte" 2>/dev/null | head -1 | grep -q . && echo "sveltekit" && return
  echo "unknown"
}
FW=$(detect_framework)

file_to_url() {
  local f="$1" r
  case "$FW" in
    nextjs-app)
      echo "$f" | grep -qE '(src/app|^app)/.*page\.(tsx|jsx|ts|js)$' || return 1
      r=$(echo "$f" | sed -E 's#^(src/)?app/##; s#/page\.(tsx|jsx|ts|js)$##; s#^\.$##')
      ;;
    nextjs-pages)
      echo "$f" | grep -qE '(src/pages|^pages)/.*\.(tsx|jsx|ts|js)$' || return 1
      r=$(echo "$f" | sed -E 's#^(src/)?pages/##; s#\.(tsx|jsx|ts|js)$##; s#(^|/)index$##')
      ;;
    remix)
      echo "$f" | grep -qE '^app/routes/.*\.(tsx|jsx|ts|js)$' || return 1
      r=$(echo "$f" | sed -E 's#^app/routes/##; s#\.(tsx|jsx|ts|js)$##')
      [[ "$r" == "_index" ]] && r=""
      r=$(echo "$r" | sed 's#\.#/#g; s#\$\([a-zA-Z_]*\)#{\1}#g; s#_index$##')
      ;;
    sveltekit)
      echo "$f" | grep -qE '^src/routes/.*/?\+page\.svelte$' || return 1
      r=$(echo "$f" | sed -E 's#^src/routes/##; s#/?\+page\.svelte$##')
      ;;
    *) return 1 ;;
  esac
  r=$(echo "$r" | sed -E 's#\[([^]]+)\]#{\1}#g')
  echo "/${r}"
}

find_importing_pages() {
  local bn
  bn=$(basename "$1" | sed -E 's#\.(tsx|jsx|ts|js)$##')
  local pat
  case "$FW" in
    nextjs-app)   pat='page\.(tsx|jsx|ts|js)$' ;;
    sveltekit)    pat='\+page\.svelte$' ;;
    *)            pat='\.(tsx|jsx|ts|js)$' ;;
  esac
  grep -rlE "(import .* from .*${bn}|require\(.*${bn})" \
    --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js" --include="*.svelte" \
    . 2>/dev/null | grep -E "$pat" | sed 's#^\./##' || true
}

config_lookup() {
  [[ -f ".expect/config.yaml" ]] || return 0
  python3 -c "
import yaml, fnmatch
cfg = yaml.safe_load(open('.expect/config.yaml')) or {}
for pat, urls in (cfg.get('route_map') or {}).items():
    if fnmatch.fnmatch('$1', pat):
        for u in (urls if isinstance(urls, list) else [urls]): print(u)
" 2>/dev/null || true
}

declare -A ROUTES
UNMAPPED=()

for file in "${CHANGED[@]}"; do
  [[ -z "$file" ]] && continue
  echo "$file" | grep -qE '\.(lock|log|map|md|json|yaml|yml)$|node_modules/|\.git/|dist/|build/' && continue
  mapped=false

  while IFS= read -r url; do  # Level 3: config override (highest priority)
    [[ -n "$url" ]] && ROUTES["$url"]+="${file}"$'\n' && mapped=true
  done < <(config_lookup "$file")

  if url=$(file_to_url "$file" 2>/dev/null); then  # Level 1: direct page
    ROUTES["$url"]+="${file}"$'\n' && mapped=true
  fi

  if [[ "$mapped" == "false" ]]; then  # Level 2: imported component
    while IFS= read -r pf; do
      [[ -z "$pf" ]] && continue
      if pu=$(file_to_url "$pf" 2>/dev/null); then
        ROUTES["$pu"]+="${file}"$'\n' && mapped=true
      fi
    done < <(find_importing_pages "$file")
  fi

  [[ "$mapped" == "false" ]] && UNMAPPED+=("$file")
done

{
  echo "${FW}"
  for url in "${!ROUTES[@]}"; do
    echo "ROUTE:${url}"
    echo "${ROUTES[$url]}"
  done
  echo "UNMAPPED"
  printf '%s\n' "${UNMAPPED[@]}"
} | python3 -c "
import sys, json
lines = sys.stdin.read().strip().split('\n')
fw, routes, unmapped, cur = lines[0], {}, [], None
for line in lines[1:]:
    if line.startswith('ROUTE:'):
        cur = line[6:]
        routes[cur] = []
    elif line == 'UNMAPPED':
        cur = None
    elif line.strip():
        if cur is not None:
            if line.strip() not in routes[cur]: routes[cur].append(line.strip())
        else:
            unmapped.append(line.strip())
print(json.dumps({'framework': fw, 'routes': dict(sorted(routes.items())), 'unmapped': unmapped}, indent=2))
"
