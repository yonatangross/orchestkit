/**
 * Tests for register.ts - hook registration AND behavior.
 *
 * Two layers:
 * 1. Registration metadata: which events the module subscribes to.
 * 2. Behavior: the registered handlers are INVOKED against a fake $ and
 *    their observable effects (store writes, clock lifecycle, command
 *    results) are asserted. The behavior layer exists because the review
 *    of GH-4165 found that 4 of 4 behavioral mutants of register.ts
 *    survived the metadata-only suite: tests that never call the handler
 *    assert nothing about what the handler does.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// Fake $ object type. Concrete signatures, not ReturnType<typeof vi.fn>:
// under vitest 5 the bare Mock type is not directly callable in strict tsc.
interface Fake$ {
  session: {
    repo: () => Promise<{ owner: string; name: string } | null>;
  };
  process: {
    run: (
      argv: readonly string[],
      init?: Record<string, unknown>
    ) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  };
  fs: {
    read: (path: string) => Promise<unknown>;
  };
  clock: {
    every: (ms: number, fn: () => void) => { dispose: () => void };
  };
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  ui: {
    status: (line: string) => Promise<void>;
    invalidate: (component: string) => void;
  };
  command: {
    register: (spec: { name: string; description: string; argumentHint?: string }) => Promise<unknown>;
  };
  env?: {
    get: (key: string) => Promise<string | undefined>;
  };
}

type Handler = ($: Fake$, e: unknown, next: (ev?: unknown) => Promise<unknown>) => unknown;

/** Capture the handlers register() subscribes, keyed by event name. */
function captureHandlers(mod: { register: (on: never) => void }): Map<string, Handler> {
  const handlers = new Map<string, Handler>();
  const on = ((
    event: string,
    _matcher: unknown,
    handler: Handler
  ) => {
    handlers.set(event, handler);
  }) as never;
  mod.register(on);
  return handlers;
}

const PR_LIST_ONE = JSON.stringify([
  { number: 4165, headRefName: "dev", headRefOid: "abc123def4567", title: "promote dev", labels: [] },
]);

const PROTECTION_OK = JSON.stringify({
  required_status_checks: { contexts: ["Build", "Static Analysis"] },
});

const CHECK_RUNS_ALL_GREEN = JSON.stringify({
  total_count: 2,
  check_runs: [
    { name: "Build", status: "completed", conclusion: "success" },
    { name: "Static Analysis", status: "completed", conclusion: "success" },
  ],
});

const PR_VIEW_OPEN = JSON.stringify({
  headRefOid: "abc123def4567",
  state: "OPEN",
  mergeStateStatus: "CLEAN",
});

/**
 * Fake process.run that dispatches on the gh argv shape, so a handler
 * under test gets realistic responses per endpoint.
 */
function makeDispatchingRun(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (argv: readonly string[], _init?: Record<string, unknown>) => {
    if (overrides.before) (overrides.before as () => void)();
    if (argv[1] === "pr" && argv[2] === "list") {
      return {
        exitCode: 0,
        stdout: (overrides.prList as string) ?? PR_LIST_ONE,
        stderr: "",
      };
    }
    if (argv[1] === "api" && argv[2]?.includes("/branches/main/protection")) {
      return {
        exitCode: 0,
        stdout: (overrides.protection as string) ?? PROTECTION_OK,
        stderr: "",
      };
    }
    if (argv[1] === "api" && argv[2]?.includes("/rules/branches/main")) {
      return {
        exitCode: 0,
        stdout: (overrides.rulesets as string) ?? "[]",
        stderr: "",
      };
    }
    if (argv[1] === "api" && argv[2]?.includes("/check-runs")) {
      return {
        exitCode: 0,
        stdout: (overrides.checkRuns as string) ?? CHECK_RUNS_ALL_GREEN,
        stderr: "",
      };
    }
    if (argv[1] === "pr" && argv[2] === "view") {
      return {
        exitCode: 0,
        stdout: (overrides.prView as string) ?? PR_VIEW_OPEN,
        stderr: "",
      };
    }
    return { exitCode: 0, stdout: "{}", stderr: "" };
  });
}

function createFake$(overrides: Record<string, unknown> = {}): Fake$ {
  return {
    session: {
      repo: vi
        .fn()
        .mockResolvedValue(
          // Explicit null IS an override here (session-less session), so
          // `??` cannot be used: it treats null as absent.
          "repo" in overrides ? overrides.repo : { owner: "yonatangross", name: "orchestkit" }
        ),
    },
    process: {
      run: (overrides.run as Fake$["process"]["run"]) ?? makeDispatchingRun(overrides),
    },
    fs: {
      read: vi.fn().mockResolvedValue(null),
    },
    clock: {
      every: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    },
    store: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    ui: {
      status: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn(),
    },
    command: {
      register: vi.fn().mockResolvedValue(undefined),
    },
  };
}

