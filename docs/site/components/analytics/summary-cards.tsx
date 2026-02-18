"use client";

import type { AnalyticsExport } from "./types";
import { formatTokens, formatCost } from "./utils";

export function SummaryCards({ data }: { data: AnalyticsExport }) {
  const totalTokens = Object.values(data.modelUsage).reduce(
    (sum, m) => sum + m.inputTokens + m.outputTokens, 0
  );
  const cards = [
    { label: "Sessions", value: String(data.sessions.count) },
    { label: "Total Tokens", value: formatTokens(totalTokens) },
    { label: "Total Cost", value: formatCost(data.costEstimate.total) },
    { label: "Cache Savings", value: formatCost(data.costEstimate.cacheSavings) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-md border border-fd-border bg-fd-card/60 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-fd-muted-foreground">{c.label}</div>
          <div className="mt-1 text-xl font-semibold text-fd-foreground">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
