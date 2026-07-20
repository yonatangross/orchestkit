# cmux team layout

`cmux.json` defines the "OrchestKit Dev Rig" workspace: a plain shell at repo root (bring your own operator or CC session, nothing auto-launches an LLM), an `npm run build` pane that assembles `plugins/` from source (this repo uses npm and has no local dev server, so build is the iterate step), and a browser surface on https://orchestkit.vercel.app (the deployed docs site).
One command, from the repo root: `cmux workspace create --name "OrchestKit Dev" --cwd "$PWD" --layout "$(jq -c '.commands[0].workspace.layout' .cmux/cmux.json)"` (or open the repo in cmux and pick "OrchestKit Dev Rig" from the Command Palette).
Warning: cmux shows a trust gate the first time it loads a checkout's project-local config; approve it once per clone.
Never put secrets in this directory. It is committed and travels with the repo; runtime secrets stay outside the repo.
