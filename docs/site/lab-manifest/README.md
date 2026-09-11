# Lab manifest: one fragment per entry

Every playground published to the Lab (`/docs/showcase/lab`, served from
`/lab/<slug>.html`) is declared by exactly one file in this directory:

```
docs/site/lab-manifest/<slug>.json
```

The file name is the slug. One entry per file, one file per PR. Two PRs that
each add a playground touch two different files and cannot conflict here.
This replaced the single `docs/site/lab-manifest.json` on 2026-09-11 (#4049),
after five rebase conflicts on that one file in a single lane, each of which
invited a `--theirs` that silently dropped an entry while the count still
looked right.

## Fragment shape

```json
{
  "slug": "the-if-key-that-never-was",
  "source": "docs/fix--4060-hooks-if-keys/the-if-key-that-never-was.html",
  "title": "The if key that never was",
  "description": "One sentence a reader can act on.",
  "tags": ["hooks", "cc", "schema"],
  "date": "2026-09-11"
}
```

| key           | required | notes                                                       |
| ------------- | -------- | ----------------------------------------------------------- |
| `slug`        | yes      | must equal the file name stem, kebab-case                   |
| `source`      | yes      | repo-relative path to the page, must end in `.html`         |
| `date`        | yes      | `YYYY-MM-DD`, the gallery sorts newest first at render time |
| `title`       | no       | falls back to the page `<title>`                            |
| `description` | no       | falls back to `<meta name="description">`                   |
| `tags`        | no       | array of strings                                            |
| `featured`    | no       | boolean                                                     |
| `caseStudy`   | no       | route of a long-form write-up                               |

Any other key is rejected, so a typo (`tag` for `tags`) fails the build
instead of silently publishing an untagged entry.

## Adding a playground

1. Commit the page under `docs/<branch-slug>/` (branch `fix/123-x` is
   `docs/fix--123-x/`).
2. Add `docs/site/lab-manifest/<slug>.json` pointing at it.
3. Run `npm run build`. It regenerates `docs/site/lib/generated/lab-data.ts`
   and copies the page to `docs/site/public/lab/<slug>.html`. Commit all three.
4. Link `https://orchestkit.yonyon.ai/lab/<slug>.html` in the PR body.

Removing a playground is the reverse: delete the fragment, run
`npm run build` (it deletes the `public/lab` copy), commit.

## Generated outputs

`docs/site/lib/generated/lab-data.ts` and `docs/site/public/lab/` are a pure
function of the fragments plus the page bytes. `npm run build` regenerates
them, CI rebuilds them on every PR head and fails on any byte of drift, and
`node docs/site/scripts/lab-manifest.mjs --check` runs the set check on top:
every fragment is in `lab-data.ts` and in `public/lab/`, nothing is in either
without a fragment, and the legacy single file has not been resurrected.

`lab-data.ts` is sorted by slug with one entry per line. That is what lets two
PRs adding two entries merge textually: they change two different lines.
Newest-first is the gallery's job, applied at render time. Sorting the file by
date would put every same-day addition into the same gap and conflict again.

## The merge rule: regenerate, never hand-resolve

Two slugs that happen to be adjacent in slug order with no entry between them
still conflict textually on `lab-data.ts`. When that happens:

```bash
git checkout --theirs -- docs/site/lib/generated/lab-data.ts   # or --ours; it does not matter
npm run build
git add -A && git commit
```

Either side is fine because the generated file is not the source. The two
fragments merged clean, so the rebuild produces the complete set. Never edit
the conflict markers by hand, and never trust a count: the `--check` step in
CI names any slug that went missing.

A branch opened before 2026-09-11 that still edits `docs/site/lab-manifest.json`
fails the build with a message naming this directory. Move its entry into a
fragment here and delete the legacy file.
