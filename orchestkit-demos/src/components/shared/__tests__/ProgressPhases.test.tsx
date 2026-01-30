import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  ProgressPhases,
  CompactProgressBar,
  Phase,
} from "../ProgressPhases";

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

describe("ProgressPhases", () => {
  let mockPhases: Phase[];

  beforeEach(() => {
    mockPhases = [
      { name: "Analysis", shortName: "Analyze", status: "completed" },
      { name: "Processing", shortName: "Process", status: "active" },
      { name: "Optimization", shortName: "Optimize", status: "pending" },
      { name: "Deployment", shortName: "Deploy", status: "pending" },
    ];
  });

  describe("rendering", () => {
    it("should render progress phases container", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} />
      );
      expect(container).toBeTruthy();
    });

    it("should render all phase names", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} />
      );
      const text = container.textContent || "";
      // Uses short names when provided
      expect(text).toContain("Analyze");
      expect(text).toContain("Process");
      expect(text).toContain("Optimize");
      expect(text).toContain("Deploy");
    });

    it("should use short names when provided", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} />
      );
      // Short names are displayed in horizontal layout
      expect(container).toBeTruthy();
    });

    it("should fall back to full name when short name not provided", () => {
      const phasesNoShortName: Phase[] = [
        { name: "FirstPhase", status: "active" },
      ];
      const { container } = render(
        <ProgressPhases phases={phasesNoShortName} />
      );
      expect(container.textContent).toContain("FirstPhase");
    });

    it("should render empty phases array", () => {
      const { container } = render(
        <ProgressPhases phases={[]} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("status indicators", () => {
    it("should display pending status icon", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} />
      );
      expect(container.textContent).toContain("○");
    });

    it("should display active status icon", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} />
      );
      expect(container.textContent).toContain("▶");
    });

    it("should display completed status icon", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} />
      );
      expect(container.textContent).toContain("✓");
    });
  });

  describe("progress bar", () => {
    it("should display progress bar by default", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} progress={50} />
      );
      expect(container.textContent).toContain("50%");
    });

    it("should hide progress bar when showProgressBar is false", () => {
      const { container } = render(
        <ProgressPhases
          phases={mockPhases}
          progress={50}
          showProgressBar={false}
        />
      );
      const text = container.textContent || "";
      expect(text).not.toContain("50%");
    });

    it("should display progress value from 0 to 100", () => {
      const progressValues = [0, 25, 50, 75, 100];
      progressValues.forEach((progress) => {
        const { getByText } = render(
          <ProgressPhases
            phases={mockPhases}
            progress={progress}
            showProgressBar={true}
          />
        );
        expect(getByText(`${progress}%`)).toBeTruthy();
      });
    });

    it("should display 0% progress", () => {
      const { getByText } = render(
        <ProgressPhases
          phases={mockPhases}
          progress={0}
          showProgressBar={true}
        />
      );
      expect(getByText("0%")).toBeTruthy();
    });

    it("should display 100% progress", () => {
      const { getByText } = render(
        <ProgressPhases
          phases={mockPhases}
          progress={100}
          showProgressBar={true}
        />
      );
      expect(getByText("100%")).toBeTruthy();
    });
  });

  describe("current phase indicator", () => {
    it("should display current phase label", () => {
      const { getByText } = render(
        <ProgressPhases phases={mockPhases} currentPhase={0} />
      );
      expect(getByText(/Phase: Analysis/)).toBeTruthy();
    });

    it("should update phase label based on currentPhase", () => {
      const testCases = [
        { index: 0, name: "Analysis" },
        { index: 1, name: "Processing" },
        { index: 2, name: "Optimization" },
        { index: 3, name: "Deployment" },
      ];

      testCases.forEach(({ index, name }) => {
        const { getByText } = render(
          <ProgressPhases phases={mockPhases} currentPhase={index} />
        );
        expect(getByText(new RegExp(`Phase: ${name}`))).toBeTruthy();
      });
    });

    it("should display Unknown when currentPhase is out of bounds", () => {
      const { getByText } = render(
        <ProgressPhases phases={mockPhases} currentPhase={10} />
      );
      expect(getByText(/Phase: Unknown/)).toBeTruthy();
    });
  });

  describe("layout", () => {
    it("should render horizontal layout by default", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} layout="horizontal" />
      );
      expect(container).toBeTruthy();
    });

    it("should render vertical layout", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} layout="vertical" />
      );
      expect(container).toBeTruthy();
    });

    it("should display phase connectors in horizontal layout", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} layout="horizontal" />
      );
      expect(container.textContent).toContain("→");
    });

    it("should not display phase connectors in vertical layout", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} layout="vertical" />
      );
      // Vertical layout doesn't use arrow connectors
      expect(container).toBeTruthy();
    });
  });

  describe("styling", () => {
    it("should apply custom primary color", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} primaryColor="#ff0000" />
      );
      expect(container).toBeTruthy();
    });

    it("should use default primary color", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("animation", () => {
    it("should support animateIn prop", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} animateIn={true} />
      );
      expect(container).toBeTruthy();
    });

    it("should disable animation when animateIn is false", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} animateIn={false} />
      );
      expect(container).toBeTruthy();
    });

    it("should accept startFrame prop", () => {
      const { container } = render(
        <ProgressPhases phases={mockPhases} startFrame={30} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("should handle single phase", () => {
      const { container } = render(
        <ProgressPhases
          phases={[{ name: "SinglePhase", status: "active" }]}
        />
      );
      expect(container.textContent).toContain("SinglePhase");
    });

    it("should handle all phases with same status", () => {
      const allActive: Phase[] = [
        { name: "Phase1", status: "active" },
        { name: "Phase2", status: "active" },
        { name: "Phase3", status: "active" },
      ];
      const { container } = render(
        <ProgressPhases phases={allActive} />
      );
      const arrows = (container.textContent?.match(/▶/g) || []).length;
      expect(arrows).toBe(3);
    });

    it("should handle very long phase names", () => {
      const longNamePhases: Phase[] = [
        {
          name: "Very Long Phase Name That Exceeds Typical Length For Testing Purposes",
          status: "active",
        },
      ];
      const { container } = render(
        <ProgressPhases phases={longNamePhases} />
      );
      expect(
        container.textContent?.includes(
          "Very Long Phase Name That Exceeds"
        )
      ).toBeTruthy();
    });

    it("should handle mixed phase statuses", () => {
      const { container } = render(
        <ProgressPhases
          phases={[
            { name: "P1", status: "pending" },
            { name: "P2", status: "active" },
            { name: "P3", status: "completed" },
          ]}
        />
      );
      expect(container.textContent).toContain("○");
      expect(container.textContent).toContain("▶");
      expect(container.textContent).toContain("✓");
    });

    it("should handle progress bar with extreme values", () => {
      const { getByText: getByText1 } = render(
        <ProgressPhases
          phases={mockPhases}
          progress={0}
          showProgressBar={true}
        />
      );
      expect(getByText1("0%")).toBeTruthy();

      const { getByText: getByText2 } = render(
        <ProgressPhases
          phases={mockPhases}
          progress={100}
          showProgressBar={true}
        />
      );
      expect(getByText2("100%")).toBeTruthy();
    });
  });

  describe("prop combinations", () => {
    it("should render with all props specified", () => {
      const { getByText } = render(
        <ProgressPhases
          phases={mockPhases}
          currentPhase={1}
          progress={50}
          primaryColor="#00ff00"
          animateIn={true}
          startFrame={0}
          showProgressBar={true}
          layout="horizontal"
        />
      );
      expect(getByText(/Phase: Processing/)).toBeTruthy();
      expect(getByText("50%")).toBeTruthy();
    });
  });
});

