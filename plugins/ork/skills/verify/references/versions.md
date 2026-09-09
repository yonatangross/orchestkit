# verify version history

**Version:** 4.7.0 (August 2026) — Phase 3 evidence gate became executable (#3263): tests redirect to a named log, `scripts/assert-evidence.sh` names one of five outcomes, and COULD-NOT-OBSERVE joined the manifest as a blocking state. A verdict skill can no longer end without a verdict: an empty run is a named failure, not silence
**Version:** 4.6.0 (July 2026) — Added the Reachability Proof (REACHED vs UNREACHED): the manifest's second axis. Provenance grades who ran a claim; reachability grades whether the green means anything. A test the diff added that has never been seen to fail caps the verdict below READY FOR MERGE
**Version:** 4.5.0 (July 2026) — Added the Verification Manifest (VERIFIED vs CLAIMED) — a load-bearing-claim provenance ledger that caps the verdict below READY FOR MERGE until unverified claims are re-run or waived
**Version:** 4.4.0 (June 2026) — Added `--streak=N` consecutive-pass gate (#2540)
