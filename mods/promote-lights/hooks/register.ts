/**
 * Promote Lights - Function Hooks registration.
 *
 * Hooks registered:
 * - session.start
 * - turn.complete
 * - command.run{command=lights} (declared with $.command.register at session start)
 * - ui.render { component: 'AbovePrompt' }
 *
 * Calls:
 * - $.process.run (gh commands)
 * - $.session.repo
 * - $.clock.every (60s tick)
 * - $.store.get/set
 * - $.ui.status (startup warnings; cleared once the band draws)
 * - $.ui.invalidate
 * - $.ui.resolve (the band's Box and Text elements)
 * - $.env.get (PROMOTE_HEAD override, PROMOTE_LIGHTS_WATCH demo target)
 *
 * Two tracking modes share one tick:
 * - promote: the open promote PR (base main, dev head or promote label) in
 *   the session repo. An empty required-context union refuses green.
 * - watch: any open PR in any repo, named with `/lights watch owner/repo#N`
 *   or PROMOTE_LIGHTS_WATCH. An unprotected repo falls back to every check
 *   run on the head, so the lights can be shown without a live promote PR.
 */

import { matchAndClassify, isPassing, type ClassifiedLight } from "../src/classify.js";
import { computeRequiredUnion } from "../src/required.js";
import { parsePRList, parsePRView, parseCheckRuns, isPromotePR, DEFAULT_PROMOTE_HEAD, buildHeadQueryArgs, buildLabelQueryArgs, mergePRLists } from "../src/gh.js";
import { buildStatusLine, buildBand, buildErrorBand, type Elements } from "../src/pane.js";
import {
  parseWatchTarget,
  formatWatchTarget,
  allCheckNames,
  WATCH_USAGE,
  NO_PR_HINT,
  type WatchTarget,
} from "../src/watch.js";

/**
 * Minimal $ facade for the calls this module uses, mirroring the
 * lesson-cards mod: hooks are typed locally so the mod typechecks with
 * only its own devDependencies installed.
 */
