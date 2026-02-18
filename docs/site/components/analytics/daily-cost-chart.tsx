"use client";

import type { AnalyticsExport } from "./types";
import { formatCost, formatDate } from "./utils";

export function DailyCostChart({ data }: { data: AnalyticsExport }) {
  const costs = data.dailyActivity.map((d) => d.cost ?? 0);
  const maxCost = Math.max(...costs, 0.01);

  return (
    <div className="rounded-md border border-fd-border bg-fd-card/60 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-fd-muted-foreground">Daily Cost</div>
      <div className="mt-3 flex items-end gap-1.5" style={{ height: 120 }}>
        {data.dailyActivity.map((d) => {
          const cost = d.cost ?? 0;
          const heightPct = (cost / maxCost) * 100;
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[9px] text-fd-muted-foreground">{formatCost(cost)}</span>
              <div
                className="w-full rounded-t-sm bg-fd-primary/70 transition-all"
                style={{ height: `${heightPct}%`, minHeight: cost > 0 ? 4 : 0 }}
                title={`${formatDate(d.date)}: ${formatCost(cost)}`}
              />
              <span className="text-[9px] text-fd-muted-foreground">{formatDate(d.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
