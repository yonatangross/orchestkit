"use client";

import type { AnalyticsExport } from "./types";
import { getModelLabel, getModelColor, formatTokens } from "./utils";

export function ModelDelegationBar({ data }: { data: AnalyticsExport }) {
  const entries = Object.entries(data.modelUsage);
  const totalSessions = entries.reduce((sum, [, m]) => sum + m.sessions, 0);

  return (
    <div className="rounded-md border border-fd-border bg-fd-card/60 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-fd-muted-foreground">Model Delegation</div>
      <div className="mt-2 flex h-6 overflow-hidden rounded-sm">
        {entries.map(([id, m]) => {
          const pct = (m.sessions / totalSessions) * 100;
          return (
            <div
              key={id}
              style={{ width: `${pct}%`, backgroundColor: getModelColor(id) }}
              className="flex items-center justify-center text-[10px] font-semibold text-white"
              title={`${getModelLabel(id)}: ${m.sessions} sessions (${pct.toFixed(0)}%)`}
            >
              {pct >= 12 ? `${getModelLabel(id)} ${pct.toFixed(0)}%` : ""}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {entries.map(([id, m]) => (
          <div key={id} className="flex items-center gap-1.5 text-[11px] text-fd-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: getModelColor(id) }} />
            {getModelLabel(id)}: {m.sessions} sessions &middot; {formatTokens(m.inputTokens + m.outputTokens)} tokens
            {m.cacheReadInputTokens ? ` · ${formatTokens(m.cacheReadInputTokens)} cached` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