const NEXT = (_ev?: unknown) => Promise.resolve({});

/** Fresh module instance per load: register.ts keeps lastPR/ticking in
 * module-level state, so tests that need independent runs re-import it. */
async function loadRegister(): Promise<{ register: (on: never) => void }> {
  vi.resetModules();
  return (await import("../hooks/register.ts")) as unknown as {
    register: (on: never) => void;
  };
}

describe("register", () => {
  let fake$: Fake$;

  beforeEach(() => {
    vi.clearAllMocks();
    fake$ = createFake$();
  });

  test("session.start hooks with empty matcher", async () => {
    // Import the register function
    const { register } = await import("../hooks/register.ts");

    // Create a mock on function
    const on = vi.fn();

    // Call register
    register(on as unknown as Parameters<typeof register>[0]);

    // Verify session.start was registered
    const sessionStartCall = on.mock.calls.find(
      (call) => call[0] === "session.start"
    );
    expect(sessionStartCall).toBeTruthy();
    expect(sessionStartCall?.[1]).toEqual({});
  });

  test("turn.complete hooks with empty matcher", async () => {
    const { register } = await import("../hooks/register.ts");

    const on = vi.fn();
    register(on as unknown as Parameters<typeof register>[0]);

    const turnCompleteCall = on.mock.calls.find(
      (call) => call[0] === "turn.complete"
    );
    expect(turnCompleteCall).toBeTruthy();
    expect(turnCompleteCall?.[1]).toEqual({});
  });

  test("ui.render hooks with AbovePrompt matcher", async () => {
    const { register } = await import("../hooks/register.ts");

    const on = vi.fn();
    register(on as unknown as Parameters<typeof register>[0]);

    const uiRenderCall = on.mock.calls.find(
      (call) => call[0] === "ui.render" &&
        call[1] && typeof call[1] === "object" &&
        "component" in call[1]
    );
    expect(uiRenderCall).toBeTruthy();
    expect((uiRenderCall?.[1] as { component: string }).component).toBe("AbovePrompt");
  });

  test("command.run hooks for /lights with a {command: 'lights'} matcher", async () => {
    // CC 2.1.282: /lights is served by command.run and declared with
    // $.command.register at session start. command.register is an op
    // event there, so hooking it would never fire.
    const { register } = await import("../hooks/register.ts");

    const on = vi.fn();
    register(on as unknown as Parameters<typeof register>[0]);

    const commandCall = on.mock.calls.find(
      (call) => call[0] === "command.run"
    );
    expect(commandCall).toBeTruthy();
    expect(commandCall?.[1]).toEqual({ command: "lights" });
    expect(on.mock.calls.some((call) => call[0] === "command.register")).toBe(false);
  });

  test("session.start declares /lights with $.command.register before anything else", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    // No repo: the declaration must still happen, since the command is
    // useful (it reports "no PR tracked") even outside a repo.
    const $ = createFake$({ repo: null });

    await handlers.get("session.start")!($, {}, NEXT);

    expect($.command.register).toHaveBeenCalledTimes(1);
    expect($.command.register).toHaveBeenCalledWith(
      expect.objectContaining({ name: "lights", argumentHint: "[off|refresh]" })
    );
  });
});

/**
 * BEHAVIOR: the handlers are invoked against a fake $. Each test pins an
 * observable effect so a mutation of register.ts changes a test result.
 * vi.resetModules() isolates the module-level state (ticking, lastPR)
 * between tests.
 */
