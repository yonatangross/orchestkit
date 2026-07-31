# i18n and Date Patterns Skill: OrchestKit Delta

Ork-specific house decisions and working config for `src/skills/i18n-date-patterns`.
Vendor mechanics (the full ICU MessageFormat grammar, the react-i18next `<Trans>` API
surface, per-locale CLDR plural category tables) are deliberately not restated here.
See "Upstream coverage (do not restate)" in SKILL.md for the first-party source that
owns each removed topic. The house subset of the ICU plural and `<Trans>` rules did
not move: it still lives in `rules/i18n-icu-plurals.md` and `rules/i18n-trans-component.md`.

## Load ICU support through the i18next-icu plugin, not i18next suffix keys
Why: House config, distilled from the retired `icu-messageformat.md`, which
pinned `i18next-icu v2.4.1` as the runtime that parses these messages; no traced incident.
This matters because everything else in the skill assumes ICU syntax is live: every
`{count, plural, ...}` string in `rules/i18n-icu-plurals.md`, the `=0` zero states in
`checklists/i18n-checklist.md`, and the plural example in `examples/component-i18n-example.md`
are inert text under a plain i18next install, which resolves plurals through `_one` / `_other`
key suffixes instead. Suffix keys also cannot express Hebrew's dual or Arabic's six
categories, which is the reason this skill chose ICU in the first place (SKILL.md
"Key Decisions", Message Format row).
Upstream: https://github.com/i18next/i18next-icu

## Write money inside an ICU message as the ILS currency skeleton
Why: House currency decision. `rules/i18n-formatting-antipatterns.md` bans a literal
shekel sign in JSX and routes code-side money through `formatILS()` from `useFormatting`
(`references/formatting-utilities.md`). The retired `icu-messageformat.md`
carried the matching in-message form, `{amount, number, ::currency/ILS}`, and it is the
only variant that keeps the two paths agreeing: a bare `{amount, number}` inside a message
formats the digits and silently drops the currency, which pushes the author straight back
to concatenating the symbol the rule forbids. Distilled from the retired file; no traced
incident.
Upstream: https://unicode-org.github.io/icu/userguide/format_parse/numbers/skeletons.html

## Keep ICU plural branches inside the Trans i18nKey and map each tag once
Why: Ordering constraint recovered from the retired `trans-component.md`;
no traced incident. When a message is both pluralized and rich, ICU picks the plural
branch first and `<Trans>` maps component tags afterwards, so every branch of the message
has to repeat the same tag names (`<bold>` in the `=0`, `one` and `other` arms alike) and
`count` has to arrive via `values`, not as a prop. One `components` map then covers all
branches. The tempting alternative, choosing the plural in JSX and wrapping each outcome
in its own `<Trans>`, re-creates exactly the split-sentence word-order break that
`rules/i18n-trans-component.md` exists to stop in RTL locales.
Upstream: https://react.i18next.com/latest/trans-component

## Format a standalone ordinal with formatOrdinal, not a hand-written selectordinal ladder
Why: House decision recorded in SKILL.md's Quick Reference and in
`references/formatting-utilities.md`: ordinals come from `formatOrdinal()` in
`useFormatting`, which reads the app's current locale, the same way `formatList` and
`formatNumber` do. The retired `icu-messageformat.md` taught the alternative,
`{position, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}`, whose `st`/`nd`/`rd`/`th`
suffixes are hardcoded English and go wrong the moment the app renders `he`. Reach for
`selectordinal` only when the ordinal sits inside a translated sentence, and then write the
suffix branches separately in each locale file. Distilled from the retired file; no traced
incident.
Upstream: https://formatjs.github.io/docs/core-concepts/icu-syntax/
