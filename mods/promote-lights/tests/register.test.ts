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
    every: (ms: number, fn: () => void) => { cancel: () => void };
  };
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  ui: {
    status: (line: string) => Promise<void>;
    invalidate: (component: string) => void;
    resolve: (e: unknown) => Promise<Record<string, FakeCtor>>;
  };
  command: {
    register: (spec: { name: string; description: string; argumentHint?: string }) => Promise<unknown>;
  };
  env: {
    get: (key: string) => Promise<string | undefined>;
  };
}

/** A node as the fake constructors build it: the same split the engine's h() makes. */
type FakeNode = { type: string; props: Record<string, unknown>; children: unknown[] };
type FakeCtor = (props?: Record<string, unknown>) => FakeNode;

/** Mirrors the engine: (name) => (props) => h(name, rest, ...children). */
function fakeElements(): Record<string, FakeCtor> {
  const make = (name: string): FakeCtor => (props = {}) => {
    const { children, ...rest } = props;
    const list = children === undefined ? [] : Array.isArray(children) ? children : [children];
    return { type: name, props: rest, children: list };
  };
  return { Box: make("Box"), Text: make("Text") };
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
    if (argv[1] === "api" && /\/branches\/[^/]+\/protection$/.test(argv[2] ?? "")) {
      return {
        exitCode: 0,
        stdout: (overrides.protection as string) ?? PROTECTION_OK,
        stderr: "",
      };
    }
    if (argv[1] === "api" && /\/rules\/branches\/[^/]+$/.test(argv[2] ?? "")) {
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
      // CC 2.1.282 hands back { cancel } only; a fresh handle per call.
      every: vi.fn(() => ({ cancel: vi.fn() })),
    },
    store: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    ui: {
      status: vi.fn().mockResolvedValue(undefined),
      invalidate: vi.fn(),
      resolve: vi.fn(async (_e: unknown) => fakeElements()),
    },
    command: {
      register: vi.fn().mockResolvedValue(undefined),
    },
    env: {
      get: (overrides.envGet as Fake$["env"]["get"]) ?? vi.fn().mockResolvedValue(undefined),
    },
  };
}

const NEXT = (_ev?: unknown) => Promise.resolve({});

/** Fresh module instance per load: register.ts keeps lastPR/ticking in
 * module-level state, so tests that need independent runs re-import it. */
type LoadedModule = { register: (on: never) => void; currentSessionToken: () => string };

/** The module instance loadRegister() loaded last; seeded entries carry its CURRENT token. */
let loaded: LoadedModule | null = null;
const currentToken = (): string => (loaded ? loaded.currentSessionToken() : "");

async function loadRegister(): Promise<LoadedModule> {
  vi.resetModules();
  loaded = (await import("../hooks/register.ts")) as unknown as LoadedModule;
  return loaded;
}

