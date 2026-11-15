/**
 * The replay's state machine, free of the DOM so it can be tested with a fake
 * clock. One run announces itself once: `onFinish` fires exactly once per run,
 * whether the run ended by typing out or by "Skip to end".
 */
export type PlayerState = "idle" | "playing" | "paused" | "finished";

export type PlayerOptions = {
  total: number;
  lineDelayMs: number;
  /** Schedules `fn` after `ms`; returns a cancel function. */
  later: (fn: () => void, ms: number) => () => void;
  /** Show line `index` (0 based). `typed` is false when skipping. */
  show: (index: number, typed: boolean) => void;
  /** Clear every line before a replay. */
  reset: () => void;
  onFinish: () => void;
  onState?: (state: PlayerState) => void;
};

export function createRunPlayer(opts: PlayerOptions) {
  let state: PlayerState = "idle";
  let next = 0;
  let cancel: (() => void) | null = null;

  const set = (s: PlayerState) => {
    state = s;
    opts.onState?.(s);
  };

  const finish = () => {
    cancel?.();
    cancel = null;
    if (state === "finished") return;
    set("finished");
    opts.onFinish();
  };

  const step = () => {
    cancel = null;
    if (state !== "playing") return;
    if (next >= opts.total) {
      finish();
      return;
    }
    opts.show(next, true);
    next += 1;
    cancel = opts.later(step, opts.lineDelayMs);
  };

  return {
    get state() {
      return state;
    },
    /** Begin the first run, or resume a paused one. No-op while playing. */
    start() {
      if (state === "playing" || state === "finished") return;
      set("playing");
      step();
    },
    pause() {
      if (state !== "playing") return;
      cancel?.();
      cancel = null;
      set("paused");
    },
    /**
     * First run: lines before `index` are already on screen (the static ones),
     * so typing continues from `index` and nothing is cleared.
     */
    startFrom(index: number) {
      if (state !== "idle") return;
      next = Math.min(Math.max(index, 0), opts.total);
      set("playing");
      step();
    },
    replay() {
      cancel?.();
      cancel = null;
      opts.reset();
      next = 0;
      set("playing");
      step();
    },
    skip() {
      if (state === "finished") return;
      cancel?.();
      cancel = null;
      for (; next < opts.total; next += 1) opts.show(next, false);
      finish();
    },
    /** Reduced motion or no animation: the finished state at once, silently. */
    showFinished() {
      for (let i = 0; i < opts.total; i += 1) opts.show(i, false);
      next = opts.total;
      state = "finished";
      opts.onState?.("finished");
    },
  };
}