type Hook$ = {
  session: {
    repo: () => Promise<{ owner: string; name: string } | null>;
  };
  process: {
    run: (
      argv: readonly string[],
      init?: { timeoutMs?: number }
    ) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  };
  clock: {
    // CC 2.1.282 hands back { cancel } only; there is no dispose.
    every: (ms: number, fn: () => void) => { cancel: () => void };
  };
  store: {
    get: (key: string) => Promise<StoredLights | null>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  env: {
    get: (key: string) => Promise<string | undefined>;
  };
  ui: {
    /** undefined clears the line. */
    status: (line: string | undefined) => Promise<void>;
    invalidate: (component: string) => void;
    resolve: (e: HookEvent) => Promise<Elements>;
  };
  command: {
    register: (spec: { name: string; description: string; argumentHint?: string }) => Promise<unknown>;
  };
};

type Matcher = Record<string, unknown>;

type HookEvent = {
  name?: string;
  args?: string;
  component?: string;
  [key: string]: unknown;
};

type NextFn = (ev?: HookEvent) => Promise<Record<string, unknown> | undefined>;

type On = (
  event: string,
  matcher: Matcher,
  handler: ($: Hook$, e: HookEvent, next: NextFn) => unknown
) => void;

export type Register = (on: On) => void;

/** Shape stored under lights:<owner>/<repo> (the SESSION repo, in both modes). */
type StoredLights = {
  prNumber?: number;
  head?: string;
  label?: string;
  mode?: "promote" | "watch";
  lights?: ClassifiedLight[];
  mergeStateStatus?: string;
  hold?: boolean;
  /** True when the promote search ran on one query instead of two. */
  degraded?: boolean;
  passing?: boolean;
  error?: string;
  /** The token of the session that wrote this entry (see sessionToken). */
  session?: string;
  [key: string]: unknown;
};

/** The PR the tick follows: which repo to ask gh about, and which head. */
type Tracked = {
  owner: string;
  repo: string;
  number: number;
  head: string;
  mode: "promote" | "watch";
  /** Branch whose protection names the required checks: main for a promote, the PR's own base for a watch. */
  base: string;
  /** True when the promote search ran on one query instead of two. */
  degraded: boolean;
};

// Module state
let ticking = false;
let tickInterval: { cancel: () => void } | null = null;
let tracked: Tracked | null = null;

const TICK_MS = 60000;

/**
 * One token per loaded module, so per Claude Code process. $.store outlives
 * the process, and ui.render can run BEFORE session.start clears the key
 * (measured on 2.1.283: a new session drew the previous session's lights
 * for about 3 s). Every write carries this token and every read ignores an
 * entry with any other token, so a stale entry is never drawn.
 */
function newToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Rotated at every session.start, so a /clear inside one process starts clean too. */
let sessionToken = newToken();

/** The current token (tests seed entries with it). */
export function currentSessionToken(): string {
  return sessionToken;
}

/** Tag an entry as written by this process. */
function stamp<T extends object>(value: T): T & { session: string } {
  return { ...value, session: sessionToken };
}

/** The stored entry only when this process wrote it; anything else reads as nothing. */
function own(stored: StoredLights | null): StoredLights | null {
  return stored && stored.session === sessionToken ? stored : null;
}

/**
 * Store key: the session repo plus this session's token. Per repo alone, two
 * live sessions on the same repo shared one key, and each write blanked the
 * other session's band until its next tick.
 */
function keyFor(repo: { owner: string; name: string } | null, token: string = sessionToken): string {
  const base = repo ? `lights:${repo.owner}/${repo.name}` : "lights:_session";
  return `${base}:${token}`;
}

function labelFor(t: Tracked): string {
  return t.mode === "watch"
    ? `watch ${formatWatchTarget({ owner: t.owner, repo: t.repo, number: t.number })}`
    : `promote #${t.number}`;
}

function prViewArgv(t: { owner: string; repo: string; number: number }): string[] {
  return [
    "gh",
    "pr",
    "view",
    String(t.number),
    "--json",
    "headRefOid,state,mergeStateStatus,baseRefName",
    "-R",
    `${t.owner}/${t.repo}`,
  ];
}

export const register: Register = (on) => {
  on("session.start", {}, async ($, e, next) => {
    // Rotate first, before any await: from here on nothing this process
    // stored for the previous session (a /clear) can be read or drawn.
    const previousToken = sessionToken;
    sessionToken = newToken();
    await $.command.register({
      name: "lights",
      description: "CI lights for the open promote PR, or any PR with /lights watch",
      argumentHint: "[off|refresh|watch owner/repo#N]",
    });
    const repo = await $.session.repo();
    const key = keyFor(repo);

    // $.store outlives the session: drop what this process stored under its
    // previous token (a /clear), so no orphan is left behind. Entries of
    // other processes live under their own keys and are never touched.
    await $.store.delete(keyFor(repo, previousToken));
    // A tick or a tracked PR from before /clear must not outlive it either.
    stopTick();
    tracked = null;

    // Demo mode first: a configured watch target needs no promote PR and no
    // session repo.
    const watchEnv = await $.env.get("PROMOTE_LIGHTS_WATCH").catch(() => undefined);
    const watchTarget = parseWatchTarget(watchEnv);
    if (watchTarget) {
      await startWatch($, key, watchTarget);
      return next(e);
    }

    if (!repo) return next(e);

    const { owner, name } = repo;

    // Only a real promote PR matches: dev head (or the configured
    // promote head) with base main, or the promote label. An ordinary
    // PR with base main must never match.
    let promoteHead = DEFAULT_PROMOTE_HEAD;
    const configured = await $.env.get("PROMOTE_HEAD").catch(() => undefined);
    if (configured) promoteHead = configured;

    // Both queries are filtered server side so the result is complete
    // no matter how many ordinary open PRs the repo has. A single
    // unfiltered list returns at most 30 PRs by default, which misses
    // a promote PR sitting past position 30. Settled, never all: one
    // rejected query degrades the search instead of aborting the start.
    const [headSettled, labelSettled] = await Promise.allSettled([
      $.process.run(buildHeadQueryArgs(promoteHead), { timeoutMs: 15000 }),
      $.process.run(buildLabelQueryArgs(), { timeoutMs: 15000 }),
    ]);
    const byHead = headSettled.status === "fulfilled"
      ? headSettled.value
      : { exitCode: 1, stdout: "", stderr: String(headSettled.reason) };
    const byLabel = labelSettled.status === "fulfilled"
      ? labelSettled.value
      : { exitCode: 1, stdout: "", stderr: String(labelSettled.reason) };

    if (byHead.exitCode !== 0 && byLabel.exitCode !== 0) {
      await $.store.set(key, stamp({ error: "gh: not found" }));
      return next(e);
    }

    // One failed query must never pass silently: the search is degraded,
    // the snapshot records it, and the band keeps saying DEGRADED.
    const degraded = byHead.exitCode !== 0 || byLabel.exitCode !== 0;
    if (degraded) {
      const failed = byHead.exitCode !== 0 ? "head" : "label";
      await warnStatus($, `lights: promote ${failed} query failed, continuing with the other`);
    }

    const prs = mergePRLists(
      byHead.exitCode === 0 ? parsePRList(byHead.stdout) : [],
      byLabel.exitCode === 0 ? parsePRList(byLabel.stdout) : []
    );
    const promotePR = prs.find((pr) => isPromotePR(pr, promoteHead));

    if (!promotePR) {
      await $.store.delete(key);
      return next(e);
    }

    tracked = { owner, repo: name, number: promotePR.number, head: promotePR.headRefOid, mode: "promote", base: "main", degraded };

    if (!ticking) {
      startTick($, key);
      await doTick($, key);
    }

    return next(e);
  });

  // Re-check on turn complete in case PR changed
  on("turn.complete", {}, async ($, e, next) => {
    const repo = await $.session.repo();
    if (!tracked) return next(e);
    const key = keyFor(repo);
    if (!repo && tracked.mode === "promote") return next(e);

    const result = await $.process.run(prViewArgv(tracked), { timeoutMs: 10000 });

    if (result.exitCode !== 0) return next(e);

    const details = parsePRView(result.stdout);
    if (!details || details.state !== "OPEN") {
      stopTick();
      await $.store.delete(key);
      tracked = null;
      $.ui.invalidate("ui.render");
      return next(e);
    }

    if (details.headRefOid !== tracked.head) {
      if (tracked.mode === "watch") {
        // A watched PR is a demo of any PR: follow the new head.
        tracked = { ...tracked, head: details.headRefOid };
        await doTick($, key);
        return next(e);
      }
      stopTick();
      await $.store.set(key, stamp({
        error: "head moved, stopped",
      }));
      tracked = null;
      $.ui.invalidate("ui.render");
      return next(e);
    }

    return next(e);
  });

  // Render the AbovePrompt band. Compose, never replace: next(e) always runs so
  // Claude Code's own band and every other plugin's AbovePrompt drawing survive,
  // and the lights sit above that tree in one column. The downstream tree is an
  // opaque engine node: it is placed, never mutated. Every node drawn here comes
  // from $.ui.resolve(e); a plain { type: "Box" } object never draws.
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const downstream = await next(e);
    const repo = await $.session.repo();
    const stored = own(await $.store.get(keyFor(repo)));

    if (!stored) return downstream;

    let band: unknown = null;
    if (stored.lights && stored.prNumber) {
      const els = await $.ui.resolve(e);
      band = buildBand(
        els,
        stored.label ?? `promote #${stored.prNumber}`,
        stored.lights,
        stored.head ?? "",
        stored.mergeStateStatus ?? "",
        stored.hold ?? false,
        stored.degraded ?? false
      );
    } else if (stored.error) {
      const els = await $.ui.resolve(e);
      band = buildErrorBand(els, stored.error);
    }

    if (band === null) return downstream;
    const { Box } = await $.ui.resolve(e);
    return Box({
      flexDirection: "column",
      children: downstream ? [band, downstream] : [band],
    });
  });

  // Manual control command
  on("command.run", { command: "lights" }, async ($, e) => {
    const trimmed = (e.args ?? "").trim();
    const [arg] = trimmed.split(/\s+/);
    const repo = await $.session.repo();
    const key = keyFor(repo);

    if (arg === "off") {
      stopTick();
      tracked = null;
      await $.store.delete(key);
      $.ui.invalidate("ui.render");
      return { text: "lights: stopped" };
    }

    if (arg === "refresh") {
      if (tracked) await doTick($, key);
      return { text: "lights: refreshed" };
    }

    if (arg === "watch") {
      const target = parseWatchTarget(trimmed.slice("watch".length));
      if (!target) return { text: WATCH_USAGE };
      const outcome = await startWatch($, key, target);
      return { text: outcome };
    }

    const stored = own(await $.store.get(key));

    if (stored && stored.lights) {
      return {
        text: buildStatusLine(
          stored.prNumber ?? 0,
          stored.lights,
          stored.mergeStateStatus ?? "",
          stored.hold ?? false,
          stored.label,
          stored.degraded ?? false
        ),
      };
    }
    if (stored && stored.error) return { text: `lights: ${stored.error}` };
    return { text: NO_PR_HINT };
  });
};

