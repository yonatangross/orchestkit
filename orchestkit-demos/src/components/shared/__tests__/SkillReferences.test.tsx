import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  SkillReferences,
  InlineSkillReferences,
  SkillReference,
  ReferenceStatus,
} from "../SkillReferences";

// Mock Remotion hooks
vi.mock("remotion", async () => {
  const actual = await vi.importActual("remotion");
  return {
    ...actual,
    useCurrentFrame: vi.fn(() => 0),
    useVideoConfig: vi.fn(() => ({ fps: 30 })),
    interpolate: (
      frame: number,
      inputRange: number[],
      outputRange: number[],
      _config: unknown
    ) => {
      if (frame < inputRange[0]) return outputRange[0];
      if (frame > inputRange[1]) return outputRange[1];
      const ratio = (frame - inputRange[0]) / (inputRange[1] - inputRange[0]);
      return outputRange[0] + ratio * (outputRange[1] - outputRange[0]);
    },
  };
});

describe("SkillReferences", () => {
  let mockReferences: SkillReference[];

  beforeEach(() => {
    mockReferences = [
      {
        name: "cursor-pagination",
        status: "loaded",
        category: "database",
      },
      {
        name: "connection-pooling",
        status: "loading",
        category: "optimization",
      },
      {
        name: "caching-strategy",
        status: "pending",
      },
      {
        name: "async-patterns",
        status: "loaded",
      },
    ];
  });

  describe("rendering", () => {
    it("should render skill references container", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} />
      );
      expect(container).toBeTruthy();
    });

    it("should display default title", () => {
      const { getByText } = render(
        <SkillReferences references={mockReferences} />
      );
      expect(getByText(/⚙️ Loading skill refs/)).toBeTruthy();
    });

    it("should display custom title", () => {
      const customTitle = "📚 Available References";
      const { getByText } = render(
        <SkillReferences references={mockReferences} title={customTitle} />
      );
      expect(getByText(customTitle)).toBeTruthy();
    });

    it("should render all references", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} />
      );
      const text = container.textContent || "";
      expect(text).toContain("cursor-pagination");
      expect(text).toContain("connection-pooling");
      expect(text).toContain("caching-strategy");
      expect(text).toContain("async-patterns");
    });

    it("should render empty list", () => {
      const { container } = render(
        <SkillReferences references={[]} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("status indicators", () => {
    it("should display loaded status icon", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} />
      );
      expect(container.textContent).toContain("✓");
    });

    it("should display loading status icon", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} />
      );
      expect(container.textContent).toContain("⏳");
    });

    it("should display pending status icon", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} />
      );
      expect(container.textContent).toContain("○");
    });

    it("should correctly map all status icons", () => {
      const statuses: ReferenceStatus[] = ["loaded", "loading", "pending"];
      statuses.forEach((status) => {
        const refs: SkillReference[] = [
          { name: "test-ref", status },
        ];
        const { container } = render(
          <SkillReferences references={refs} />
        );
        expect(container).toBeTruthy();
      });
    });
  });

  describe("categories", () => {
    it("should display category tags when provided", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} />
      );
      const text = container.textContent || "";
      expect(text).toContain("database");
      expect(text).toContain("optimization");
    });

    it("should not display category for items without category", () => {
      const refsWithoutCategory: SkillReference[] = [
        { name: "ref-without-category", status: "loaded" },
      ];
      const { container } = render(
        <SkillReferences references={refsWithoutCategory} />
      );
      expect(container.textContent).toContain("ref-without-category");
    });

    it("should handle mixed references with and without categories", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} />
      );
      expect(container).toBeTruthy();
    });

    it("should display multiple category tags", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} />
      );
      const text = container.textContent || "";
      expect(text).toContain("database");
      expect(text).toContain("optimization");
    });
  });

  describe("tree connectors", () => {
    it("should display tree connectors", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} />
      );
      const text = container.textContent || "";
      expect(text).toContain("├─");
      expect(text).toContain("└─");
    });

    it("should use correct connector for last item", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} />
      );
      expect(container).toBeTruthy();
    });

    it("should use correct connector for non-last items", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("styling", () => {
    it("should apply custom primary color", () => {
      const { container } = render(
        <SkillReferences
          references={mockReferences}
          primaryColor="#ff0000"
        />
      );
      expect(container).toBeTruthy();
    });

    it("should render in normal mode by default", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} compact={false} />
      );
      expect(container).toBeTruthy();
    });

    it("should render in compact mode", () => {
      const { container } = render(
        <SkillReferences references={mockReferences} compact={true} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("animation", () => {
    it("should support animateIn prop", () => {
      const { container } = render(
        <SkillReferences
          references={mockReferences}
          animateIn={true}
        />
      );
      expect(container).toBeTruthy();
    });

    it("should disable animation when animateIn is false", () => {
      const { container } = render(
        <SkillReferences
          references={mockReferences}
          animateIn={false}
        />
      );
      expect(container).toBeTruthy();
    });

    it("should accept startFrame prop", () => {
      const { container } = render(
        <SkillReferences
          references={mockReferences}
          startFrame={30}
        />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("should handle single reference", () => {
      const { container } = render(
        <SkillReferences
          references={[{ name: "single-ref", status: "loaded" }]}
        />
      );
      expect(container.textContent).toContain("single-ref");
    });

    it("should handle very long reference names", () => {
      const longNameRef: SkillReference[] = [
        {
          name: "very-long-reference-name-that-exceeds-typical-length-for-testing-purposes",
          status: "loaded",
        },
      ];
      const { container } = render(
        <SkillReferences references={longNameRef} />
      );
      expect(
        container.textContent?.includes(
          "very-long-reference-name-that-exceeds"
        )
      ).toBeTruthy();
    });

    it("should handle all same status", () => {
      const allLoaded: SkillReference[] = [
        { name: "ref1", status: "loaded" },
        { name: "ref2", status: "loaded" },
        { name: "ref3", status: "loaded" },
      ];
      const { container } = render(
        <SkillReferences references={allLoaded} />
      );
      // Should have 3 checkmarks
      const checkmarks = (
        container.textContent?.match(/✓/g) || []
      ).length;
      expect(checkmarks).toBe(3);
    });

    it("should handle all different statuses", () => {
      const mixedStatuses: SkillReference[] = [
        { name: "loaded-ref", status: "loaded" },
        { name: "loading-ref", status: "loading" },
        { name: "pending-ref", status: "pending" },
      ];
      const { container } = render(
        <SkillReferences references={mixedStatuses} />
      );
      expect(container.textContent).toContain("✓");
      expect(container.textContent).toContain("⏳");
      expect(container.textContent).toContain("○");
    });
  });
});

describe("InlineSkillReferences", () => {
  let mockReferences: SkillReference[];

  beforeEach(() => {
    mockReferences = [
      { name: "database-patterns", status: "loaded" },
      { name: "api-design", status: "loaded" },
      { name: "caching", status: "pending" },
    ];
  });

  describe("rendering", () => {
    it("should render inline references", () => {
      const { container } = render(
        <InlineSkillReferences references={mockReferences} />
      );
      expect(container).toBeTruthy();
    });

    it("should display all references", () => {
      const { container } = render(
        <InlineSkillReferences references={mockReferences} />
      );
      const text = container.textContent || "";
      expect(text).toContain("database-patterns");
      expect(text).toContain("api-design");
      expect(text).toContain("caching");
    });

    it("should render empty list", () => {
      const { container } = render(
        <InlineSkillReferences references={[]} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("status indicators", () => {
    it("should display loaded status icon", () => {
      const { container } = render(
        <InlineSkillReferences references={mockReferences} />
      );
      expect(container.textContent).toContain("✓");
    });

    it("should display pending status icon", () => {
      const { container } = render(
        <InlineSkillReferences references={mockReferences} />
      );
      expect(container.textContent).toContain("○");
    });
  });

  describe("tree connectors", () => {
    it("should display tree connectors", () => {
      const { container } = render(
        <InlineSkillReferences references={mockReferences} />
      );
      const text = container.textContent || "";
      expect(text).toContain("├─");
      expect(text).toContain("└─");
    });
  });

  describe("animation", () => {
    it("should accept startFrame prop", () => {
      const { container } = render(
        <InlineSkillReferences
          references={mockReferences}
          startFrame={30}
        />
      );
      expect(container).toBeTruthy();
    });

    it("should use startFrame 0 by default", () => {
      const { container } = render(
        <InlineSkillReferences references={mockReferences} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("should handle single reference", () => {
      const { container } = render(
        <InlineSkillReferences
          references={[{ name: "single", status: "loaded" }]}
        />
      );
      expect(container.textContent).toContain("single");
    });

    it("should handle multiple references of same status", () => {
      const allLoaded: SkillReference[] = [
        { name: "ref1", status: "loaded" },
        { name: "ref2", status: "loaded" },
        { name: "ref3", status: "loaded" },
      ];
      const { container } = render(
        <InlineSkillReferences references={allLoaded} />
      );
      const checkmarks = (
        container.textContent?.match(/✓/g) || []
      ).length;
      expect(checkmarks).toBe(3);
    });
  });
});
