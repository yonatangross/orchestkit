# Documentation Specialist Memory

## Count Consistency Patterns

### Correct Counts (v6.0.3)
- 199 skills (24 commands + 175 reference)
- 36 agents
- 119 hooks (91 global + 22 agent + 6 skill-scoped)
- 3 plugins: orkl (88 skills), ork-creative (16 skills + 1 agent), ork (199 skills)

### Files That Carry Count References
These files must be checked when counts change:
1. `README.md` - "What You Get" table, Install Options section, What's New section
2. `CLAUDE.md` - Overview, Skill Types table, Version section
3. `CONTRIBUTING.md` - Project Structure section, manifest descriptions
4. `CHANGELOG.md` - Historical entries (only fix current/unreleased, not past versions)
5. `src/skills/doctor/SKILL.md` - orkl/ork output examples
6. `src/skills/doctor/references/skills-validation.md` - Skill Types table
7. `src/skills/content-type-recipes/references/plugin-demo-recipe.md` - Status bar content with version
8. `tests/skills/structure/test-skill-md.sh` - EXPECTED_USER_INVOCABLE and EXPECTED_INTERNAL constants
9. `pyproject.toml` - Version and description string
10. `plugins/` - GENERATED, never edit (rebuilt from src/)

### Lesson Learned
- Count drift is the #1 consistency bug in this project
- Always grep for old counts after any skill/hook/agent addition/removal
- `plugins/` files mirror `src/` after build -- only fix `src/` files
- CHANGELOG historical entries (e.g., `## [6.0.2]`) are version headers and must NOT be updated
- Test fixture files (e.g., test-build-marketplace-sync.sh) use synthetic counts for test scenarios, not real project counts
