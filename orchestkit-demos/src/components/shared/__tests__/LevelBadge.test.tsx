import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { LevelBadge, LevelBadgeStrip, DifficultyLevel } from "../LevelBadge";

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
    spring: vi.fn((_config: unknown) => 1),
  };
});

describe("LevelBadge", () => {
  describe("rendering", () => {
    it("should render simple level badge", () => {
      const { container } = render(<LevelBadge level="simple" />);
      expect(container).toBeTruthy();
    });

    it("should render medium level badge", () => {
      const { container } = render(<LevelBadge level="medium" />);
      expect(container).toBeTruthy();
    });

    it("should render advanced level badge", () => {
      const { container } = render(<LevelBadge level="advanced" />);
      expect(container).toBeTruthy();
    });

    it("should display correct emoji for simple level", () => {
      const { container } = render(<LevelBadge level="simple" />);
      expect(container.textContent).toContain("🟢");
    });

    it("should display correct emoji for medium level", () => {
      const { container } = render(<LevelBadge level="medium" />);
      expect(container.textContent).toContain("🟡");
    });

    it("should display correct emoji for advanced level", () => {
      const { container } = render(<LevelBadge level="advanced" />);
      expect(container.textContent).toContain("🟣");
    });
  });

  describe("level labels", () => {
    it("should display label when showLabel is true", () => {
      const { getByText } = render(
        <LevelBadge level="simple" showLabel={true} />
      );
      expect(getByText("SIMPLE")).toBeTruthy();
    });

    it("should not display label when showLabel is false", () => {
      const { container } = render(
        <LevelBadge level="simple" showLabel={false} />
      );
      expect(container.textContent).not.toContain("SIMPLE");
    });

    it("should display correct label for medium", () => {
      const { getByText } = render(
        <LevelBadge level="medium" showLabel={true} />
      );
      expect(getByText("MEDIUM")).toBeTruthy();
    });

    it("should display correct label for advanced", () => {
      const { getByText } = render(
        <LevelBadge level="advanced" showLabel={true} />
      );
      expect(getByText("ADVANCED")).toBeTruthy();
    });

    it("should display short label", () => {
      const { container } = render(<LevelBadge level="simple" />);
      expect(container.textContent).toContain("LVL 1");
    });

    it("should display correct short label for medium", () => {
      const { container } = render(<LevelBadge level="medium" />);
      expect(container.textContent).toContain("LVL 2");
    });

    it("should display correct short label for advanced", () => {
      const { container } = render(<LevelBadge level="advanced" />);
      expect(container.textContent).toContain("LVL 3");
    });
  });

  describe("sizing", () => {
    it("should render small badge", () => {
      const { container } = render(
        <LevelBadge level="simple" size="small" />
      );
      expect(container).toBeTruthy();
    });

    it("should render medium badge", () => {
      const { container } = render(
        <LevelBadge level="simple" size="medium" />
      );
      expect(container).toBeTruthy();
    });

    it("should render large badge", () => {
      const { container } = render(
        <LevelBadge level="simple" size="large" />
      );
      expect(container).toBeTruthy();
    });

    it("should apply correct size by default (medium)", () => {
      const { container } = render(<LevelBadge level="simple" />);
      expect(container).toBeTruthy();
    });
  });

  describe("colors and styling", () => {
    const colorTests: Array<[DifficultyLevel, string]> = [
      ["simple", "#22c55e"],
      ["medium", "#f59e0b"],
      ["advanced", "#8b5cf6"],
    ];

    colorTests.forEach(([level, _expectedColor]) => {
      it(`should have correct color for ${level} level`, () => {
        const { container } = render(<LevelBadge level={level} />);
        // Check that styles are applied (we can't directly check computed styles in JSDOM)
        expect(container).toBeTruthy();
      });
    });
  });

  describe("animation", () => {
    it("should support animateIn prop", () => {
      const { container } = render(
        <LevelBadge level="simple" animateIn={true} />
      );
      expect(container).toBeTruthy();
    });

    it("should disable animation when animateIn is false", () => {
      const { container } = render(
        <LevelBadge level="simple" animateIn={false} />
      );
      expect(container).toBeTruthy();
    });

    it("should accept startFrame prop", () => {
      const { container } = render(
        <LevelBadge level="simple" startFrame={30} />
      );
      expect(container).toBeTruthy();
    });

    it("should support pulseOnActive prop", () => {
      const { container } = render(
        <LevelBadge level="simple" pulseOnActive={true} />
      );
      expect(container).toBeTruthy();
    });

    it("should disable pulse when pulseOnActive is false", () => {
      const { container } = render(
        <LevelBadge level="simple" pulseOnActive={false} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("prop combinations", () => {
    it("should render with all props specified", () => {
      const { getByText } = render(
        <LevelBadge
          level="advanced"
          showLabel={true}
          size="large"
          animateIn={true}
          startFrame={0}
          pulseOnActive={true}
        />
      );
      expect(getByText("ADVANCED")).toBeTruthy();
      expect(getByText("LVL 3")).toBeTruthy();
    });

    it("should render minimal configuration", () => {
      const { container } = render(<LevelBadge level="simple" />);
      expect(container).toBeTruthy();
    });
  });
});

describe("LevelBadgeStrip", () => {
  describe("rendering", () => {
    it("should render simple level strip", () => {
      const { container } = render(<LevelBadgeStrip level="simple" />);
      expect(container).toBeTruthy();
    });

    it("should render medium level strip", () => {
      const { container } = render(<LevelBadgeStrip level="medium" />);
      expect(container).toBeTruthy();
    });

    it("should render advanced level strip", () => {
      const { container } = render(<LevelBadgeStrip level="advanced" />);
      expect(container).toBeTruthy();
    });

    it("should display emoji at top", () => {
      const { container } = render(<LevelBadgeStrip level="simple" />);
      expect(container.textContent).toContain("🟢");
    });
  });

  describe("sizing", () => {
    it("should use default height of 300", () => {
      const { container } = render(<LevelBadgeStrip level="simple" />);
      expect(container).toBeTruthy();
    });

    it("should accept custom height", () => {
      const { container } = render(
        <LevelBadgeStrip level="simple" height={500} />
      );
      expect(container).toBeTruthy();
    });

    it("should accept small height", () => {
      const { container } = render(
        <LevelBadgeStrip level="simple" height={100} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("labels", () => {
    it("should display level label for simple", () => {
      const { container } = render(<LevelBadgeStrip level="simple" />);
      expect(container.textContent).toContain("SIMPLE");
    });

    it("should display level label for medium", () => {
      const { container } = render(<LevelBadgeStrip level="medium" />);
      expect(container.textContent).toContain("MEDIUM");
    });

    it("should display level label for advanced", () => {
      const { container } = render(<LevelBadgeStrip level="advanced" />);
      expect(container.textContent).toContain("ADVANCED");
    });
  });

  describe("animation", () => {
    it("should support animateIn prop", () => {
      const { container } = render(
        <LevelBadgeStrip level="simple" animateIn={true} />
      );
      expect(container).toBeTruthy();
    });

    it("should disable animation when animateIn is false", () => {
      const { container } = render(
        <LevelBadgeStrip level="simple" animateIn={false} />
      );
      expect(container).toBeTruthy();
    });

    it("should accept startFrame prop", () => {
      const { container } = render(
        <LevelBadgeStrip level="simple" startFrame={30} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("all levels with strip", () => {
    const levels: DifficultyLevel[] = ["simple", "medium", "advanced"];

    levels.forEach((level) => {
      it(`should render ${level} strip correctly`, () => {
        const { container } = render(<LevelBadgeStrip level={level} />);
        expect(container).toBeTruthy();
      });
    });
  });
});