/** Keys are per repo AND per session token. */
const KEY = expect.stringMatching(/^lights:yonatangross\/orchestkit:/);

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
      expect.objectContaining({ name: "lights", argumentHint: "[off|refresh|watch owner/repo#N]" })
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

    expect($.store.set).toHaveBeenCalledWith(KEY, {
      error: "gh: not found",
      session: expect.any(String),
    });
    expect($.clock.every).not.toHaveBeenCalled();
  });

  test("session.start clears a previous session's lights before it runs gh", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$({
      run: vi.fn().mockResolvedValue({ exitCode: 1, stdout: "", stderr: "boom" }),
    });

    await handlers.get("session.start")!($, {}, NEXT);

    // $.store outlives the session, so the first render must not find old lights.
    expect($.store.delete).toHaveBeenCalledWith(KEY);
    const cleared = vi.mocked($.store.delete).mock.invocationCallOrder[0];
    const firstRun = vi.mocked($.process.run).mock.invocationCallOrder[0];
    expect(cleared).toBeLessThan(firstRun);
  });

  test("session.start with no open PR deletes stored state and does not tick", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$({ prList: "[]" });

    await handlers.get("session.start")!($, {}, NEXT);

    expect($.store.delete).toHaveBeenCalledWith(KEY);
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

    expect($.store.delete).toHaveBeenCalledWith(KEY);
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
      KEY,
      expect.objectContaining({ prNumber: 4417, head: "abc123def4567", passing: true })
    );
  });

  test("session.start finds a promote PR past the first 30 open PRs via server side filters", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    // 40 ordinary PRs plus one dev head promote PR at position 35.
    // A single unfiltered gh pr list page holds 30 entries, so the old
    // query missed it. The stub mimics that server behavior: unfiltered
    // lists are cut to 30, filtered ones return their full match set.
    interface StubPR {
      number: number;
      headRefName: string;
      headRefOid: string;
      title: string;
      labels: Array<{ name: string }>;
    }
    const ordinary: StubPR[] = Array.from({ length: 40 }, (_, i) => ({
      number: 4400 + i,
      headRefName: `feat/work-${i}`,
      headRefOid: `fff111222333${i}`,
      title: `ordinary work ${i}`,
      labels: [],
    }));
    const promote: StubPR = {
      number: 4500,
      headRefName: "dev",
      headRefOid: "abc123def4567",
      title: "promote dev",
      labels: [],
    };
    const all: StubPR[] = [...ordinary.slice(0, 34), promote, ...ordinary.slice(34)];
    expect(all.indexOf(promote)).toBeGreaterThan(29);
    const fallback = makeDispatchingRun();
    const serverRun = vi.fn(
      async (argv: readonly string[], init?: Record<string, unknown>) => {
        if (argv[1] === "pr" && argv[2] === "list") {
          const headIdx = argv.indexOf("--head");
          const labelIdx = argv.indexOf("--label");
          const limitIdx = argv.indexOf("--limit");
          let page: StubPR[];
          if (headIdx !== -1) {
            page = all.filter((pr) => pr.headRefName === argv[headIdx + 1]);
          } else if (labelIdx !== -1) {
            page = all.filter((pr) =>
              pr.labels.some((l) => l.name === argv[labelIdx + 1])
            );
          } else {
            page = all.slice(0, 30);
          }
          if (limitIdx !== -1) page = page.slice(0, Number(argv[limitIdx + 1]));
          return { exitCode: 0, stdout: JSON.stringify(page), stderr: "" };
        }
        return fallback(argv, init);
      }
    );
    const $ = createFake$({ run: serverRun });

    await handlers.get("session.start")!($, {}, NEXT);

    // Every list call carries a server side filter, never a bare page.
    const listCalls = serverRun.mock.calls.filter(
      (c) => (c[0] as readonly string[])[1] === "pr" && (c[0] as readonly string[])[2] === "list"
    );
    expect(listCalls).toHaveLength(2);
    expect(
      listCalls.every(
        (c) =>
          (c[0] as readonly string[]).includes("--head") ||
          (c[0] as readonly string[]).includes("--label")
      )
    ).toBe(true);

    expect($.clock.every).toHaveBeenCalledTimes(1);
    expect($.store.set).toHaveBeenCalledWith(
      "lights:yonatangross/orchestkit",
      expect.objectContaining({ prNumber: 4500, head: "abc123def4567", passing: true })
    );
  });

  test("session.start warns when one promote query fails and uses the other", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const fallback = makeDispatchingRun();
    const partialRun = vi.fn(
      async (argv: readonly string[], init?: Record<string, unknown>) => {
        if (argv[1] === "pr" && argv[2] === "list" && argv.includes("--head")) {
          return { exitCode: 1, stdout: "", stderr: "rate limited" };
        }
        if (argv[1] === "pr" && argv[2] === "list") {
          return {
            exitCode: 0,
            stdout: JSON.stringify([
              { number: 4418, headRefName: "release/roundup", headRefOid: "abc123def4567", title: "roundup", labels: [{ name: "promote" }] },
            ]),
            stderr: "",
          };
        }
        return fallback(argv, init);
      }
    );
    const $ = createFake$({ run: partialRun });

    await handlers.get("session.start")!($, {}, NEXT);

    // The surviving label query still tracks the promote PR.
    expect($.store.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ prNumber: 4418, passing: true })
    );
    // And the failed head query is surfaced, never silent.
    expect($.ui.status).toHaveBeenCalledWith(
      expect.stringContaining("head query failed")
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
      KEY,
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
      envGet: vi.fn().mockResolvedValue("release"),
    });

    await handlers.get("session.start")!($, {}, NEXT);

    expect($.clock.every).toHaveBeenCalledTimes(1);
    expect($.store.set).toHaveBeenCalledWith(
      KEY,
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
    // Both list queries are filtered server side with an explicit limit
    // so a promote PR past position 30 is still returned.
    expect($.process.run).toHaveBeenCalledWith(
      ["gh", "pr", "list", "--base", "main", "--head", "dev", "--state", "open", "--json", "number,headRefName,headRefOid,title,labels", "--limit", "100"],
      { timeoutMs: 15000 }
    );
    expect($.process.run).toHaveBeenCalledWith(
      ["gh", "pr", "list", "--base", "main", "--label", "promote", "--state", "open", "--json", "number,headRefName,headRefOid,title,labels", "--limit", "100"],
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
      KEY,
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
      KEY,
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
      KEY,
      expect.objectContaining({ passing: false })
    );
    expect(failureFirst.store.set).toHaveBeenCalledWith(
      KEY,
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
      KEY,
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
    const handle = ($.clock.every as ReturnType<typeof vi.fn>).mock.results[0]
      .value as { cancel: ReturnType<typeof vi.fn> };

    const result = (await handlers.get("command.run")!($, { command: "lights", args: "off" }, NEXT)) as {
      text: string;
    };

    expect(result).toEqual({ text: "lights: stopped" });
    // The interval is cancelled, so no further ticks fire.
    expect(handle.cancel).toHaveBeenCalledTimes(1);
    expect($.store.delete).toHaveBeenCalledWith(KEY);
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
    const handle = ($.clock.every as ReturnType<typeof vi.fn>).mock.results[0]
      .value as { cancel: ReturnType<typeof vi.fn> };
    expect(handle.cancel).not.toHaveBeenCalled();
  });

  test("/lights with no tracked state says how to watch any PR", async () => {
    const { register } = await import("../hooks/register.ts");
    const handlers = captureHandlers({ register });
    const $ = createFake$();

    const result = (await handlers.get("command.run")!($, { command: "lights" }, NEXT)) as {
      text: string;
    };
    expect(result.text).toContain("no promote PR open");
    expect(result.text).toContain("/lights watch owner/repo#123");
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
    const handle = ($.clock.every as ReturnType<typeof vi.fn>).mock.results[0]
      .value as { cancel: ReturnType<typeof vi.fn> };
    await handlers.get("turn.complete")!($, {}, NEXT);

    expect(handle.cancel).toHaveBeenCalledTimes(1);
    expect($.store.delete).toHaveBeenCalledWith(KEY);
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
    const handle = ($.clock.every as ReturnType<typeof vi.fn>).mock.results[0]
      .value as { cancel: ReturnType<typeof vi.fn> };
    await handlers.get("turn.complete")!($, {}, NEXT);

    expect(handle.cancel).toHaveBeenCalledTimes(1);
    expect($.store.set).toHaveBeenCalledWith(KEY, {
      error: "head moved, stopped",
      session: expect.any(String),
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
    ($.store.get as ReturnType<typeof vi.fn>).mockResolvedValue({ ...STORED, session: currentToken() });
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
    // All green: the band is the summary line alone, no per-check line.
    expect(JSON.stringify(out.children[0])).toContain("#4165");
    expect(JSON.stringify(out.children[0])).not.toContain("ci-pr-status");
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
    ($.store.get as ReturnType<typeof vi.fn>).mockResolvedValue({ ...STORED, session: currentToken() });
    const next = vi.fn((_ev?: unknown) => Promise.resolve(null));

    const out = (await handlers.get("ui.render")!($, { component: "AbovePrompt", props: {} }, next)) as {
      children: unknown[];
    };

    expect(next).toHaveBeenCalledTimes(1);
    expect(out.children).toHaveLength(1);
    expect(JSON.stringify(out.children[0])).toContain("#4165");
  });
});