/**
 * Point the tick at any open PR. Returns the text /lights watch answers with.
 */
async function startWatch($: Hook$, key: string, target: WatchTarget): Promise<string> {
  const view = await $.process.run(prViewArgv(target), { timeoutMs: 10000 });
  const details = view.exitCode === 0 ? parsePRView(view.stdout) : null;
  const name = formatWatchTarget(target);
  if (!details) {
    await $.store.set(key, stamp({ error: `watch ${name}: gh pr view failed` }));
    $.ui.invalidate("ui.render");
    return `lights: could not read ${name} (gh pr view exit ${view.exitCode})`;
  }
  if (details.state !== "OPEN") {
    return `lights: ${name} is ${details.state}, not open`;
  }

  stopTick();
  tracked = {
    owner: target.owner,
    repo: target.repo,
    number: target.number,
    head: details.headRefOid,
    mode: "watch",
    // The watched PR's own base; main only when gh did not report one.
    base: details.baseRefName || "main",
    degraded: false,
  };
  startTick($, key);
  const snapshot = await doTick($, key);
  if (snapshot?.lights) {
    return buildStatusLine(target.number, snapshot.lights, snapshot.mergeStateStatus ?? "", false, labelFor(tracked), tracked.degraded);
  }
  if (snapshot?.error) return `lights: ${snapshot.error}`;
  return `lights: watching ${name}`;
}

