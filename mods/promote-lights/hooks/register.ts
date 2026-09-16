/**
 * Promote Lights - Function Hooks registration.
 *
 * Hooks registered:
 * - session.start
 * - turn.complete
 * - command.register /lights
 * - ui.render { component: 'AbovePrompt' }
 *
 * Calls:
 * - $.process.run (gh commands)
 * - $.fs.read (.github/branch-protection.json)
 * - $.session.repo
 * - $.clock.every (60s tick)
 * - $.store.get/set
 * - $.ui.status
 * - $.ui.invalidate
 */

import { matchAndClassify, isPassing, type ClassifiedLight } from "../src/classify.js";
import { computeRequiredUnion } from "../src/required.js";
import { parsePRList, parsePRView, parseCheckRuns } from "../src/gh.js";
import { buildStatusLine, buildBandContent } from "../src/pane.js";

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
    run: (opts: {
      argv: string[];
      init?: { timeoutMs?: number };
    }) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  };
  clock: {
    every: (ms: number, fn: () => void) => { dispose: () => void };
  };
  store: {
    get: (key: string) => Promise<StoredLights | null>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  ui: {
    status: (line: string) => Promise<void>;
    invalidate: (component: string) => void;
  };
};

type Matcher = Record<string, unknown>;

type HookEvent = {
  name?: string;
  args?: string[];
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

/** Shape stored under lights:<owner>/<repo>. */
type StoredLights = {
  prNumber?: number;
  head?: string;
  lights?: ClassifiedLight[];
  mergeStateStatus?: string;
  hold?: boolean;
  passing?: boolean;
  error?: string;
  [key: string]: unknown;
};

// Module state
let ticking = false;
let tickInterval: { dispose: () => void } | null = null;
let lastPR: { number: number; head: string } | null = null;

const TICK_MS = 60000;

export const register: Register = (on) => {
  // Detect open promote PR at session start
  on("session.start", {}, async ($, _e, next) => {
    const repo = await $.session.repo();
    if (!repo) return next();

    const { owner, name } = repo;
    const result = await $.process.run({
      argv: [
        "gh",
        "pr",
        "list",
        "--base",
        "main",
        "--state",
        "open",
        "--json",
        "number,headRefOid,title",
      ],
      init: { timeoutMs: 15000 },
    });

    if (result.exitCode !== 0) {
      await $.store.set(`lights:${owner}/${name}`, { error: "gh: not found" });
      return next();
    }

    const prs = parsePRList(result.stdout);
    const promotePR = prs[0];

    if (!promotePR) {
      await $.store.delete(`lights:${owner}/${name}`);
      return next();
    }

    lastPR = { number: promotePR.number, head: promotePR.headRefOid };

    if (!ticking) {
      ticking = true;
      tickInterval = $.clock.every(TICK_MS, () => doTick($, owner, name));
      await doTick($, owner, name);
    }

    return next();
  });

  // Re-check on turn complete in case PR changed
  on("turn.complete", {}, async ($, _e, next) => {
    const repo = await $.session.repo();
    if (!repo || !lastPR) return next();

    const result = await $.process.run({
      argv: [
        "gh",
        "pr",
        "view",
        String(lastPR.number),
        "--json",
        "headRefOid,state,mergeStateStatus",
      ],
      init: { timeoutMs: 10000 },
    });

    if (result.exitCode !== 0) return next();

    const details = parsePRView(result.stdout);
    if (!details || details.state !== "OPEN") {
      stopTick();
      await $.store.delete(`lights:${repo.owner}/${repo.name}`);
      lastPR = null;
      $.ui.invalidate("ui.render");
      return next();
    }

    if (details.headRefOid !== lastPR.head) {
      stopTick();
      await $.store.set(`lights:${repo.owner}/${repo.name}`, {
        error: "head moved, stopped",
      });
      lastPR = null;
      $.ui.invalidate("ui.render");
      return next();
    }

    return next();
  });

  // Render the AbovePrompt band
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const repo = await $.session.repo();
    const key = repo ? `lights:${repo.owner}/${repo.name}` : null;
    const stored = key ? await $.store.get(key) : null;

    if (stored && stored.lights && stored.prNumber) {
      const content = buildBandContent(
        stored.lights,
        stored.head?.slice(0, 7) ?? "",
        stored.mergeStateStatus ?? "",
        stored.hold ?? false
      );

      const tree = await next(e);
      return { ...tree, _prependBand: content };
    }

    return next();
  });

  // Manual control command
  on("command.register", {}, async ($, e, next) => {
    if (e.name !== "lights") return next();

    const [arg] = e.args ?? [];

    if (arg === "off") {
      stopTick();
      const repo = await $.session.repo();
      if (repo) await $.store.delete(`lights:${repo.owner}/${repo.name}`);
      $.ui.invalidate("ui.render");
      return { command: "lights", result: "stopped" };
    }

    if (arg === "refresh") {
      const repo = await $.session.repo();
      if (repo) await doTick($, repo.owner, repo.name);
      return { command: "lights", result: "refreshed" };
    }

    const repo = await $.session.repo();
    const key = repo ? `lights:${repo.owner}/${repo.name}` : null;
    const stored = key ? await $.store.get(key) : null;

    return {
      command: "lights",
      result: stored
        ? buildStatusLine(
            stored.prNumber ?? 0,
            stored.lights ?? [],
            stored.mergeStateStatus ?? "",
            stored.hold ?? false
          )
        : "no PR tracked",
    };
  });
};