const WATCH_VIEW = JSON.stringify({ headRefOid: "feedbee1234567", state: "OPEN", mergeStateStatus: "BLOCKED" });
const MIXED_RUNS = JSON.stringify({
  total_count: 4,
  check_runs: [
    { name: "build", status: "completed", conclusion: "success" },
    { name: "lint", status: "completed", conclusion: "failure" },
    { name: "e2e", status: "in_progress", conclusion: null },
    { name: "build", status: "completed", conclusion: "success" },
  ],
});

describe("watch mode (demo: lights for any open PR)", () => {

  beforeEach(() => {
    vi.resetModules();
  });

  test("/lights watch owner/repo#N tracks that PR, falls back to every check run, and pins a status line", async () => {
    const handlers = captureHandlers(await loadRegister());
    // Unprotected watched repo: protection and rulesets give an empty union.
    const $ = createFake$({ protection: "{}", rulesets: "[]", checkRuns: MIXED_RUNS, prView: WATCH_VIEW });

    const out = (await handlers.get("command.run")!($, { command: "lights", args: "watch acme/widgets#77" }, NEXT)) as {
      text: string;
    };

    const argvs = ($.process.run as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as string[]).join(" "));
    // Every gh call targets the WATCHED repo, not the session repo.
    expect(argvs).toContain("gh pr view 77 --json headRefOid,state,mergeStateStatus,baseRefName -R acme/widgets");
    expect(argvs.some((a) => a.includes("repos/acme/widgets/commits/feedbee1234567/check-runs"))).toBe(true);
    expect(argvs.some((a) => a.includes("yonatangross/orchestkit"))).toBe(false);

    // Stored under the SESSION repo key so ui.render finds it.
    const stored = ($.store.set as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => /^lights:yonatangross\/orchestkit:/.test(String(c[0])) && (c[1] as { lights?: unknown }).lights
    )?.[1] as { lights: Array<{ name: string; color: string }>; label: string; passing: boolean; mode: string };
    expect(stored.mode).toBe("watch");
    expect(stored.label).toBe("watch acme/widgets#77");
    expect(stored.lights.map((l) => `${l.name}:${l.color}`)).toEqual(["build:green", "lint:red", "e2e:yellow"]);
    expect(stored.passing).toBe(false);

    expect(out.text).toContain("watch acme/widgets#77");
    expect(out.text).toContain("1 green");
    expect(out.text).toContain("1 red");
    expect($.ui.status).toHaveBeenCalledWith(expect.stringContaining("watch acme/widgets#77"));
    expect($.clock.every).toHaveBeenCalledWith(60000, expect.any(Function));
  });

  test("/lights watch with a bad target answers with usage and runs nothing", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$();
    const out = (await handlers.get("command.run")!($, { command: "lights", args: "watch nonsense" }, NEXT)) as {
      text: string;
    };
    expect(out.text).toContain("usage: /lights watch");
    expect($.process.run).not.toHaveBeenCalled();
  });

  test("/lights watch on a closed PR refuses and starts no tick", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$({ prView: JSON.stringify({ headRefOid: "x", state: "MERGED", mergeStateStatus: "" }) });
    const out = (await handlers.get("command.run")!($, { command: "lights", args: "watch acme/widgets 5" }, NEXT)) as {
      text: string;
    };
    expect(out.text).toBe("lights: acme/widgets#5 is MERGED, not open");
    expect($.clock.every).not.toHaveBeenCalled();
  });

  test("PROMOTE_LIGHTS_WATCH at session.start watches with no typing and never lists promote PRs", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$({
      protection: "{}",
      rulesets: "[]",
      checkRuns: MIXED_RUNS,
      prView: WATCH_VIEW,
      envGet: vi.fn(async (k: string) => (k === "PROMOTE_LIGHTS_WATCH" ? "acme/widgets#77" : undefined)),
    });
    const next = vi.fn((_ev?: unknown) => Promise.resolve({}));

    await handlers.get("session.start")!($, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const argvs = ($.process.run as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as string[]).join(" "));
    expect(argvs.some((a) => a.startsWith("gh pr list"))).toBe(false);
    expect($.store.set).toHaveBeenCalledWith(
      KEY,
      expect.objectContaining({ label: "watch acme/widgets#77", mode: "watch" })
    );
  });

  test("a watched PR with no check runs stores a visible error instead of lights", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$({
      protection: "{}",
      rulesets: "[]",
      checkRuns: JSON.stringify({ total_count: 0, check_runs: [] }),
      prView: WATCH_VIEW,
    });
    await handlers.get("command.run")!($, { command: "lights", args: "watch acme/widgets#77" }, NEXT);
    expect($.store.set).toHaveBeenCalledWith(
      KEY,
      expect.objectContaining({ error: "watch acme/widgets#77: no check runs on feedbee" })
    );
  });

  test("a re-watch cancels the previous tick before starting the next", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$({ protection: "{}", rulesets: "[]", checkRuns: MIXED_RUNS, prView: WATCH_VIEW });
    await handlers.get("command.run")!($, { command: "lights", args: "watch acme/widgets#77" }, NEXT);
    await handlers.get("command.run")!($, { command: "lights", args: "watch acme/widgets#78" }, NEXT);

    const handles = ($.clock.every as ReturnType<typeof vi.fn>).mock.results.map(
      (r) => r.value as { cancel: ReturnType<typeof vi.fn> }
    );
    expect(handles).toHaveLength(2);
    expect(handles[0].cancel).toHaveBeenCalledTimes(1);
    expect(handles[1].cancel).not.toHaveBeenCalled();
  });

  test("session.start stops a running watch and forgets it (no stale tick after /clear)", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$({ protection: "{}", rulesets: "[]", checkRuns: MIXED_RUNS, prView: WATCH_VIEW, prList: "[]" });
    await handlers.get("command.run")!($, { command: "lights", args: "watch acme/widgets#77" }, NEXT);
    const handle = ($.clock.every as ReturnType<typeof vi.fn>).mock.results[0]
      .value as { cancel: ReturnType<typeof vi.fn> };

    // A new session with no watch configured and no promote PR open.
    await handlers.get("session.start")!($, {}, NEXT);

    expect(handle.cancel).toHaveBeenCalledTimes(1);
    expect($.store.delete).toHaveBeenCalledWith(KEY);
    expect($.clock.every).toHaveBeenCalledTimes(1);

    // Nothing is tracked any more: a refresh runs no gh call at all.
    const callsBefore = ($.process.run as ReturnType<typeof vi.fn>).mock.calls.length;
    await handlers.get("command.run")!($, { command: "lights", args: "refresh" }, NEXT);
    expect(($.process.run as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore);
    const out = (await handlers.get("command.run")!($, { command: "lights" }, NEXT)) as { text: string };
    expect(out.text).toContain("no promote PR open");
  });

  test("a watched PR reads its OWN base branch protection and rules, never main's", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$({
      checkRuns: MIXED_RUNS,
      prView: JSON.stringify({ headRefOid: "feedbee1234567", state: "OPEN", mergeStateStatus: "BLOCKED", baseRefName: "dev" }),
    });
    await handlers.get("command.run")!($, { command: "lights", args: "watch acme/widgets#77" }, NEXT);

    const argvs = ($.process.run as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as string[]).join(" "));
    expect(argvs).toContain("gh api repos/acme/widgets/branches/dev/protection");
    expect(argvs).toContain("gh api repos/acme/widgets/rules/branches/dev");
    expect(argvs.some((a) => a.includes("/branches/main"))).toBe(false);
  });

  test("a base branch with a slash is URL-encoded in the protection path", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$({
      checkRuns: MIXED_RUNS,
      prView: JSON.stringify({ headRefOid: "feedbee1234567", state: "OPEN", mergeStateStatus: "BLOCKED", baseRefName: "release/1.0" }),
    });
    await handlers.get("command.run")!($, { command: "lights", args: "watch acme/widgets#77" }, NEXT);

    const argvs = ($.process.run as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as string[]).join(" "));
    expect(argvs).toContain("gh api repos/acme/widgets/branches/release%2F1.0/protection");
    expect(argvs).toContain("gh api repos/acme/widgets/rules/branches/release%2F1.0");
  });

  test("a PROMOTE PR with an empty required union still refuses green (no fallback outside watch)", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$({ protection: "{}", rulesets: "[]", checkRuns: MIXED_RUNS });
    await handlers.get("session.start")!($, {}, NEXT);
    expect($.store.set).toHaveBeenCalledWith(
      KEY,
      expect.objectContaining({ error: "empty required contexts" })
    );
    const argvs = ($.process.run as ReturnType<typeof vi.fn>).mock.calls.map((c) => (c[0] as string[]).join(" "));
    expect(argvs.some((a) => a.includes("check-runs"))).toBe(false);
  });
});

