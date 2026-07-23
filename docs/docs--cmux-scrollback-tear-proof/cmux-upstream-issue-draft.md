# Draft issue for manaflow-ai/cmux

**Title:** Scrollback tears into character-interleaved rows on long sessions — compressed page pulled into active area is read via `pageAssumeResident`

**Labels:** bug, terminal, scrollback-compression

---

## Summary

On cmux 0.64.20, long heavy-output sessions produce NORMAL-buffer scrollback rows where two text streams are interleaved **character by character** within a single row (e.g. `Threearedundantg CInpollers,wnotpytest…`). The live region is always correct; only scrolled-up history is torn, and it is unrepairable (Ctrl+L redraws only the visible screen).

This is the scrollback-compression decommit surface (PR #7758), reached through a path that #8229 / PR #8240 did **not** close: grow-rows-without-reflow, no resize trigger required.

## Root cause

`scrollback-compression` (default `true` since #7758) compresses cold pages and decommits their physical memory via `MADV_FREE_REUSABLE` (`src/terminal/mem.zig`), keeping the virtual mapping. Restore is transparent **only** through `Node.page()` (`PageList.zig`). Three hot write paths bypass it with `pageAssumeResident()` (`= &self.data.resident`, a wrong-union-field read on a compressed node): `Terminal.zig:648`, `Screen.zig:898`, `Screen.zig:1124`.

The invariant those sites rely on is false. `Screen.zig:895`:

> "…grow does not compress pages, so the node must still be resident here."

But `resizeWithoutReflow`'s row-grow pull-down (`PageList.zig` ~2444) states the opposite:

> "A compressed history page pulled into the active area remains compressed until … `Node.page` … restores it."

And `resize()` (`PageList.zig:1228`) claims:

> "Resizing forces all nodes to be decompressed today"

yet the `reflow=false` path only calls `page_compression.reset()` and restores no pages. So a compressed page can sit in the active area exactly where a `pageAssumeResident()` write reads decommitted memory → torn read in ReleaseFast, character-interleaved because `Page` memory packs rows/cells contiguously.

## Deterministic reproduction

A failing `libghostty-vt` test (compress history → grow rows without reflow → assert every active-area node is resident):

```zig
test "PageList grow pulls compressed page into active area still compressed" {
    const testing = std.testing;
    var s = try init(testing.allocator, 80, 24, null);
    defer s.deinit();
    try s.growColdPagesForTest(3);

    try testing.expectEqual(IncrementalCompressionResult.complete, s.compress(.drain));
    var compressed_before: usize = 0;
    { var it = s.pages.first; while (it) |n| : (it = n.next) if (n.isCompressed()) { compressed_before += 1; }; }
    try testing.expect(compressed_before > 0);

    try s.resize(.{ .rows = 24 + 200, .reflow = false });

    var node: ?*Node = s.getTopLeft(.active).node;
    while (node) |n| : (node = n.next) try testing.expect(!n.isCompressed());
}
```

Run: `zig build test-lib-vt -Dtest-filter="pulls compressed page into active area"`

Result on 0.64.20 HEAD:
```
error: '…grow pulls compressed page into active area still compressed' failed
    try testing.expect(!n.isCompressed());   PageList.zig:6575
Build Summary: 53/55 tests passed; 2 failed
```
Every other terminal-library test passes; only the tripwire fails.

## Regression window

0.64.14/15 (pre-#7758) ran clean for months; the symptom is new on 0.64.20. #8229 (same class, reflow-triggered, "Claude Code TUI") was closed by #8240 — a resize-coalescing mitigation, not a fix of the decommit surface — which is why non-drag triggers like this one still tear.

## Suggested fix

Restore any compressed page overlapping the active area at the end of `resizeWithoutReflow` (make the `resize()` "all nodes decompressed" comment true), OR make the three `pageAssumeResident()` sites restore-aware via `Node.page()`. The former is one loop; a candidate patch + the test above are attached.

## Workaround

`scrollback-compression = false` in the ghostty config disables the whole decommit surface and stops the tearing.

---

*Environment: cmux 0.64.20, macOS 26.5.1, Claude Code 2.1.218 (inline renderer). Proof reproduced in a Linux container with the fork's pinned zig 0.15.2.*