async function doTick(
  $: Hook$,
  owner: string,
  repo: string
): Promise<void> {
  if (!lastPR) return;

  const prNumber = lastPR.number;
  const head = lastPR.head;

  try {
    const [protection, rulesets] = await Promise.all([
      $.process.run({
        argv: ["gh", "api", `repos/${owner}/${repo}/branches/main/protection`],
        init: { timeoutMs: 10000 },
      }),
      $.process.run({
        argv: ["gh", "api", `repos/${owner}/${repo}/rules/branches/main`],
        init: { timeoutMs: 10000 },
      }),
    ]);

    const requiredContexts = computeRequiredUnion(
      protection.stdout ?? "",
      rulesets.stdout ?? ""
    );

    if (requiredContexts.length === 0) {
      await $.store.set(`lights:${owner}/${repo}`, {
        error: "empty required contexts",
        prNumber,
      });
      return;
    }

    const checkRunsResult = await $.process.run({
      argv: [
        "gh",
        "api",
        `repos/${owner}/${repo}/commits/${head}/check-runs?per_page=100`,
      ],
      init: { timeoutMs: 10000 },
    });

    const checkRuns = parseCheckRuns(checkRunsResult.stdout ?? "");
    const lights = matchAndClassify(requiredContexts, checkRuns.check_runs);

    const prViewResult = await $.process.run({
      argv: [
        "gh",
        "pr",
        "view",
        String(prNumber),
        "--json",
        "headRefOid,state,mergeStateStatus",
      ],
      init: { timeoutMs: 10000 },
    });

    const prDetails = parsePRView(prViewResult.stdout ?? "");
    const mergeStateStatus = prDetails?.mergeStateStatus ?? "";
    const passing = isPassing(lights);

    await $.store.set(`lights:${owner}/${repo}`, {
      prNumber,
      head,
      lights,
      mergeStateStatus,
      hold: false,
      passing,
      ts: Date.now(),
    });

    const statusLine = buildStatusLine(prNumber, lights, mergeStateStatus, false);
    await $.ui.status(statusLine);
    $.ui.invalidate("ui.render");
  } catch (err) {
    await $.store.set(`lights:${owner}/${repo}`, {
      error: String(err),
      prNumber,
    });
  }
}

function stopTick(): void {
  tickInterval?.dispose();
  ticking = false;
  tickInterval = null;
}
