"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import { GRAPH_NODES, GRAPH_EDGES } from "@/lib/generated/skill-graph-data";
import {
  CATEGORY_HEX,
  NODE_W,
  layoutGraph,
  FOCUS_TARGETS,
  getConnectedIds,
  getNeighborIds,
  LEGEND_ITEMS,
} from "@/lib/graph-layout";

function GraphInner() {
  const router = useRouter();
  const reactFlow = useReactFlow();
  const [showIsolated, setShowIsolated] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const initialFit = useRef(false);

  const connectedIds = useMemo(() => getConnectedIds(), []);

  const { initialNodes, initialEdges } = useMemo(() => {
    const filtered = GRAPH_NODES.filter(
      (n) => showIsolated || connectedIds.has(n.id)
    );

    const rfNodes: Node[] = filtered.map((n) => ({
      id: n.id,
      type: "default",
      data: { label: n.label },
      position: { x: 0, y: 0 },
      style: {
        background: CATEGORY_HEX[n.category] || CATEGORY_HEX.other,
        color: "#fff",
        border: n.type === "command" ? "2px solid #fff" : "1px solid rgba(255,255,255,0.3)",
        borderRadius: n.type === "command" ? "8px" : "16px",
        fontSize: "12px",
        fontWeight: n.type === "command" ? 700 : 400,
        padding: "8px 12px",
        width: NODE_W,
        textAlign: "center" as const,
        cursor: "pointer",
      },
    }));

    const filteredIds = new Set(filtered.map((n) => n.id));
    const rfEdges: Edge[] = GRAPH_EDGES.filter(
      (e) => filteredIds.has(e.source) && filteredIds.has(e.target)
    ).map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      animated: false,
      style: { stroke: "#475569", strokeWidth: 1.5 },
    }));

    return { initialNodes: layoutGraph(rfNodes, rfEdges), initialEdges: rfEdges };
  }, [showIsolated, connectedIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync ReactFlow state when layout changes (e.g. toggle isolated)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const focusOn = useCallback(
    (skillId: string | null) => {
      setFocusedId(skillId);
      if (!skillId) {
        setTimeout(() => reactFlow.fitView({ padding: 0.3, duration: 400 }), 50);
        return;
      }
      const neighborIds = getNeighborIds(skillId);
      const currentNodes = reactFlow.getNodes();
      const targetNodes = currentNodes.filter((n) => neighborIds.has(n.id));
      if (targetNodes.length > 0) {
        setTimeout(
          () => reactFlow.fitView({ nodes: targetNodes, padding: 0.5, duration: 400, maxZoom: 1.2 }),
          50
        );
      }
    },
    [reactFlow]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => router.push(`/docs/reference/skills/${node.id}`),
    [router]
  );
  const onNodeMouseEnter: NodeMouseHandler = useCallback((_, node) => setHoveredId(node.id), []);
  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => setHoveredId(null), []);

  // Dim non-focused nodes, highlight hovered edges
  const activeId = hoveredId || focusedId;
  const neighborSet = useMemo(() => (activeId ? getNeighborIds(activeId) : null), [activeId]);

  const styledNodes = useMemo(() => {
    if (!neighborSet) return nodes;
    return nodes.map((n) => ({
      ...n,
      style: { ...n.style, opacity: neighborSet.has(n.id) ? 1 : 0.2, transition: "opacity 0.2s" },
    }));
  }, [nodes, neighborSet]);

  const styledEdges = useMemo(() => {
    if (!activeId) return edges;
    return edges.map((e) => {
      const hit = e.source === activeId || e.target === activeId;
      return {
        ...e,
        animated: hit,
        style: {
          ...e.style,
          stroke: hit ? "#58a6ff" : "#475569",
          strokeWidth: hit ? 2.5 : 1,
          opacity: hit ? 1 : 0.15,
          transition: "opacity 0.2s",
        },
      };
    });
  }, [edges, activeId]);

  return (
    <div className="not-prose">
      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2 text-fd-muted-foreground">
          <input type="checkbox" checked={showIsolated} onChange={(e) => setShowIsolated(e.target.checked)} className="rounded" />
          Show isolated skills ({GRAPH_NODES.length - connectedIds.size})
        </label>
        <select
          value={focusedId || ""}
          onChange={(e) => focusOn(e.target.value || null)}
          className="rounded border border-fd-border bg-fd-card px-2 py-1 text-xs text-fd-foreground"
        >
          <option value="">Focus: All skills</option>
          {FOCUS_TARGETS.map((id) => (
            <option key={id} value={id}>{GRAPH_NODES.find((g) => g.id === id)?.label || id}</option>
          ))}
        </select>
        <span className="text-fd-muted-foreground">{connectedIds.size} connected &middot; {GRAPH_EDGES.length} deps</span>
      </div>

      <div className="mb-3 flex flex-wrap gap-3">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs text-fd-muted-foreground">
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
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

      <div className="h-[800px] w-full rounded-lg border border-fd-border bg-fd-card">
        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onInit={() => {
            if (!initialFit.current) {
              initialFit.current = true;
              setTimeout(() => focusOn("memory"), 100);
            }
          }}
          fitView
          fitViewOptions={{ padding: 0.4, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap nodeColor={(n) => (n.style?.background as string) || "#64748b"} style={{ background: "var(--fd-card)" }} />
        </ReactFlow>
      </div>

      <p className="mt-2 text-xs text-fd-muted-foreground">
        Click a node to view its reference page. Hover to highlight connections. Use the focus dropdown to zoom into a skill&apos;s neighborhood.
      </p>
    </div>
  );
}

export function SkillDependencyGraph() {
  return (
    <ReactFlowProvider>
      <GraphInner />
    </ReactFlowProvider>
  );
}
