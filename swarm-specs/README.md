# `swarm-specs/` — cross-repo migration specs

Input directory for `/ork:swarm-migrate`. Each spec is a YAML file describing a
transformation to fan out across repositories, optionally paired with a
`.pr.md` body file.

- **`examples/`** — starter specs you can copy and adapt:
  - `codeowners-quarterly-stamp.{yaml,pr.md}`
  - `v1-deploy-workflow-rollout.{yaml,pr.md}`

## Convention path

The `swarm-migrate` skill declares `swarm-specs/**/*.yaml` as a trigger glob in
its frontmatter and documents `swarm-specs/<name>.yaml` as the canonical spec
location (see `src/skills/swarm-migrate/SKILL.md`). Real specs live at the top
level of this dir; `examples/` holds the reference set. Keep the directory name.
