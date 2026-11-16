import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryTerminal } from "@/components/library-terminal";
import { createRunPlayer } from "@/lib/library-player";
import { RUN, RUN_DONE, resolveRunLine } from "@/lib/library-run";

describe("run data", () => {
  it("has 20 lines: 7 skills, 4 agents, 9 hooks", () => {
    expect(RUN).toHaveLength(20);
    expect(RUN.filter((l) => l.kind === "skill")).toHaveLength(7);
    expect(RUN.filter((l) => l.kind === "agent")).toHaveLength(4);
    expect(RUN.filter((l) => l.kind === "hook")).toHaveLength(9);
  });

  it("drift: every run line is a real library item at the station the line shows", () => {
    for (const line of RUN) {
      const item = resolveRunLine(line);
      expect(item, `${line.kind} ${line.name}`).toBeDefined();
      expect(item?.station, `${line.kind} ${line.name}`).toBe(line.station);
    }
  });
});

describe("LibraryTerminal (server HTML)", () => {
  const doc = new DOMParser().parseFromString(
    renderToStaticMarkup(<LibraryTerminal />),
    "text/html",
  );

  it("renders all 20 lines as links and the done line, with no JS", () => {
    expect(doc.querySelectorAll(".term-line a[href]")).toHaveLength(20);
    expect(doc.querySelector("[data-term-done]")?.textContent).toContain(RUN_DONE);
  });

  it("keeps the controls and the live region out of the no-JS page", () => {
    expect(doc.querySelector("[data-term-ctl]")?.hasAttribute("hidden")).toBe(true);
    const live = doc.querySelector("[data-term-live]");
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.textContent).toBe("");
  });

  it("names the run as Claude Code's and lists the eight hosts", () => {
    expect(doc.querySelector(".term-title")?.textContent).toBe("orchestkit run · Claude Code");
    expect(doc.querySelector(".term-works")?.textContent).toMatch(/Claude Code .* Antigravity/);
    expect(doc.body.textContent).toContain("This run is Claude Code's. Hooks run in Claude Code today.");
  });

  it("sets html.term-anim only when motion is allowed, and drops it after 3 s", () => {
    const script = doc.querySelector("script")?.textContent ?? "";
    expect(script).toContain("prefers-reduced-motion: no-preference");
    expect(script).toContain("term-anim");
    expect(script).toContain("3000");
    expect(script).toContain("data-term-ready");
  });
});

describe("createRunPlayer", () => {
  function setup() {
    const queue: { fn: () => void; live: boolean }[] = [];
    let finishes = 0;
    const shown: number[] = [];
    const player = createRunPlayer({
      total: 20,
      lineDelayMs: 450,
      later: (fn) => {
        const t = { fn, live: true };
        queue.push(t);
        return () => {
          t.live = false;
        };
      },
      show: (i) => shown.push(i),
      reset: () => {
        shown.length = 0;
      },
      onFinish: () => {
        finishes += 1;
      },
    });
    const run = () => {
      let t = queue.shift();
      while (t && !t.live) t = queue.shift();
      t?.fn();
    };
    return { player, shown, run, finishes: () => finishes };
  }

  it("announces exactly once per run, however the run ends", () => {
    const { player, run, finishes } = setup();
    player.start();
    for (let i = 0; i < 30; i += 1) run();
    expect(player.state).toBe("finished");
    expect(finishes()).toBe(1);
    player.skip();
    expect(finishes()).toBe(1);
    player.replay();
    player.skip();
    expect(finishes()).toBe(2);
  });

  it("freezes while paused and resumes where it stopped", () => {
    const { player, shown, run } = setup();
    player.start();
    for (let i = 0; i < 4; i += 1) run();
    player.pause();
    const frozen = shown.length;
    run();
    expect(shown.length).toBe(frozen);
    player.start();
    run();
    expect(shown.length).toBeGreaterThan(frozen);
  });

  it("first run types only lines 10 to 20 and clears nothing", () => {
    const { player, shown, run, finishes } = setup();
    player.startFrom(9);
    for (let i = 0; i < 30; i += 1) run();
    expect(shown).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(player.state).toBe("finished");
    expect(finishes()).toBe(1);
  });

  it("shows the finished state at once without announcing (reduced motion)", () => {
    const { player, shown, finishes } = setup();
    player.showFinished();
    expect(shown).toHaveLength(20);
    expect(player.state).toBe("finished");
    expect(finishes()).toBe(0);
  });
});