describe("register behavior (mutant-killing)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("session.start with no repo calls next(e) and never runs gh", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$({ repo: null });
    const e = { name: "session.start" };
    const next = vi.fn(NEXT);

    await handlers.get("session.start")!($, e, next);

    expect($.process.run).not.toHaveBeenCalled();
    expect($.store.set).not.toHaveBeenCalled();
    // CC 2.1.282 rejects a bare next(): the event must be passed through.
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(e);
  });

  test("session.start with failing gh stores the error and never starts the clock", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$({
      run: vi.fn().mockResolvedValue({ exitCode: 1, stdout: "", stderr: "boom" }),
    });

    await handlers.get("session.start")!($, {}, NEXT);

    expect($.store.set).toHaveBeenCalledWith("lights:yonatangross/orchestkit", {
      error: "gh: not found",
    });
    expect($.clock.every).not.toHaveBeenCalled();
  });

  test("session.start with no open PR deletes stored state and does not tick", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$({ prList: "[]" });

    await handlers.get("session.start")!($, {}, NEXT);

    expect($.store.delete).toHaveBeenCalledWith("lights:yonatangross/orchestkit");
    expect($.clock.every).not.toHaveBeenCalled();
  });

  test("session.start with only an ordinary PR into main tracks nothing", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$({
      prList: JSON.stringify([
        { number: 4416, headRefName: "feat/ordinary-work", headRefOid: "fff1112223333", title: "ordinary work", labels: [] },
      ]),
    });

    await handlers.get("session.start")!($, {}, NEXT);

    expect($.store.delete).toHaveBeenCalledWith("lights:yonatangross/orchestkit");
    expect($.clock.every).not.toHaveBeenCalled();
    expect($.ui.status).not.toHaveBeenCalled();
  });

  test("session.start skips an ordinary PR and tracks the dev head PR", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$({
      prList: JSON.stringify([
        { number: 4416, headRefName: "feat/ordinary-work", headRefOid: "fff1112223333", title: "ordinary work", labels: [] },
        { number: 4417, headRefName: "dev", headRefOid: "abc123def4567", title: "promote dev", labels: [] },
      ]),
    });

    await handlers.get("session.start")!($, {}, NEXT);

    expect($.clock.every).toHaveBeenCalledTimes(1);
    expect($.store.set).toHaveBeenCalledWith(
      "lights:yonatangross/orchestkit",
      expect.objectContaining({ prNumber: 4417, head: "abc123def4567", passing: true })
    );
  });

  test("session.start tracks a non dev head carrying the promote label", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$({
      prList: JSON.stringify([
        { number: 4418, headRefName: "release/roundup", headRefOid: "abc123def4567", title: "roundup", labels: [{ name: "promote" }] },
      ]),
    });

    await handlers.get("session.start")!($, {}, NEXT);

    expect($.clock.every).toHaveBeenCalledTimes(1);
    expect($.store.set).toHaveBeenCalledWith(
      "lights:yonatangross/orchestkit",
      expect.objectContaining({ prNumber: 4418, passing: true })
    );
  });

  test("session.start honors a configured promote head from the environment", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$({
      prList: JSON.stringify([
        { number: 4419, headRefName: "release", headRefOid: "abc123def4567", title: "promote release", labels: [] },
      ]),
    });
    $.env = { get: vi.fn().mockResolvedValue("release") };

    await handlers.get("session.start")!($, {}, NEXT);

    expect($.clock.every).toHaveBeenCalledTimes(1);
    expect($.store.set).toHaveBeenCalledWith(
      "lights:yonatangross/orchestkit",
      expect.objectContaining({ prNumber: 4419 })
    );
  });

  test("session.start with a promote PR starts a 60s clock and the first tick classifies all-green as passing", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$();

    await handlers.get("session.start")!($, {}, NEXT);

    // CC 2.1.282 process.run takes the argv array positionally plus init,
    // not an { argv, init } object.
    expect($.process.run).toHaveBeenCalledWith(
      ["gh", "pr", "list", "--base", "main", "--state", "open", "--json", "number,headRefName,headRefOid,title,labels"],
      { timeoutMs: 15000 }
    );

    // The clock ticks every 60000ms.
    expect($.clock.every).toHaveBeenCalledTimes(1);
    expect($.clock.every).toHaveBeenCalledWith(60000, expect.any(Function));

    // The first tick ran synchronously: required contexts were fetched.
    const apiCalls = ($.process.run as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => (c[0] as readonly string[])[1] === "api"
    );
    expect(apiCalls.length).toBeGreaterThanOrEqual(3);

    // All-green check runs over the protection contexts => passing true.
    expect($.store.set).toHaveBeenCalledWith(
      "lights:yonatangross/orchestkit",
      expect.objectContaining({
        prNumber: 4165,
        head: "abc123def4567",
        passing: true,
        hold: false,
      })
    );
    expect($.ui.status).toHaveBeenCalledTimes(1);
    expect($.ui.invalidate).toHaveBeenCalledWith("ui.render");
  });

  test("a PENDING required context makes the stored verdict not-passing (GH-4177 class)", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$({
      checkRuns: JSON.stringify({
        total_count: 2,
        check_runs: [
          { name: "Build", status: "completed", conclusion: "success" },
          { name: "Static Analysis", status: "in_progress", conclusion: null },
        ],
      }),
    });

    await handlers.get("session.start")!($, {}, NEXT);

    expect($.store.set).toHaveBeenCalledWith(
      "lights:yonatangross/orchestkit",
      expect.objectContaining({ passing: false })
    );
  });

  test("a FAILING required context makes the stored verdict not-passing regardless of API order", async () => {
    // Two independent module instances: session.start only ticks once per
    // instance (the ticking latch), so the second order needs a fresh one.
    const failureLast = createFake$({
      checkRuns: JSON.stringify({
        total_count: 2,
        check_runs: [
          { name: "Build", status: "completed", conclusion: "success" },
          { name: "Static Analysis", status: "completed", conclusion: "failure" },
        ],
      }),
    });
    const failureFirst = createFake$({
      checkRuns: JSON.stringify({
        total_count: 2,
        check_runs: [
          { name: "Static Analysis", status: "completed", conclusion: "failure" },
          { name: "Build", status: "completed", conclusion: "success" },
        ],
      }),
    });

    const handlersLast = captureHandlers(await loadRegister());
    await handlersLast.get("session.start")!(failureLast, {}, NEXT);
    const handlersFirst = captureHandlers(await loadRegister());
    await handlersFirst.get("session.start")!(failureFirst, {}, NEXT);

    expect(failureLast.store.set).toHaveBeenCalledWith(
      "lights:yonatangross/orchestkit",
      expect.objectContaining({ passing: false })
    );
    expect(failureFirst.store.set).toHaveBeenCalledWith(
      "lights:yonatangross/orchestkit",
      expect.objectContaining({ passing: false })
    );
  });

  test("tick with an EMPTY required-context union refuses green and stores the refusal", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    // Protection returns an unparseable body and rulesets are empty, so the
    // union is empty. The monitor must record the refusal, not go green.
    const $ = createFake$({ protection: "{}", rulesets: "[]" });

    await handlers.get("session.start")!($, {}, NEXT);

    expect($.store.set).toHaveBeenCalledWith(
      "lights:yonatangross/orchestkit",
      expect.objectContaining({ error: "empty required contexts", prNumber: 4165 })
    );
    // No lights were ever published for the PR.
    expect($.ui.status).not.toHaveBeenCalled();
  });

  test("/lights off stops the clock and deletes stored state", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$();

    // Start tracking first so there is a clock to stop.
    await handlers.get("session.start")!($, {}, NEXT);
    expect($.clock.every).toHaveBeenCalledTimes(1);
    const dispose = ($.clock.every as ReturnType<typeof vi.fn>).mock.results[0]
      .value as { dispose: ReturnType<typeof vi.fn> };

    const result = (await handlers.get("command.run")!($, { command: "lights", args: "off" }, NEXT)) as {
      text: string;
    };

    expect(result).toEqual({ text: "lights: stopped" });
    // The interval is disposed, so no further ticks fire.
    expect(dispose.dispose).toHaveBeenCalledTimes(1);
    expect($.store.delete).toHaveBeenCalledWith("lights:yonatangross/orchestkit");
    expect($.ui.invalidate).toHaveBeenCalledWith("ui.render");
  });

  test("/lights refresh runs a fresh tick and publishes a status line", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$();

    await handlers.get("session.start")!($, {}, NEXT);
    const callsAfterStart = ($.process.run as ReturnType<typeof vi.fn>).mock.calls.length;
    ($.ui.status as ReturnType<typeof vi.fn>).mockClear();

    // args arrive as one raw string; surrounding whitespace must not stop
    // the subcommand from matching.
    const result = (await handlers.get("command.run")!($, { command: "lights", args: " refresh " }, NEXT)) as {
      text: string;
    };

    expect(result).toEqual({ text: "lights: refreshed" });
    expect(
      ($.process.run as ReturnType<typeof vi.fn>).mock.calls.length
    ).toBeGreaterThan(callsAfterStart);
    expect($.ui.status).toHaveBeenCalledTimes(1);
  });

  test("/lights with no args reports the tracked PR status line", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$();

    // Start tracking first, then reflect the stored snapshot back through
    // store.get the way the real store would.
    await handlers.get("session.start")!($, {}, NEXT);
    const stored = ($.store.set as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => (c[1] as { passing?: boolean }).passing !== undefined
    )?.[1];
    ($.store.get as ReturnType<typeof vi.fn>).mockResolvedValue(stored);

    const result = (await handlers.get("command.run")!($, { command: "lights", args: "" }, NEXT)) as {
      text: string;
    };
    // The status line names the PR it is tracking.
    expect(result.text).toContain("4165");
    expect(result.text).not.toBe("no PR tracked");
    // A bare /lights is a read: it neither stops nor re-ticks.
    const dispose = ($.clock.every as ReturnType<typeof vi.fn>).mock.results[0]
      .value as { dispose: ReturnType<typeof vi.fn> };
    expect(dispose.dispose).not.toHaveBeenCalled();
  });

  test("/lights with no tracked state reports no PR tracked", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$();

    const result = (await handlers.get("command.run")!($, { command: "lights" }, NEXT)) as {
      text: string;
    };
    expect(result).toEqual({ text: "no PR tracked" });
    expect($.process.run).not.toHaveBeenCalled();
  });

  test("turn.complete with a closed PR stops tracking and deletes state", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$({
      prView: JSON.stringify({
        headRefOid: "abc123def4567",
        state: "MERGED",
        mergeStateStatus: "CLEAN",
      }),
    });

    await handlers.get("session.start")!($, {}, NEXT);
    await handlers.get("turn.complete")!($, {}, NEXT);

    expect($.store.delete).toHaveBeenCalledWith("lights:yonatangross/orchestkit");
    expect($.ui.invalidate).toHaveBeenCalledWith("ui.render");
  });

  test("turn.complete with a moved head stops the clock and records why", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$({
      prView: JSON.stringify({
        headRefOid: "9999999999999",
        state: "OPEN",
        mergeStateStatus: "CLEAN",
      }),
    });

    await handlers.get("session.start")!($, {}, NEXT);
    await handlers.get("turn.complete")!($, {}, NEXT);

    expect($.store.set).toHaveBeenCalledWith("lights:yonatangross/orchestkit", {
      error: "head moved, stopped",
    });
  });
});

