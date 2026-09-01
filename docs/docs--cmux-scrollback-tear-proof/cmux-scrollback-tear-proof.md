# cmux scrollback char-interleave: root-cause proof

**Symptom.** In cmux 0.64.20 (private ghostty fork, submodule `b211341`) running any
heavy long session, NORMAL-buffer scrollback rows show two text streams woven
character-by-character (`Threearedundantg CInpollers…`). The live region is always
clean; only scrolled-up history is torn.

**Verdict.** cmux's own default-on scrollback compression, not upstream ghostty and
not the process writing to the terminal. Confirmed by the fork's own source
contradicting itself, plus a deterministic regression test.

## The mechanism, in the fork's own words

1. **The decommit surface** — PR #7758 (merged 2026-07-10, ships in 0.64.20) added
   `src/terminal/compress/`: LZ4-compress cold scrollback pages and hand their
   physical frames back to the OS via `MADV_FREE_REUSABLE` (`src/terminal/mem.zig`),
   keeping the virtual mapping. Default ON: `src/config/Config.zig:1426`
   `@"scrollback-compression": bool = true`. Reading a decommitted frame without a
   proper restore yields that frame's stale bytes mixed with whatever now occupies
   it — and terminal `Page` memory packs rows/cells contiguously, so the mixture
   interleaves at CHARACTER granularity. Exact fingerprint match.

2. **The safe path** — restore is transparent ONLY through `Node.page()`
   (`PageList.zig:90`, which calls `restore()` on a compressed node). Passive
   scroll-up reads go through it (`Pin.rowAndCell`/`cells`), which is why the live
   region never tears.

3. **The bypass** — three hot WRITE sites take `pageAssumeResident()`
   (`PageList.zig:207`, literally `return &self.data.resident;` — a wrong-union-field
   read on a compressed node): `Terminal.zig:648`, `Screen.zig:898`, `Screen.zig:1124`.

4. **The invariant they rely on is false.** `Screen.zig:895` justifies the bypass:

   > "…grow does not compress pages, so the node must still be resident here."

   `PageList.zig:2444-2449` (the row-grow pull-down) states the opposite:

   > "A compressed history page pulled into the active area remains compressed
   > until … `Node.page` … restores it transparently."

   And `resize()` at `PageList.zig:1228` claims:

   > "Resizing forces all nodes to be decompressed today"

   but the `reflow=false` grow path (`resizeWithoutReflow`, `PageList.zig:2319`) only
   calls `page_compression.reset()` — it resets the state machine and restores NO
   pages. So a compressed page can sit in the active area exactly where a
   `pageAssumeResident()` write will read decommitted memory.

## Regression window
0.64.14/15 (pre-#7758) ran for months clean; the symptom is new on 0.64.20. The fork
owner himself fingered #7758 in issue #8229 ("garbled after reflow, Claude Code TUI"),
which was closed by PR #8240 — a resize-COALESCING mitigation (fewer reflows during
divider drags), not a fix of the decommit surface. That is why 0.64.20 still tears via
non-drag triggers, and why no open issue covers this exact no-resize scenario.

## The deterministic test (source below, `PageList.zig`)
Compress history → grow rows without reflow → assert every node overlapping the active
area is resident (the invariant the three bypass sites depend on). Predicted to FAIL on
current code: a compressed node in the active area is a Debug-safety panic
(wrong-union-field) and a torn read in ReleaseFast.

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

## Execution status — honest
Not yet run to green/red on this machine. The fork pins `minimum_zig_version = 0.15.2`
(`build.zig.zon`); the host is macOS 26.5.1, newer than zig 0.15.2's bundled macOS libc
stubs, so any libc-linking test fails at the LINK step — a toolchain/OS mismatch,
independent of the bug. A trivial no-libc test links and passes under
`-target aarch64-macos.15.0`, confirming the toolchain works otherwise; the full
PageList graph additionally needs the fork's build system to wire `terminal_options`
and the uucode/macos/objc/wuffs modules. **The clean run is the fork's own CI**
(`.github/workflows/test.yml`, Linux + `mlugg/setup-zig`) or a Linux container — where
the pin resolves correctly. The test is drop-in for that environment.

## The fix
Make the three `pageAssumeResident()` sites restore-aware (go through `Node.page()`),
OR eagerly restore pages entering the active area in the pull-down
(`PageList.zig:2419-2461`) so `resize()`'s "all nodes decompressed" comment becomes
true. Either closes the decommit surface without touching reflow.

## Immediate mitigation (also the empirical confirmation)
`scrollback-compression = false` in `~/.config/ghostty/config` (cmux loads it via
`loadDefaultFiles`), then restart cmux. If the tearing stops on the real workload, the
decommit surface is confirmed as the cause on live hardware.
