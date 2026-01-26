import { describe, it, expect } from "vitest";
import { ORCHESTKIT_STATS, VIDEO_CONFIG, COLORS } from "./constants";

describe("ORCHESTKIT_STATS", () => {
  it("should have correct skill count", () => {
    expect(ORCHESTKIT_STATS.skills).toBe(179);
  });

  it("should have correct agent count", () => {
    expect(ORCHESTKIT_STATS.agents).toBe(35);
  });

  it("should have correct hook count", () => {
    expect(ORCHESTKIT_STATS.hooks).toBe(144);
  });

  it("should have correct CC version", () => {
    expect(ORCHESTKIT_STATS.ccVersion).toBe("CC 2.1.16");
  });
});

describe("VIDEO_CONFIG", () => {
  it("should have standard 1080p dimensions", () => {
    expect(VIDEO_CONFIG.width).toBe(1920);
    expect(VIDEO_CONFIG.height).toBe(1080);
  });

  it("should have vertical dimensions (9:16)", () => {
    expect(VIDEO_CONFIG.verticalWidth).toBe(1080);
    expect(VIDEO_CONFIG.verticalHeight).toBe(1920);
  });

  it("should have 30 fps", () => {
    expect(VIDEO_CONFIG.fps).toBe(30);
  });
});

describe("COLORS", () => {
  it("should have valid hex colors", () => {
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    expect(COLORS.primary).toMatch(hexPattern);
    expect(COLORS.secondary).toMatch(hexPattern);
    expect(COLORS.accent).toMatch(hexPattern);
    expect(COLORS.background).toMatch(hexPattern);
  });

  it("should have purple as primary", () => {
    expect(COLORS.primary).toBe("#8b5cf6");
  });

  it("should have green as secondary", () => {
    expect(COLORS.secondary).toBe("#22c55e");
  });
});
