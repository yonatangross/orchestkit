import { describe, expect, it } from "vitest";
import { libraryTabHref, parseLibraryTab } from "@/lib/library-tab";

describe("library tab", () => {
  it("defaults to skills", () => {
    expect(parseLibraryTab(undefined)).toBe("skills");
    expect(parseLibraryTab("skills")).toBe("skills");
    expect(parseLibraryTab("nope")).toBe("skills");
  });

  it("accepts agents and hooks from the query string", () => {
    expect(parseLibraryTab("agents")).toBe("agents");
    expect(parseLibraryTab(["hooks"])).toBe("hooks");
  });

  it("keeps tab switches as real links", () => {
    expect(libraryTabHref("skills")).toBe("/#library");
    expect(libraryTabHref("agents")).toBe("/?lib=agents#library");
    expect(libraryTabHref("hooks")).toBe("/?lib=hooks#library");
  });
});