describe("ui.render draws with $.ui.resolve elements", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  /** Walk a fake tree and collect every node. */
  function nodes(tree: unknown): FakeNode[] {
    const out: FakeNode[] = [];
    const walk = (n: unknown) => {
      if (n && typeof n === "object" && "type" in (n as object)) {
        out.push(n as FakeNode);
        for (const c of (n as FakeNode).children ?? []) walk(c);
      }
    };
    walk(tree);
    return out;
  }

  test("every node of the band comes from a resolved constructor and each light is colored", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$();
    ($.store.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: currentToken(),
      prNumber: 77,
      head: "feedbee1234567",
      label: "watch acme/widgets#77",
      mergeStateStatus: "BLOCKED",
      lights: [
        { name: "build", color: "green", conclusion: "success" },
        { name: "lint", color: "red", conclusion: "failure" },
        { name: "e2e", color: "yellow", conclusion: null },
        { name: "deploy", color: "cancelled", conclusion: "cancelled" },
      ],
    });
    const e = { component: "AbovePrompt", props: {} };
    const out = await handlers.get("ui.render")!($, e, vi.fn((_ev?: unknown) => Promise.resolve(null)));

    expect($.ui.resolve).toHaveBeenCalledWith(e);
    const all = nodes(out);
    // Only Box and Text, the resolved constructors: no hand-rolled node types.
    expect(new Set(all.map((n) => n.type))).toEqual(new Set(["Box", "Text"]));
    const colored = (name: string) =>
      all.find((n) => n.type === "Text" && n.children.some((c) => typeof c === "string" && c.includes(name)))?.props.color;
    // Green checks are counted in the summary, not listed; every problem gets its own colored line.
    expect(colored("build")).toBeUndefined();
    expect(colored("lint")).toBe("red");
    expect(colored("e2e")).toBe("yellow");
    expect(colored("deploy")).toBe("yellow");
    expect(JSON.stringify(out)).toContain("acme/widgets#77");
    expect(JSON.stringify(out)).toContain("feedbee  BLOCKED");
  });

  test("a stored error draws one dim line instead of nothing", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$();
    ($.store.get as ReturnType<typeof vi.fn>).mockResolvedValue({ error: "empty required contexts", prNumber: 4165, session: currentToken() });
    const DOWN = { type: "Box", props: {}, children: ["cc band"] };
    const out = (await handlers.get("ui.render")!(
      $,
      { component: "AbovePrompt", props: {} },
      vi.fn((_ev?: unknown) => Promise.resolve(DOWN))
    )) as FakeNode;

    expect(out.type).toBe("Box");
    expect(out.children).toHaveLength(2);
    expect(out.children[1]).toBe(DOWN);
    const errorText = nodes(out.children[0]).find((n) => n.type === "Text");
    expect(errorText?.props.dimColor).toBe(true);
    expect(errorText?.children).toEqual(["lights: empty required contexts"]);
  });

  test("/lights reports a stored error in words", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$();
    ($.store.get as ReturnType<typeof vi.fn>).mockResolvedValue({ error: "head moved, stopped", session: currentToken() });
    const out = (await handlers.get("command.run")!($, { command: "lights", args: "" }, NEXT)) as { text: string };
    expect(out.text).toBe("lights: head moved, stopped");
  });
});