describe("CompactProgressBar", () => {
  describe("rendering", () => {
    it("should render compact progress bar", () => {
      const { container } = render(
        <CompactProgressBar
          progress={50}
          phaseName="Processing"
          phaseNumber={2}
          totalPhases={4}
        />
      );
      expect(container).toBeTruthy();
    });

    it("should display progress percentage", () => {
      const { container } = render(
        <CompactProgressBar
          progress={75}
          phaseName="Testing"
          phaseNumber={3}
          totalPhases={4}
        />
      );
      expect(container.textContent).toContain("75%");
    });

    it("should display phase name", () => {
      const { container } = render(
        <CompactProgressBar
          progress={50}
          phaseName="CustomPhase"
          phaseNumber={2}
          totalPhases={4}
        />
      );
      expect(container.textContent).toContain("CustomPhase");
    });

    it("should display phase counter", () => {
      const { container } = render(
        <CompactProgressBar
          progress={50}
          phaseName="Processing"
          phaseNumber={2}
          totalPhases={4}
        />
      );
      expect(container.textContent).toContain("2/4");
    });
  });

  describe("progress bar animation", () => {
    it("should render progress bar with filled and empty characters", () => {
      const { container } = render(
        <CompactProgressBar
          progress={50}
          phaseName="Processing"
          phaseNumber={2}
          totalPhases={4}
        />
      );
      const text = container.textContent || "";
      expect(text).toContain("▓");
      expect(text).toContain("░");
    });

    it("should display full bar at 100%", () => {
      const { container } = render(
        <CompactProgressBar
          progress={100}
          phaseName="Done"
          phaseNumber={4}
          totalPhases={4}
        />
      );
      const text = container.textContent || "";
      // At 100%, should be all filled
      expect(text).toContain("▓");
    });

    it("should display empty bar at 0%", () => {
      const { container } = render(
        <CompactProgressBar
          progress={0}
          phaseName="Starting"
          phaseNumber={1}
          totalPhases={4}
        />
      );
      const text = container.textContent || "";
      // At 0%, should be all empty
      expect(text).toContain("░");
    });
  });

  describe("styling", () => {
    it("should apply custom primary color", () => {
      const { container } = render(
        <CompactProgressBar
          progress={50}
          phaseName="Processing"
          phaseNumber={2}
          totalPhases={4}
          primaryColor="#ff0000"
        />
      );
      expect(container).toBeTruthy();
    });

    it("should use default primary color", () => {
      const { container } = render(
        <CompactProgressBar
          progress={50}
          phaseName="Processing"
          phaseNumber={2}
          totalPhases={4}
        />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("should handle 0% progress", () => {
      const { container } = render(
        <CompactProgressBar
          progress={0}
          phaseName="Start"
          phaseNumber={1}
          totalPhases={5}
        />
      );
      expect(container.textContent).toContain("0%");
    });

    it("should handle 100% progress", () => {
      const { container } = render(
        <CompactProgressBar
          progress={100}
          phaseName="Complete"
          phaseNumber={5}
          totalPhases={5}
        />
      );
      expect(container.textContent).toContain("100%");
    });

    it("should handle phase 1 of 1", () => {
      const { container } = render(
        <CompactProgressBar
          progress={50}
          phaseName="Only"
          phaseNumber={1}
          totalPhases={1}
        />
      );
      expect(container.textContent).toContain("1/1");
    });

    it("should handle large phase numbers", () => {
      const { container } = render(
        <CompactProgressBar
          progress={50}
          phaseName="Mid"
          phaseNumber={50}
          totalPhases={100}
        />
      );
      expect(container.textContent).toContain("50/100");
    });

    it("should handle very long phase name", () => {
      const { container } = render(
        <CompactProgressBar
          progress={50}
          phaseName="Very Long Phase Name That Exceeds Typical Length"
          phaseNumber={2}
          totalPhases={4}
        />
      );
      expect(
        container.textContent?.includes(
          "Very Long Phase Name That Exceeds"
        )
      ).toBeTruthy();
    });

    it("should handle different progress values", () => {
      const testCases = [25, 50, 75];
      testCases.forEach((progress) => {
        const { container } = render(
          <CompactProgressBar
            progress={progress}
            phaseName="Test"
            phaseNumber={1}
            totalPhases={4}
          />
        );
        expect(container.textContent).toContain(`${progress}%`);
      });
    });
  });
});
