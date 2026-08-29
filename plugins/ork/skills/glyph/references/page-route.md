# Glyph page route: the full contract

`SKILL.md` carries the six normative rules. This file carries the detail behind them, in the order the route runs.

## 1. The house kit comes first

Before writing a single line of HTML, check whether the repo already owns a playground pipeline. A repo that does will also have a CI gate on it, and an earlier version of this route hand-wrote three pages that all failed that gate.

```bash
ls docs/playgrounds/_kit/base.css 2>/dev/null && echo "HOUSE KIT: use it"
```

If a kit exists, the whole page route is the repo's own commands, typically a scaffold script that pre-wires the metadata comment the gate reads, a dated filename, and a link to the shared stylesheet; a verify script that must pass; and an index refresh. Then:

- write NO new CSS: use the kit's classes (cards, meters, pills, flows, callouts);
- keep any metadata comment the gate reads, with the category equal to the directory name;
- follow the kit's theme (a dark house default is common) rather than arguing for light;
- localized twins are siblings produced by the kit, never a separate design.

Only when the kit is absent does `templates/explainer.html` in this skill apply. It is a self-contained baseline plus authoring rules, not a skeleton to fill in.

## 2. Where a page lands (no kit)

| Topic is about | Write to |
|---|---|
| how we build / ship / test | `docs/playgrounds/dev/<slug>-explainer.html` |
| servers, CI, deploys, cost | `docs/playgrounds/infra/<slug>-explainer.html` |
| a named client or prospect | `clients/<clientSlug>/playgrounds/<slug>-explainer.html` |
| the business, money, billing | `docs/playgrounds/ops/<slug>-explainer.html` |
| design, UI, brand | `docs/playgrounds/design/<slug>-explainer.html` |
| marketing, content, social | `docs/playgrounds/marketing/<slug>-explainer.html` |

Slug is kebab-case from the topic. If a topic straddles two rows (a CI pipeline is both "how we ship" and "servers"), prefer `dev` when the reader cares about the process and `infra` when they care about the machines.

**Do not copy another skill's anchor table.** A table is not the territory: a root listed somewhere may not exist on disk. `ls -d` the root before writing; if it is missing, fall back to `docs/playgrounds/dev/` and say plainly that you re-routed.

## 3. Quality bar for a novice page (normative)

`test-cases.json` asserts against this list and `templates/explainer.html` points at it rather than restating it. Two copies drift, and they already did once.

- **Draw the actual thing.** A queue looks like a queue, a backlog like a pile. A row of generic rectangles joined by arrows draws the shape of the idea instead of the idea and teaches nothing the sentence did not already say.
- **Analogy before mechanism.** Say what it is like, then what it is.
- **Every beat ends in a consequence AND a do-nothing line.** A picture of a gate with lamps is not an explanation until the reader knows what happens and what happens if nothing is done. Two side-by-side cards under the drawing, "What it means" and "If we do nothing" (the second styled as a warning), ≤ 12 words each, in the reader's terms.
- **≤ 20 words per beat** (the two consequence lines are extra), 4 to 6 beats total. More than six means split the topic.
- **One idea per beat**, and the visual carries it, not the caption.
- **If the topic IS a decision, the page carries the controls.** One decision block per fork: radio group, consequence column beside each option, checkboxes for the follow-ups the pick unlocks. ONE sticky bottom answer bar collects every block into a fixed-width `key: value` summary the agent can parse, reports `N/M chosen`, and keeps "copy my answers" DISABLED until every block has a pick, so a half-answered page cannot be pasted back as if complete. Clipboard needs a select-and-Cmd+C fallback (`navigator.clipboard` is denied in some contexts). A page that only pictures the options is a poster; the decision still happens somewhere else, which defeats the page. Source the controls from a component library or house kit when one is reachable; the template's built-in block is the floor so every decision page looks the same, not the ceiling.
- **Plain words inside the diagram too.** Visual labels are where insider language leaks most: check names, branch names and service names as chart labels are a FAIL for a novice page.
- **No leftover template markers.** The baseline ships bare `TITLE` / `DATE`; none may survive into the emitted file.
- **Light theme**, deliberately: this is usually read by someone outside the team.
- **Self-contained**: opens from `file://`, zero network references. Inline SVG, not a CDN-loaded diagram library.
- **No em-dash characters** in the emitted page; several house verify scripts grep for them.

## 4. Not done until you have looked at it

Operator feedback, three rounds in one evening across four pages ("how didn't you verify it yourself, as part of glyph"). These are normative for every page route.

1. **Screenshot and read the pixels before claiming done.** Verify scripts, SVG counts and DOM probes are blind to layout and collision defects; a numeric gate that passes is not a render that looks right. Serve the page via portless (`portless alias <name> <port>` in front of a static server; URL `https://<name>.localhost/...`, never a `:port`), open it with `agent-browser --cdp <port> --no-pin-tab` (a pinned session dies with `tab_gone` after tab churn), take viewport screenshots at several scroll positions, and READ the images. Not computer-use. Never open `file://` in the operator's live browser window with a forced viewport: it lands as a squished window on their screen. If no browser path works from your session, hand the URL to a peer with one and wait for the measured verdict; do not report done on a page you have not seen.
2. **Two CDP traps.** (a) `screenshot --full` over CDP can stitch a tile mosaic (hero repeated per tile, sticky bars stamped into each) rather than one page; take viewport shots at scroll positions instead. (b) with `--no-pin-tab`, a later `eval` or `screenshot` targets whatever tab is ACTIVE in that Chrome; after `open`, re-target explicitly or verify the page title in the result before trusting a capture. A PASS on the wrong page is the worst false positive of all.
3. **RTL in SVG.** Under `dir=rtl`, SVG `<text>` runs RTL from its anchor with no bidi isolation: Hebrew phrases, punctuation AND digit groups flip or spill. Hebrew goes in HTML captions, never SVG text. Numbers that must stay in-SVG use `text-anchor="middle" direction="ltr"`. Single-word Hebrew labels survive only while they stay single words, center-anchored, with a warning comment beside them.
4. **What "richer than prose" meant when it was accepted.** Semantic emoji in tab labels, headings, card titles and list leads; a KPI strip under the hero; a sticky tab bar with hash routing when the page has more than one view; several real diagrams per page. Hex colors only inside any diagram library's class definitions (hsl is a known bug in one of them). Never inline a multi-megabyte diagram bundle; it hung a renderer and read as "broken".
5. **Kit markup gotchas seen in the wild.** A meter is `span.name / div.track > div.fill / span.val`; a `<span><i><b>` shape renders no bar. Keep `.val` strings short. A pill is a TAG, not a form control: radios, checkboxes and buttons need real control markup or the page reads as "ugly and broken".

## 5. Reference pages that passed all rounds

- `docs/playgrounds/dev/cc-latest-capitalize-2026-08-29.html` in OrchestKit: KPI strip, six beats with inline SVG, three decision beats, sticky answer bar; corrected twice from screenshots (label collision, clipped annotations) before it was called done.
- The route was built on 2026-08-22 and rebuilt by hand the same night after the operator rejected a pictures-only version ("not explaining good enough"): the pictures read, the reader still did not know what to DO. That is why the consequence cards and the decision beat are mandatory, not decorative.