describe("a previous process's lights are never drawn", () => {
  // Measured on CC 2.1.283: ui.render can run before session.start clears
  // the key, and the new session drew the previous session's lights.
  const FOREIGN = {
    prNumber: 4435,
    label: "watch yonatangross/orchestkit#4435",
    head: "3afff24aa",
    mergeStateStatus: "DIRTY",
    hold: false,
    lights: [{ name: "Build", color: "green", conclusion: "success" }],
  };
  const DOWN = { type: "Box", props: {}, children: ["cc band"] };

  test("ui.render before session.start returns only the downstream tree for an entry from another process", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$();
    ($.store.get as ReturnType<typeof vi.fn>).mockResolvedValue({ ...FOREIGN, session: "another-process" });
    const out = await handlers.get("ui.render")!($, { component: "AbovePrompt", props: {} }, () => Promise.resolve(DOWN));
    expect(out).toBe(DOWN);
  });

  test("an entry with no token at all (written by an older version) is ignored too", async () => {
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$();
    ($.store.get as ReturnType<typeof vi.fn>).mockResolvedValue(FOREIGN);
    const out = await handlers.get("ui.render")!($, { component: "AbovePrompt", props: {} }, () => Promise.resolve(DOWN));
    expect(out).toBe(DOWN);
    const text = (await handlers.get("command.run")!($, { command: "lights", args: "" }, NEXT)) as { text: string };
    expect(text.text).not.toContain("4435");
  });
});

