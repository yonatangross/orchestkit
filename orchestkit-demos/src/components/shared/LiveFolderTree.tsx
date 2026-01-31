import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

// File status types
export type FileStatus = "completed" | "writing" | "pending" | "modified";

export interface FileNode {
  name: string;
  status: FileStatus;
  lines?: number;
  children?: FileNode[];
}

export interface LiveFolderTreeProps {
  files: FileNode[];
  title?: string;
  totalFiles?: number;
  totalLines?: number;
  primaryColor?: string;
  showStats?: boolean;
  animateIn?: boolean;
  startFrame?: number;
}

const STATUS_ICONS: Record<FileStatus, string> = {
  completed: "✓",
  writing: "✨",
  pending: "○",
  modified: "~",
};

const STATUS_COLORS: Record<FileStatus, string> = {
  completed: "#22c55e",
  writing: "#f59e0b",
  pending: "#6b7280",
  modified: "#3b82f6",
};

const renderFileNode = (
  node: FileNode,
  depth: number,
  frame: number,
  fps: number,
  primaryColor: string,
  startFrame: number
): React.ReactNode => {
  const isDirectory = node.children && node.children.length > 0;
  const indent = depth * 20;
  const prefix = depth === 0 ? "" : "├── ";

  // Staggered animation for each item
  const itemDelay = depth * 3 + (node.name.length % 5);
  const opacity = interpolate(
    frame - startFrame,
    [itemDelay, itemDelay + 10],
    [0, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  const statusIcon = !isDirectory ? STATUS_ICONS[node.status] : "";
  const statusColor = !isDirectory ? STATUS_COLORS[node.status] : primaryColor;

  // Writing animation (blinking)
  const isWriting = node.status === "writing";
  const writingOpacity = isWriting
    ? 0.5 + 0.5 * Math.sin(frame * 0.3)
    : 1;

  return (
    <div key={`${depth}-${node.name}`} style={{ opacity }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingLeft: indent,
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 13,
          lineHeight: 1.6,
          color: isDirectory ? primaryColor : "#e2e8f0",
          opacity: writingOpacity,
        }}
      >
        <span style={{ color: "#4b5563" }}>{prefix}</span>
        {isDirectory && <span style={{ color: "#f59e0b" }}>📁</span>}
        <span>{node.name}</span>
        {!isDirectory && (
          <span style={{ color: statusColor, marginLeft: 4 }}>
            {statusIcon}
          </span>
        )}
        {node.lines && node.status === "completed" && (
          <span style={{ color: "#6b7280", fontSize: 11 }}>
            {node.lines} lines
          </span>
        )}
        {isWriting && (
          <span style={{ color: "#f59e0b", fontSize: 11 }}>
            writing...
          </span>
        )}
      </div>
      {node.children?.map((child) =>
        renderFileNode(child, depth + 1, frame, fps, primaryColor, startFrame)
      )}
    </div>
  );
};

export const LiveFolderTree: React.FC<LiveFolderTreeProps> = ({
  files,
  title = "📁 Project Structure",
  totalFiles,
  totalLines,
  primaryColor = "#8b5cf6",
  showStats = true,
  animateIn = true,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Container animation
  const containerOpacity = animateIn
    ? interpolate(frame - startFrame, [0, 15], [0, 1], {
        extrapolateRight: "clamp",
        extrapolateLeft: "clamp",
      })
    : 1;

  const containerScale = animateIn
    ? spring({
        frame: Math.max(0, frame - startFrame),
        fps,
        config: { damping: 80, stiffness: 200 },
      })
    : 1;

  return (
    <div
      style={{
        backgroundColor: "rgba(10, 10, 15, 0.95)",
        borderRadius: 8,
        padding: 16,
        border: `1px solid ${primaryColor}33`,
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: "1px solid #1f2937",
        }}
      >
        <span
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: "#f8fafc",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: "Menlo, Monaco, monospace",
            fontSize: 10,
            color: "#6b7280",
            backgroundColor: "#1f2937",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          Live
        </span>
      </div>

      {/* File Tree */}
      <div style={{ maxHeight: 200, overflow: "hidden" }}>
        {files.map((node) =>
          renderFileNode(node, 0, frame, fps, primaryColor, startFrame)
        )}
      </div>

      {/* Stats Footer */}
      {showStats && (totalFiles || totalLines) && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 8,
            borderTop: "1px solid #1f2937",
            display: "flex",
            gap: 16,
            fontFamily: "Menlo, Monaco, monospace",
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          {totalFiles && (
            <span>
              Files: <span style={{ color: primaryColor }}>{totalFiles}</span>
            </span>
          )}
          {totalLines && (
            <span>
              Lines: <span style={{ color: "#22c55e" }}>{totalLines}</span>
            </span>
          )}
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          marginTop: 8,
          display: "flex",
          gap: 12,
          fontFamily: "Menlo, Monaco, monospace",
          fontSize: 10,
          color: "#4b5563",
        }}
      >
        <span>
          <span style={{ color: STATUS_COLORS.writing }}>✨</span> writing
        </span>
        <span>
          <span style={{ color: STATUS_COLORS.completed }}>✓</span> done
        </span>
        <span>
          <span style={{ color: STATUS_COLORS.pending }}>○</span> pending
        </span>
      </div>
    </div>
  );
};
