"use client";

import { useState } from "react";
import { ADOPTION_WAVES, CC_SUPPORT, GENERATED_AT } from "@/lib/generated/cc-adoption-data";

const CATEGORY_LABEL: Record<string, string> = {
  breaking: "breaking",
  new_command: "new command",
  new_field: "new field",
  new_perm: "new permission",
  new_attr: "new attribute",
};

function ScoreMeter({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-1.5 w-14 overflow-hidden rounded-full"
        style={{ background: "var(--color-fd-muted)" }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${(score / 20) * 100}%`, background: "var(--color-fd-primary)" }}
        />
      </span>
      <span className="font-mono text-xs" style={{ color: "var(--color-fd-muted-foreground)" }}>
        {score}
      </span>
    </span>
  );
}

export function CcAdoptionBoard() {
  const [category, setCategory] = useState<string | null>(null);
  const categories = [...new Set(ADOPTION_WAVES.flatMap((w) => w.features.map((f) => f.category)))];

  return (
    <div className="my-6">
      {/* support matrix summary */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          { k: "Supported floor", v: CC_SUPPORT.supportedFloor },
          { k: "Latest adopted", v: CC_SUPPORT.latest },
          { k: "Latest known upstream", v: CC_SUPPORT.latestKnown },
        ].map((t) => (
          <div
            key={t.k}
            className="rounded-lg border p-4"
            style={{ borderColor: "var(--color-fd-border)", background: "var(--color-fd-card)" }}
          >
            <div className="font-mono text-xl font-bold" style={{ color: "var(--color-fd-foreground)" }}>
              {t.v}
            </div>
            <div className="mt-0.5 text-xs" style={{ color: "var(--color-fd-muted-foreground)" }}>
              {t.k}
            </div>
          </div>
        ))}
      </div>

      {/* category filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c === category ? null : c)}
            className="rounded-full border px-3 py-1 text-xs"
            style={{
              borderColor: c === category ? "var(--color-fd-primary)" : "var(--color-fd-border)",
              color: c === category ? "var(--color-fd-primary)" : "var(--color-fd-muted-foreground)",
            }}
          >
            {CATEGORY_LABEL[c] ?? c}
          </button>
        ))}
      </div>

      {/* waves */}
      {ADOPTION_WAVES.map((wave) => {
        const feats = category ? wave.features.filter((f) => f.category === category) : wave.features;
        if (feats.length === 0) return null;
        return (
          <div key={wave.version} className="mb-6">
            <h4 className="mb-2 font-mono text-sm font-semibold" style={{ color: "var(--color-fd-foreground)" }}>
              Claude Code {wave.version} · {feats.length} open gap{feats.length > 1 ? "s" : ""}
            </h4>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--color-fd-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide" style={{ color: "var(--color-fd-muted-foreground)" }}>
                    <th className="p-3 font-medium">Feature</th>
                    <th className="p-3 font-medium">Category</th>
                    <th className="p-3 font-medium">Gap score</th>
                    <th className="p-3 font-medium">Affected skills</th>
                  </tr>
                </thead>
                <tbody>
                  {feats.map((f) => (
                    <tr key={f.slug} className="border-t align-top" style={{ borderColor: "var(--color-fd-border)" }}>
                      <td className="p-3">
                        <div className="font-mono text-xs font-semibold" style={{ color: "var(--color-fd-foreground)" }}>
                          {f.slug}
                        </div>
                        <div className="mt-1 max-w-md text-xs leading-relaxed" style={{ color: "var(--color-fd-muted-foreground)" }}>
                          {f.description}
                        </div>
                      </td>
                      <td className="whitespace-nowrap p-3 text-xs">{CATEGORY_LABEL[f.category] ?? f.category}</td>
                      <td className="whitespace-nowrap p-3">
                        <ScoreMeter score={f.gapScore} />
                      </td>
                      <td className="p-3">
                        <div className="flex max-w-56 flex-wrap gap-1">
                          {f.affectedSkills.map((s) => (
                            <span
                              key={s}
                              className="rounded-full border px-2 py-0.5 text-[10px]"
                              style={{ borderColor: "var(--color-fd-border)", color: "var(--color-fd-muted-foreground)" }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <p className="text-xs" style={{ color: "var(--color-fd-muted-foreground)" }}>
        Generated at commit <code>{GENERATED_AT.commit}</code> on {GENERATED_AT.date} from{" "}
        <code>shared/cc-adoption-gaps.json</code> + <code>shared/cc-support.json</code>. Regenerates with every
        docs deploy; the gaps file holds the wave currently in triage.
      </p>
    </div>
  );
}