describe("fake $ behavior", () => {
  test("fake session.repo returns owner/name", async () => {
    const fake$ = createFake$();
    const repo = await fake$.session.repo();
    expect(repo).toEqual({ owner: "yonatangross", name: "orchestkit" });
  });

  test("fake process.run dispatches gh pr list", async () => {
    const fake$ = createFake$();
    const result = await fake$.process.run(["gh", "pr", "list"], {});
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toHaveLength(1);
  });

  test("fake store.get returns null by default", async () => {
    const fake$ = createFake$();
    const value = await fake$.store.get("lights:test");
    expect(value).toBeNull();
  });
});

describe("ui.render AbovePrompt composes with downstream renderers", () => {
  const STORED = {
    prNumber: 4165,
    head: "abc1234def",
    mergeStateStatus: "CLEAN",
    hold: false,
    lights: [{ name: "ci-pr-status", color: "green", conclusion: "success" }],
  };
  // What Claude Code's own band, or another plugin's AbovePrompt hook, drew.
  const DOWNSTREAM = { type: "Box", children: ["downstream band"] };

  beforeEach(() => {
    vi.resetModules();
  });

  test("while lights are stored, the downstream renderer still runs and its tree is kept under the band", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$();
    ($.store.get as ReturnType<typeof vi.fn>).mockResolvedValue(STORED);
    const e = { component: "AbovePrompt", props: {} };
    const next = vi.fn((_ev?: unknown) => Promise.resolve(DOWNSTREAM));

    const out = (await handlers.get("ui.render")!($, e, next)) as {
      type: string;
      props?: { flexDirection?: string };
      children: unknown[];
    };

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(e);
    expect(out.type).toBe("Box");
    expect(out.props?.flexDirection).toBe("column");
    expect(out.children).toHaveLength(2);
    expect(JSON.stringify(out.children[0])).toContain("ci-pr-status");
    expect(out.children[1]).toBe(DOWNSTREAM);
  });

  test("with no lights stored, the downstream tree is returned unchanged", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$();
    const e = { component: "AbovePrompt", props: {} };
    const next = vi.fn((_ev?: unknown) => Promise.resolve(DOWNSTREAM));

    const out = await handlers.get("ui.render")!($, e, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(e);
    expect(out).toBe(DOWNSTREAM);
  });

  test("while lights are stored and nothing is drawn downstream, only the band is returned", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$();
    ($.store.get as ReturnType<typeof vi.fn>).mockResolvedValue(STORED);
    const next = vi.fn((_ev?: unknown) => Promise.resolve(null));

    const out = (await handlers.get("ui.render")!($, { component: "AbovePrompt", props: {} }, next)) as {
      children: unknown[];
    };

    expect(next).toHaveBeenCalledTimes(1);
    expect(out.children).toHaveLength(1);
    expect(JSON.stringify(out.children[0])).toContain("ci-pr-status");
  });
});
