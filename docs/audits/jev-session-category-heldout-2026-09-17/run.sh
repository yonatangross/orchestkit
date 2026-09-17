#!/bin/bash
# Held-out runs for the session category eval. Row files (heldout-150*.jsonl) hold private
# prompt text and are NOT committed; produce them locally with export_heldout.py.
# Usage: run.sh jev | haiku [limit]
#   jev    needs the TypeSafe key variable ORK_TYPESAFE_API_KEY exported in your shell.
#   haiku  needs a logged-in `claude` CLI (one `claude -p --model haiku` call per row).
set -u
D="$(cd "$(dirname "$0")" && pwd)"
case "${1:-}" in
  jev)   [ -n "${ORK_TYPESAFE_API_KEY:-}" ] || { echo "export ORK_TYPESAFE_API_KEY first"; exit 3; }
         node "$D/run_jev_b.mjs" ;;
  haiku) node "$D/run_haiku_b.mjs" "${2:-}" ;;
  *)     echo "usage: run.sh jev|haiku [limit]"; exit 2 ;;
esac
