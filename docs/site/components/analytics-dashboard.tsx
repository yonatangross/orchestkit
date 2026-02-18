"use client";

import { useState } from "react";
import type { AnalyticsExport } from "./analytics/types";
import { SAMPLE_DATA } from "./analytics/sample-data";
import { SummaryCards } from "./analytics/summary-cards";
import { ModelDelegationBar } from "./analytics/model-delegation-bar";
import { DailyCostChart } from "./analytics/daily-cost-chart";
import { RankedTable } from "./analytics/ranked-table";

/** Interactive analytics dashboard for visualizing Claude Code usage exports. */
export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsExport | null>(null);
  const [rawInput, setRawInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleLoad() {
    try {
      const parsed = JSON.parse(rawInput);
      if (!parsed.sessions || !parsed.modelUsage) {
        setError("Invalid format: missing sessions or modelUsage fields");
        return;
      }
      setError(null);
      setData(parsed);
    } catch {
      setError("Invalid JSON. Check your export and try again.");
    }
  }

  function handleSample() {
    setError(null);
    setData(SAMPLE_DATA);
    setRawInput(JSON.stringify(SAMPLE_DATA, null, 2));
  }

  function handleReset() {
    setData(null);
    setRawInput("");
    setError(null);
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <p className="text-[13px] text-fd-muted-foreground">
          Paste the JSON output from{" "}
          <code className="rounded bg-fd-muted/50 px-1 py-px text-[11px] text-fd-foreground/80">
            /ork:analytics export
          </code>{" "}
          below, or load sample data to preview the dashboard.
        </p>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder='{"exportDate":"...","sessions":{...},...}'
          rows={8}
          className="w-full rounded-md border border-fd-border bg-fd-card/40 px-3 py-2 font-mono text-[12px] text-fd-foreground placeholder:text-fd-muted-foreground/50 focus:border-fd-primary focus:outline-none"
        />
        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleLoad}
            disabled={!rawInput.trim()}
            className="rounded-md bg-fd-primary px-4 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Load Data
          </button>
          <button
            onClick={handleSample}
            className="rounded-md border border-fd-border px-4 py-1.5 text-[13px] text-fd-muted-foreground transition-colors hover:border-fd-primary/40 hover:text-fd-primary"
          >
            Load Sample
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-fd-muted-foreground">
          {data.period.from} to {data.period.to}
        </div>
        <button
          onClick={handleReset}
          className="rounded-md border border-fd-border px-3 py-1 text-[11px] text-fd-muted-foreground transition-colors hover:border-fd-primary/40 hover:text-fd-primary"
        >
          Reset
        </button>
      </div>

      <SummaryCards data={data} />
      <ModelDelegationBar data={data} />
      <DailyCostChart data={data} />

      <div className="grid gap-4 md:grid-cols-2">
        <RankedTable
          title="Top Agents"
          rows={data.topAgents.map((a) => ({
            name: a.name,
            count: a.count,
            detail: `${(a.avgMs / 1000).toFixed(1)}s avg`,
          }))}
        />
        <RankedTable
          title="Top Skills"
          rows={data.topSkills.map((s) => ({ name: s.name, count: s.count }))}
        />
      </div>
    </div>
  );
}
