"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Dagre from "@dagrejs/dagre";
import { useRouter } from "next/navigation";
import { GRAPH_NODES, GRAPH_EDGES } from "@/lib/generated/skill-graph-data";

// Category -> hex color
const CATEGORY_HEX: Record<string, string> = {
  backend: "#f59e0b",
  frontend: "#3b82f6",
  testing: "#22c55e",
  security: "#ef4444",
  "ai-llm": "#06b6d4",
  devops: "#f97316",
  product: "#ec4899",
  workflow: "#8b5cf6",
  other: "#64748b",
};

const NODE_W = 160;
const NODE_H = 40;

function layoutGraph(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
) {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 60 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  Dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
    };
  });
}

export function SkillDependencyGraph() {
  const router = useRouter();
  const [showIsolated, setShowIsolated] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { initialNodes, initialEdges, connectedCount, isolatedCount } =
    useMemo(() => {
      const connectedIds = new Set<string>();
      GRAPH_EDGES.forEach((e) => {
        connectedIds.add(e.source);
        connectedIds.add(e.target);
      });

      const filteredNodes = GRAPH_NODES.filter(
        (n) => showIsolated || connectedIds.has(n.id)
      );

      const rfNodes: Node[] = filteredNodes.map((n) => ({
        id: n.id,
        type: "default",
        data: { label: n.label },
        position: { x: 0, y: 0 },
        style: {
          background: CATEGORY_HEX[n.category] || CATEGORY_HEX.other,
          color: "#fff",
          border: n.type === "command" ? "2px solid #fff" : "1px solid rgba(255,255,255,0.3)",
          borderRadius: n.type === "command" ? "8px" : "16px",
          fontSize: "11px",
          fontWeight: n.type === "command" ? 700 : 400,
          padding: "6px 12px",
          width: NODE_W,
          textAlign: "center" as const,
        },
      }));

      const rfEdges: Edge[] = GRAPH_EDGES.filter(
        (e) =>
          filteredNodes.some((n) => n.id === e.source) &&
          filteredNodes.some((n) => n.id === e.target)
      ).map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        animated: false,
        style: { stroke: "#475569", strokeWidth: 1.5 },
      }));

      const laid = layoutGraph(rfNodes, rfEdges);
      return {
        initialNodes: laid,
        initialEdges: rfEdges,
        connectedCount: connectedIds.size,
        isolatedCount: GRAPH_NODES.length - connectedIds.size,
      };
    }, [showIsolated]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Re-layout when toggle changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      router.push(`/docs/reference/skills/${node.id}`);
    },
    [router]
  );

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_, node) => {
    setHoveredId(node.id);
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredId(null);
  }, []);

  // Highlight connected edges on hover
  const styledEdges = useMemo(() => {
    if (!hoveredId) return edges;
    return edges.map((e) => ({
      ...e,
      animated: e.source === hoveredId || e.target === hoveredId,
      style: {
        ...e.style,
        stroke:
          e.source === hoveredId || e.target === hoveredId
            ? "#58a6ff"
            : "#475569",
        strokeWidth:
          e.source === hoveredId || e.target === hoveredId ? 2.5 : 1.5,
      },
    }));
  }, [edges, hoveredId]);

  // Legend
  const legendItems = [
    { label: "Backend", color: CATEGORY_HEX.backend },
    { label: "Frontend", color: CATEGORY_HEX.frontend },
    { label: "Testing", color: CATEGORY_HEX.testing },
    { label: "Security", color: CATEGORY_HEX.security },
    { label: "AI/LLM", color: CATEGORY_HEX["ai-llm"] },
    { label: "DevOps", color: CATEGORY_HEX.devops },
    { label: "Product", color: CATEGORY_HEX.product },
    { label: "Workflow", color: CATEGORY_HEX.workflow },
    { label: "Other", color: CATEGORY_HEX.other },
  ];

  return (
    <div className="not-prose">
      {/* Controls bar */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2 text-fd-muted-foreground">
          <input
            type="checkbox"
            checked={showIsolated}
            onChange={(e) => setShowIsolated(e.target.checked)}
            className="rounded"
          />
          Show isolated skills ({isolatedCount})
        </label>
        <span className="text-fd-muted-foreground">
          {connectedCount} connected &middot; {GRAPH_EDGES.length} dependencies
        </span>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-3">
        {legendItems.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: item.color }}
            />
            {item.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
          <div className="h-4 w-6 rounded border-2 border-white/50" style={{ background: "#8b5cf6" }} />
          Command
        </div>
        <div className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
          <div className="h-4 w-6 rounded-full border border-white/20" style={{ background: "#64748b" }} />
          Reference
        </div>
      </div>

      {/* Graph */}
      <div className="h-[600px] w-full rounded-lg border border-fd-border bg-fd-card">
        <ReactFlow
          nodes={nodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => (n.style?.background as string) || "#64748b"}
            style={{ background: "var(--fd-card)" }}
          />
        </ReactFlow>
      </div>

      <p className="mt-2 text-xs text-fd-muted-foreground">
        Click a node to view its reference page. Hover to highlight connections.
        Drag to pan, scroll to zoom.
      </p>
    </div>
  );
}
