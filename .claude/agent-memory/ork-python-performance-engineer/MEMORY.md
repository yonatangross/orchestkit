# OrchestKit Performance Engineer Memory

## Project Context
- Hook bundle stats live at: src/hooks/dist/bundle-stats.json
- Current total bundle: 527.1 KB across 12 split bundles
- Prompt bundle: 66 KB | Stop bundle: 44.3 KB | Posttool bundle: 64.4 KB

## Description Budget Math (CC session start)
- 17 user-invocable skills: ~2,387 chars total (avg 140 chars each)
- Effective 2% budget ceiling: ~16,000 chars
- Budget usage at baseline: ~14.9% (well within limits)
- Each new model-invocable skill adds ~150 chars on average

## Performance Baselines
- Hook pipeline: prompt dispatcher runs 4 hooks (was 5 before #960 skill-nudge removal)
- Stop dispatcher: 7 hooks run in parallel (fire-and-forget)
- Posttool dispatcher: 3 hooks with tool-name matcher filtering
- All stop hooks are async parallel — I/O cost absorbed into Promise.allSettled

## Confirmed Patterns
- skill-nudge was a regex match context producer in UserPromptSubmit — removal saves ~0.5ms/turn
- calibration-persist did load+decay+save file I/O at session end — removal saves ~50-100ms stop latency
- calibration-tracker was PostToolUse analytics — removal reduces posttool hook count
- Dead code deletions (~1,550 lines) have zero runtime impact; only affect bundle size at build time
