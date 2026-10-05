# Sections rail: a glyph page partial

A sticky list of the page's sections at the side. It marks the section you are in, shows how far down the page you are, and folds into a Sections button on a narrow screen. Use it on every page with 3 or more sections.

It is three plain files with no build step and no dependency, so any agent harness (Claude Code, Codex, Cursor, anything that writes HTML) can use it the same way:

| file | what | how it goes in the page |
|---|---|---|
| `rail.html` | the markup, with 3 sample entries | first thing in `<body>`; one `<li>` per section |
| `rail.css` | the styles | inline in a `<style>` block in `<head>` |
| `rail.js` | the behaviour | inline in a `<script>` block at the end of `<body>` |

Inline both files rather than linking them: a page opened from `file://`, or copied to another folder, keeps its rail.

## The contract

- One entry per section, in page order, numbered `01`, `02`, and so on. Every `href` names a real section id, and every section has an entry.
- The current section gets `aria-current="true"` and an accent bar. A live region announces it.
- The section you jump to stays marked even when the page ends before its top reaches the reading line (short last sections).
- `[` and `]` move between sections only while focus is inside the rail. There is no page-wide single-key shortcut (WCAG 2.1.4).
- A skip link is the first tab stop. The page's main element needs `id="pk-main"`.
- Under 1000 px the rail becomes a Sections button at the top that opens the list.
- Logical properties only: on a `dir="rtl"` page the rail sits on the right.
- Print hides the rail.

## Colours and fonts

`rail.css` reads these custom properties: `--bg --panel --chip --line --ink --muted --faint --accent --sans --mono`. It sets light defaults at zero specificity (`:where(:root)`), so any `:root` or `[data-theme]` block on the page wins. A page with a dark theme must set all ten in its dark block. The rail sizes itself `border-box`, so it lines up with the body padding whether or not the page resets `box-sizing`.

## Tests

`tests/unit/test-glyph-rail.mjs` runs `rail.js` against a fake DOM: 9 sections in an 800 px window, the last two shorter than the window. It checks the top, the page end, twelve `]` presses, one `[`, clicks on the last two sections, and that a key outside the rail does nothing. It also runs a weakened copy of `rail.js` to prove the checks can fail.

## Where it came from

The same rail ships in a page renderer used on a private estate, where it was approved against a written mockup and tested with the same harness. This folder is the shared copy, so that every harness draws the same rail.
