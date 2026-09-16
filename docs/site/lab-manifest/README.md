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
3. Run `npm run build` (or any docs/site npm build/dev/test script). It
   regenerates `docs/site/lib/generated/lab-data.ts` (not committed, #4185)
   and copies the page to `docs/site/public/lab/<slug>.html`. Commit the
   fragment and the `public/lab/` copy.
4. Link `https://orchestkit.yonyon.ai/lab/<slug>.html` in the PR body.

Removing a playground is the reverse: delete the fragment, run
`npm run build` (it deletes the `public/lab` copy), commit.

## Generated outputs

`docs/site/lib/generated/lab-data.ts` and `docs/site/public/lab/` are a pure
function of the fragments plus the page bytes. `npm run build` regenerates
them; the `public/lab/` copies are committed and CI diffs them for drift on
every PR head, while `lab-data.ts` is gitignored (#4185) and rebuilt by
docs/site's prebuild/predev/pretest steps and the root build, so a rebase
cannot conflict on it. `node docs/site/scripts/lab-manifest.mjs --check` runs
the set check on top: the aggregate exists (an absent file fails, it is never
treated as empty), every fragment is in `lab-data.ts` and in `public/lab/`,
nothing is in either without a fragment, and the legacy single file has not
been resurrected.

`lab-data.ts` is sorted by slug with one entry per line. Newest-first is the
gallery's job, applied at render time.

## The aggregate is a build artifact, not a merge product

Because `lab-data.ts` is not committed, two PRs adding entries (even slugs
adjacent in slug order) cannot conflict on it: the fragments and the
`public/lab/` copies are separate files that merge cleanly, and the next
build writes the complete aggregate from the merged fragments. There is
nothing to hand-resolve. If `--check` reports the aggregate absent or stale,
run the generator; never edit it by hand.

A branch opened before 2026-09-11 that still edits `docs/site/lab-manifest.json`
fails the build with a message naming this directory. Move its entry into a
fragment here and delete the legacy file.