/** One Map shared by several fake $ objects: two live sessions on one machine share $.store. */
function sharedStore(): { map: Map<string, unknown>; store: Record<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    store: {
      get: vi.fn(async (k: string) => (map.has(k) ? map.get(k) : null)),
      set: vi.fn(async (k: string, v: unknown) => {
        map.set(k, v);
      }),
      delete: vi.fn(async (k: string) => {
        map.delete(k);
      }),
    },
  };
}

describe("two live sessions on the same repo keep their own bands", () => {
  const DOWN = { type: "Box", props: {}, children: ["cc band"] };
  const bandText = (out: unknown): string => JSON.stringify(out);

  test("each session still draws its own watched PR after the other one writes", async () => {
    const shared = sharedStore();
    const watch = (target: string) =>
      vi.fn(async (k: string) => (k === "PROMOTE_LIGHTS_WATCH" ? target : undefined));

    // Two module instances = two Claude Code processes, one store.
    const a = captureHandlers(await loadRegister());
    const $a = createFake$({ protection: "{}", rulesets: "[]", checkRuns: MIXED_RUNS, prView: WATCH_VIEW, envGet: watch("acme/widgets#77") });
    $a.store = shared.store as never;
    await a.get("session.start")!($a, {}, NEXT);

    const b = captureHandlers(await loadRegister());
    const $b = createFake$({ protection: "{}", rulesets: "[]", checkRuns: MIXED_RUNS, prView: WATCH_VIEW, envGet: watch("acme/widgets#88") });
    $b.store = shared.store as never;
    await b.get("session.start")!($b, {}, NEXT);

    const outA = await a.get("ui.render")!($a, { component: "AbovePrompt", props: {} }, () => Promise.resolve(DOWN));
    const outB = await b.get("ui.render")!($b, { component: "AbovePrompt", props: {} }, () => Promise.resolve(DOWN));
    expect(bandText(outA)).toContain("acme/widgets#77");
    expect(bandText(outA)).not.toContain("acme/widgets#88");
    expect(bandText(outB)).toContain("acme/widgets#88");
    expect(shared.map.size).toBe(2);
  });
});

describe("a /clear inside one process never draws the previous session's lights", () => {
  test("session.start rotates the token, so an entry from before it is ignored and its key removed", async () => {
    const shared = sharedStore();
    const handlers = captureHandlers(await loadRegister());
    const $ = createFake$({ prList: "[]" });
    $.store = shared.store as never;
    const before = currentToken();
    const oldKey = `lights:yonatangross/orchestkit:${before}`;
    shared.map.set(oldKey, {
      prNumber: 1,
      label: "watch old/repo#1",
      lights: [{ name: "Build", color: "green", conclusion: "success" }],
      session: before,
    });

    await handlers.get("session.start")!($, {}, NEXT);

    expect(currentToken()).not.toBe(before);
    expect(shared.map.has(oldKey)).toBe(false);
    const DOWN = { type: "Box", props: {}, children: ["cc band"] };
    const out = await handlers.get("ui.render")!($, { component: "AbovePrompt", props: {} }, () => Promise.resolve(DOWN));
    expect(out).toBe(DOWN);
  });
});
