import { describe, it, expect } from "vitest";
import { showcaseDemoSchema } from "./components/ShowcaseDemo";
import { videoDemoSchema } from "./components/VideoDemo";
import { cinematicDemoSchema } from "./components/CinematicDemo";
import { cinematicVerticalDemoSchema } from "./components/CinematicVerticalDemo";
import { hybridDemoSchema } from "./components/HybridDemo";
import { verticalDemoSchema } from "./components/VerticalDemo";
import { marketplaceIntroSchema } from "./components/MarketplaceIntro";

describe("ShowcaseDemo Schema", () => {
  it("should parse valid input with required fields", () => {
    const input = {
      terminalVideo: "videos/demo.mp4",
    };
    const result = showcaseDemoSchema.parse(input);
    expect(result.terminalVideo).toBe("videos/demo.mp4");
    expect(result.primaryColor).toBe("#8b5cf6"); // default
  });

  it("should apply default primaryColor", () => {
    const result = showcaseDemoSchema.parse({ terminalVideo: "test.mp4" });
    expect(result.primaryColor).toBe("#8b5cf6");
  });

  it("should allow custom primaryColor", () => {
    const result = showcaseDemoSchema.parse({
      terminalVideo: "test.mp4",
      primaryColor: "#ff0000",
    });
    expect(result.primaryColor).toBe("#ff0000");
  });

  it("should reject missing terminalVideo", () => {
    expect(() => showcaseDemoSchema.parse({})).toThrow();
  });
});

describe("VideoDemo Schema", () => {
  it("should parse valid input with required fields", () => {
    const input = {
      skillName: "explore",
      hook: "Understand any codebase",
      terminalVideo: "videos/explore.mp4",
    };
    const result = videoDemoSchema.parse(input);
    expect(result.skillName).toBe("explore");
    expect(result.hook).toBe("Understand any codebase");
    expect(result.terminalVideo).toBe("videos/explore.mp4");
  });

  it("should apply default values", () => {
    const result = videoDemoSchema.parse({
      skillName: "test",
      hook: "Test hook",
      terminalVideo: "test.mp4",
    });
    expect(result.primaryColor).toBe("#8b5cf6");
    expect(result.ccVersion).toBe("CC 2.1.16");
    expect(result.cta).toBe("/plugin install ork");
    expect(result.stats).toHaveLength(3);
    expect(result.problemPoints).toHaveLength(2);
  });

  it("should allow custom stats", () => {
    const result = videoDemoSchema.parse({
      skillName: "test",
      hook: "Test hook",
      terminalVideo: "test.mp4",
      stats: [{ value: "100", label: "custom" }],
    });
    expect(result.stats).toHaveLength(1);
    expect(result.stats[0].value).toBe("100");
  });

  it("should reject missing required fields", () => {
    expect(() => videoDemoSchema.parse({})).toThrow();
    expect(() => videoDemoSchema.parse({ skillName: "test" })).toThrow();
  });
});

describe("CinematicDemo Schema", () => {
  it("should require skillName, hook, terminalVideo, and results", () => {
    expect(() => cinematicDemoSchema.parse({})).toThrow();
  });

  it("should parse valid input", () => {
    const result = cinematicDemoSchema.parse({
      skillName: "explore",
      hook: "Understand any codebase",
      terminalVideo: "videos/explore.mp4",
      results: {
        before: "Hours of manual work",
        after: "Minutes with OrchestKit",
      },
    });
    expect(result.skillName).toBe("explore");
    expect(result.primaryColor).toBe("#8b5cf6");
    expect(result.hookDuration).toBe(60);
  });

  it("should allow custom durations", () => {
    const result = cinematicDemoSchema.parse({
      skillName: "test",
      hook: "Test hook",
      terminalVideo: "test.mp4",
      results: { before: "before", after: "after" },
      hookDuration: 120,
      terminalDuration: 600,
    });
    expect(result.hookDuration).toBe(120);
    expect(result.terminalDuration).toBe(600);
  });
});

describe("CinematicVerticalDemo Schema", () => {
  it("should require skillName, hook, terminalVideo, and results", () => {
    expect(() => cinematicVerticalDemoSchema.parse({})).toThrow();
  });

  it("should parse valid input with defaults", () => {
    const result = cinematicVerticalDemoSchema.parse({
      skillName: "explore",
      hook: "Understand any codebase",
      terminalVideo: "videos/explore.mp4",
      results: {
        before: "Hours of manual work",
        after: "Minutes with OrchestKit",
      },
    });
    expect(result.primaryColor).toBe("#8b5cf6");
    expect(result.ccVersion).toBe("CC 2.1.16");
    expect(result.hookDuration).toBe(45); // shorter for vertical
  });
});

describe("HybridDemo Schema", () => {
  it("should require skillName, hook, and terminalVideo", () => {
    expect(() => hybridDemoSchema.parse({})).toThrow();
  });

  it("should parse valid input", () => {
    const result = hybridDemoSchema.parse({
      skillName: "explore",
      hook: "Understand any codebase",
      terminalVideo: "videos/hybrid.mp4",
    });
    expect(result.terminalVideo).toBe("videos/hybrid.mp4");
    expect(result.primaryColor).toBe("#8b5cf6");
    expect(result.showHook).toBe(true);
    expect(result.showCTA).toBe(true);
  });

  it("should allow disabling hook and CTA", () => {
    const result = hybridDemoSchema.parse({
      skillName: "test",
      hook: "Test hook",
      terminalVideo: "test.mp4",
      showHook: false,
      showCTA: false,
    });
    expect(result.showHook).toBe(false);
    expect(result.showCTA).toBe(false);
  });
});

describe("VerticalDemo Schema", () => {
  it("should require skillName, hook, and terminalVideo", () => {
    expect(() => verticalDemoSchema.parse({})).toThrow();
  });

  it("should parse valid input with defaults", () => {
    const result = verticalDemoSchema.parse({
      skillName: "explore",
      hook: "Understand any codebase",
      terminalVideo: "videos/vertical.mp4",
    });
    expect(result.terminalVideo).toBe("videos/vertical.mp4");
    expect(result.primaryColor).toBe("#8b5cf6");
    expect(result.ccVersion).toBe("CC 2.1.16");
    expect(result.musicVolume).toBe(0.15);
  });
});

describe("MarketplaceIntro Schema", () => {
  it("should parse with all defaults", () => {
    const result = marketplaceIntroSchema.parse({});
    expect(result.primaryColor).toBe("#8b5cf6");
    expect(result.secondaryColor).toBe("#22c55e");
    expect(result.accentColor).toBe("#06b6d4");
  });

  it("should allow custom colors", () => {
    const result = marketplaceIntroSchema.parse({
      primaryColor: "#ff0000",
      secondaryColor: "#00ff00",
      accentColor: "#0000ff",
    });
    expect(result.primaryColor).toBe("#ff0000");
    expect(result.secondaryColor).toBe("#00ff00");
    expect(result.accentColor).toBe("#0000ff");
  });
});
