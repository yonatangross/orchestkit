import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  LiveFolderTree,
  FileNode,
} from "../LiveFolderTree";

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

describe("LiveFolderTree", () => {
  let mockFiles: FileNode[];

  beforeEach(() => {
    mockFiles = [
      {
        name: "src",
        status: "completed",
        children: [
          { name: "index.ts", status: "completed", lines: 42 },
          { name: "utils.ts", status: "writing" },
        ],
      },
      {
        name: "package.json",
        status: "completed",
        lines: 28,
      },
      {
        name: "README.md",
        status: "pending",
      },
    ];
  });

  describe("rendering", () => {
    it("should render file tree structure", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} />
      );
      expect(container).toBeTruthy();
    });

    it("should display default title", () => {
      const { getByText } = render(
        <LiveFolderTree files={mockFiles} />
      );
      expect(getByText(/📁 Project Structure/)).toBeTruthy();
    });

    it("should display custom title", () => {
      const customTitle = "🚀 Generated Files";
      const { getByText } = render(
        <LiveFolderTree files={mockFiles} title={customTitle} />
      );
      expect(getByText(customTitle)).toBeTruthy();
    });

    it("should render all file nodes", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} />
      );
      // Check that all file names appear in the rendered output
      const text = container.textContent || "";
      expect(text).toContain("src");
      expect(text).toContain("index.ts");
      expect(text).toContain("package.json");
    });

    it("should display folder emoji for directories", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} />
      );
      expect(container.textContent).toContain("📁");
    });

    it("should display Live badge", () => {
      const { getByText } = render(
        <LiveFolderTree files={mockFiles} />
      );
      expect(getByText("Live")).toBeTruthy();
    });
  });

  describe("status indicators", () => {
    it("should show status icon for completed files", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} />
      );
      expect(container.textContent).toContain("✓");
    });

    it("should show status icon for writing files", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} />
      );
      expect(container.textContent).toContain("✨");
    });

    it("should show status icon for pending files", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} />
      );
      expect(container.textContent).toContain("○");
    });

    it("should display writing status label", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} />
      );
      expect(container.textContent).toContain("writing...");
    });

    it("should display line count for completed files", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} />
      );
      const text = container.textContent || "";
      expect(text).toContain("42 lines");
      expect(text).toContain("28 lines");
    });

    it("should not display line count for writing files", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} />
      );
      // utils.ts is in writing status and doesn't have lines shown
      const text = container.textContent || "";
      expect(text).not.toContain("undefined lines");
    });
  });

  describe("stats footer", () => {
    it("should display stats footer when enabled", () => {
      const { getByText } = render(
        <LiveFolderTree
          files={mockFiles}
          showStats={true}
          totalFiles={5}
          totalLines={1500}
        />
      );
      expect(getByText(/Files:/)).toBeTruthy();
      expect(getByText(/Lines:/)).toBeTruthy();
    });

    it("should hide stats footer when disabled", () => {
      const { container } = render(
        <LiveFolderTree
          files={mockFiles}
          showStats={false}
          totalFiles={5}
          totalLines={1500}
        />
      );
      const text = container.textContent || "";
      expect(text).not.toContain("Files: 5");
    });

    it("should display only files when totalLines not provided", () => {
      const { container } = render(
        <LiveFolderTree
          files={mockFiles}
          showStats={true}
          totalFiles={5}
        />
      );
      const text = container.textContent || "";
      expect(text).toContain("Files:");
      expect(text).not.toContain("Lines:");
    });

    it("should display only lines when totalFiles not provided", () => {
      const { container } = render(
        <LiveFolderTree
          files={mockFiles}
          showStats={true}
          totalLines={1500}
        />
      );
      const text = container.textContent || "";
      expect(text).not.toContain("Files:");
      expect(text).toContain("Lines:");
    });
  });

  describe("legend", () => {
    it("should display legend section", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} />
      );
      const text = container.textContent || "";
      expect(text).toContain("writing");
      expect(text).toContain("done");
      expect(text).toContain("pending");
    });

    it("should show legend icons", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} />
      );
      const text = container.textContent || "";
      expect(text).toContain("✨");
      expect(text).toContain("✓");
      expect(text).toContain("○");
    });
  });

  describe("props and styling", () => {
    it("should apply custom primary color", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} primaryColor="#ff0000" />
      );
      expect(container).toBeTruthy();
    });

    it("should handle empty file array", () => {
      const { container } = render(<LiveFolderTree files={[]} />);
      expect(container).toBeTruthy();
      const text = container.textContent || "";
      expect(text).toContain("📁 Project Structure");
    });

    it("should handle deeply nested files", () => {
      const deepFiles: FileNode[] = [
        {
          name: "src",
          status: "completed",
          children: [
            {
              name: "components",
              status: "completed",
              children: [
                {
                  name: "shared",
                  status: "completed",
                  children: [
                    {
                      name: "Button.tsx",
                      status: "completed",
                      lines: 50,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
      const { container } = render(
        <LiveFolderTree files={deepFiles} />
      );
      expect(container.textContent).toContain("Button.tsx");
      expect(container.textContent).toContain("50 lines");
    });
  });

  describe("animation", () => {
    it("should accept animateIn prop", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} animateIn={true} />
      );
      expect(container).toBeTruthy();
    });

    it("should accept startFrame prop", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} startFrame={30} />
      );
      expect(container).toBeTruthy();
    });

    it("should disable animation when animateIn is false", () => {
      const { container } = render(
        <LiveFolderTree files={mockFiles} animateIn={false} />
      );
      expect(container).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("should handle files with modified status", () => {
      const filesWithModified: FileNode[] = [
        {
          name: "config.json",
          status: "modified",
          lines: 15,
        },
      ];
      const { container } = render(
        <LiveFolderTree files={filesWithModified} />
      );
      expect(container.textContent).toContain("~");
      expect(container.textContent).toContain("config.json");
    });

    it("should handle files without line numbers", () => {
      const filesNoLines: FileNode[] = [
        {
          name: "empty.txt",
          status: "completed",
        },
      ];
      const { container } = render(
        <LiveFolderTree files={filesNoLines} />
      );
      expect(container.textContent).toContain("empty.txt");
      const text = container.textContent || "";
      expect(text).not.toContain("undefined lines");
    });

    it("should handle very long file names", () => {
      const longNameFile: FileNode[] = [
        {
          name: "very-long-file-name-that-exceeds-normal-length-for-testing-purposes.tsx",
          status: "completed",
          lines: 100,
        },
      ];
      const { container } = render(
        <LiveFolderTree files={longNameFile} />
      );
      expect(
        container.textContent?.includes(
          "very-long-file-name-that-exceeds-normal-length"
        )
      ).toBeTruthy();
    });

    it("should handle large totalFiles and totalLines values", () => {
      const { getByText } = render(
        <LiveFolderTree
          files={mockFiles}
          showStats={true}
          totalFiles={999}
          totalLines={50000}
        />
      );
      expect(getByText(/999/)).toBeTruthy();
      expect(getByText(/50000/)).toBeTruthy();
    });

    it("should handle mixed status files in tree", () => {
      const mixedFiles: FileNode[] = [
        {
          name: "project",
          status: "completed",
          children: [
            { name: "completed.ts", status: "completed", lines: 10 },
            { name: "writing.ts", status: "writing" },
            { name: "pending.ts", status: "pending" },
            { name: "modified.ts", status: "modified", lines: 20 },
          ],
        },
      ];
      const { container } = render(
        <LiveFolderTree files={mixedFiles} />
      );
      expect(container.textContent).toContain("✓");
      expect(container.textContent).toContain("✨");
      expect(container.textContent).toContain("○");
      expect(container.textContent).toContain("~");
    });
  });
});