function startTick($: Hook$, key: string): void {
  ticking = true;
  tickInterval = $.clock.every(TICK_MS, () => doTick($, key));
}

/** One tick: fetch, classify, store, draw. Returns what it stored. */
async function doTick($: Hook$, key: string): Promise<StoredLights | null> {
  if (!tracked) return null;

  const t = tracked;
  const { owner, repo, number: prNumber, head } = t;
  const base = encodeURIComponent(t.base);

  try {
    const [protection, rulesets] = await Promise.all([
      $.process.run(["gh", "api", `repos/${owner}/${repo}/branches/${base}/protection`], { timeoutMs: 10000 }),
      $.process.run(["gh", "api", `repos/${owner}/${repo}/rules/branches/${base}`], { timeoutMs: 10000 }),
    ]);

    let requiredContexts = computeRequiredUnion(
      protection.stdout ?? "",
      rulesets.stdout ?? ""
    );

    if (requiredContexts.length === 0 && t.mode === "promote") {
      // A promote verdict with nothing required would be a green lie.
      const refused: StoredLights = { error: "empty required contexts", prNumber };
      await $.store.set(key, stamp(refused));
      $.ui.invalidate("ui.render");
      return refused;
    }

    const checkRunsResult = await $.process.run([
        "gh",
        "api",
        `repos/${owner}/${repo}/commits/${head}/check-runs?per_page=100`,
      ], { timeoutMs: 10000 });
    const checkRuns = parseCheckRuns(checkRunsResult.stdout ?? "");

    if (requiredContexts.length === 0) {
      // Watch mode on an unprotected repo: show every check that ran.
      requiredContexts = allCheckNames(checkRuns.check_runs ?? []);
      if (requiredContexts.length === 0) {
        const empty: StoredLights = {
          error: `watch ${formatWatchTarget({ owner, repo, number: prNumber })}: no check runs on ${head.slice(0, 7)}`,
          prNumber,
        };
        await $.store.set(key, stamp(empty));
        $.ui.invalidate("ui.render");
        return empty;
      }
    }

    const lights = matchAndClassify(requiredContexts, checkRuns.check_runs ?? []);

    const prViewResult = await $.process.run(prViewArgv(t), { timeoutMs: 10000 });

    const prDetails = parsePRView(prViewResult.stdout ?? "");
    const mergeStateStatus = prDetails?.mergeStateStatus ?? "";
    const passing = isPassing(lights);
    const label = labelFor(t);

    const snapshot: StoredLights = {
      prNumber,
      head,
      label,
      mode: t.mode,
      lights,
      mergeStateStatus,
      hold: false,
      degraded: t.degraded,
      passing,
      ts: Date.now(),
    };
    await $.store.set(key, stamp(snapshot));

    // The band draws this state; a status line too showed it twice. Clear
    // it (also drops a startup warning, which the band's DEGRADED now keeps).
    // A collapsed band is not visible to a mod, so /lights answers the line.
    await clearStatus($);
    $.ui.invalidate("ui.render");
    return snapshot;
  } catch (err) {
    const failed: StoredLights = { error: String(err), prNumber };
    await $.store.set(key, stamp(failed));
    $.ui.invalidate("ui.render");
    return failed;
  }
}

function stopTick(): void {
  tickInterval?.cancel();
  ticking = false;
  tickInterval = null;
}

/**
 * Best effort status sink for warnings: a rejection here must never
 * abort the tracking that is already set up.
 */
async function warnStatus($: Hook$, message: string): Promise<void> {
  try {
    await $.ui.status(message);
  } catch {
    // Surfacing is best effort; tracking continues without it.
  }
}

/** Best effort too: a rejected clear must never replace the stored lights with an error. */
async function clearStatus($: Hook$): Promise<void> {
  try {
    await $.ui.status(undefined);
  } catch {
    // The band already carries the state; a stale line is cosmetic.
  }
}
