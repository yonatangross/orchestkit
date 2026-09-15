/**
 * Tests for register.ts - hook registration behavior.
 *
 * Uses a fake $ object to verify hook interactions without I/O.
 */

import { describe, test, expect, vi, beforeEach } from "vitest";

// Fake $ object type
interface Fake$ {
  session: {
    repo: ReturnType<typeof vi.fn>;
  };
  process: {
    run: ReturnType<typeof vi.fn>;
  };
  fs: {
    read: ReturnType<typeof vi.fn>;
  };
  clock: {
    every: ReturnType<typeof vi.fn>;
  };
  store: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete?: ReturnType<typeof vi.fn>;
  };
  ui: {
    status: ReturnType<typeof vi.fn>;
    invalidate: ReturnType<typeof vi.fn>;
  };
}

function createFake$(): Fake$ {
  return {
    session: {
      repo: vi.fn().mockResolvedValue({ owner: "yonatangross", name: "orchestkit" }),
    },
    process: {
      run: vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: "[]",
        stderr: "",
      }),
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

  test("command.register hooks for /lights", async () => {
    const { register } = await import("../hooks/register.ts");

    const on = vi.fn();
    register(on as unknown as Parameters<typeof register>[0]);

    const commandCall = on.mock.calls.find(
      (call) => call[0] === "command.register"
    );
    expect(commandCall).toBeTruthy();
  });
});

describe("fake $ behavior", () => {
  test("fake session.repo returns owner/name", async () => {
    const fake$ = createFake$();
    const repo = await fake$.session.repo();
    expect(repo).toEqual({ owner: "yonatangross", name: "orchestkit" });
  });

  test("fake process.run returns empty array", async () => {
    const fake$ = createFake$();
    const result = await fake$.process.run({
      argv: ["gh", "pr", "list"],
      init: {},
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("[]");
  });

  test("fake store.get returns null by default", async () => {
    const fake$ = createFake$();
    const value = await fake$.store.get("lights:test");
    expect(value).toBeNull();
  });
});
