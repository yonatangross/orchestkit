"use client";

export function RankedTable({ title, rows }: { title: string; rows: { name: string; count: number; detail?: string }[] }) {
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="rounded-md border border-fd-border bg-fd-card/60 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-fd-muted-foreground">{title}</div>
      <div className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="w-36 truncate text-[13px] text-fd-foreground/75 sm:w-44">{r.name}</span>
            <div className="relative flex-1">
              <div
                className="h-5 rounded-sm bg-fd-primary/20"
                style={{ width: `${(r.count / maxCount) * 100}%` }}
              />
              <span className="absolute inset-y-0 left-1.5 flex items-center text-[11px] font-medium text-fd-foreground/80">
                {r.count}
              </span>
            </div>
            {r.detail && (
              <span className="text-[10px] text-fd-muted-foreground">{r.detail}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
