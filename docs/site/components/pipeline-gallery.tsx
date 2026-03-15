"use client";

import { useState } from "react";
import { PIPELINE_ENTRIES, type PipelineEntry } from "@/lib/generated/pipeline-gallery-data";

function StageStep({ label, detail, step }: { label: string; detail: string; step: number }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ background: "var(--color-fd-primary-20)", color: "var(--color-fd-primary)" }}
        >
          {step}
        </div>
        {step < 3 && <div className="mt-1 h-full w-px" style={{ background: "var(--color-fd-border)" }} />}
      </div>
      <div className="pb-4">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-fd-primary)" }}>
          {label}
        </p>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--color-fd-muted-foreground)" }}>
          {detail}
        </p>
      </div>
    </div>
  );
}

function PipelineCard({ entry }: { entry: PipelineEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg border transition-all duration-200"
      style={{
        borderColor: "var(--color-fd-border)",
        background: "var(--color-fd-card)",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start justify-between p-5 text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold" style={{ color: "var(--color-fd-foreground)" }}>
              {entry.title}
            </h3>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
              style={{
                background: entry.complexity === "low"
                  ? "var(--color-fd-primary-10)"
                  : entry.complexity === "medium"
                    ? "var(--color-fd-primary-20)"
                    : "var(--color-fd-primary-30)",
                color: "var(--color-fd-primary)",
              }}
            >
              {entry.complexity}
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: "var(--color-fd-muted-foreground)" }}>
            {entry.description}
          </p>
          {/* Meta row */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: "var(--color-fd-muted-foreground)" }}>
            <span className="font-mono">{entry.durationSeconds}s</span>
            <span>{entry.output.linesOfCode} LOC</span>
            <span className="font-mono">{entry.output.path}</span>
          </div>
        </div>
        <svg
          className="ml-4 mt-1 h-4 w-4 shrink-0 transition-transform duration-200"
          style={{
            color: "var(--color-fd-muted-foreground)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {/* Expandable pipeline trace */}
      <div
        className="grid transition-all duration-200"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
        }}
      >
        <div className="overflow-hidden">
          <div
            className="border-t px-5 py-4"
            style={{ borderColor: "var(--color-fd-border)" }}
          >
            {/* Input */}
            <div className="mb-4 rounded-md p-3" style={{ background: "var(--color-fd-surface-sunken, var(--color-fd-muted))" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-fd-muted-foreground)" }}>
                Input ({entry.input.type})
              </p>
              <p className="mt-1 font-mono text-sm" style={{ color: "var(--color-fd-foreground)" }}>
                {entry.input.value}
              </p>
            </div>

            {/* Pipeline stages */}
            <StageStep label="Extract" detail={entry.stages.extract} step={1} />
            <StageStep label="Match" detail={entry.stages.match} step={2} />
            <StageStep label="Adapt" detail={entry.stages.adapt} step={3} />

            {/* Tags + MCP badges */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entry.mcpServers.map((mcp) => (
                <span
                  key={mcp}
                  className="rounded-full px-2 py-0.5 text-[10px] font-mono font-medium"
                  style={{
                    background: "var(--color-fd-primary-10)",
                    color: "var(--color-fd-primary)",
                  }}
                >
                  {mcp}
                </span>
              ))}
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{
                    background: "var(--color-fd-muted)",
                    color: "var(--color-fd-muted-foreground)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PipelineGallery() {
  return (
    <div className="mt-6 flex flex-col gap-3">
      {PIPELINE_ENTRIES.map((entry) => (
        <PipelineCard key={entry.id} entry={entry} />
      ))}
      {PIPELINE_ENTRIES.length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-fd-muted-foreground)" }}>
          No pipeline entries yet. Run <code>/ork:design-to-code</code> and submit your first entry!
        </p>
      )}
    </div>
  );
}
