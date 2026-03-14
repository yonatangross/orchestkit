"use client";

import { useState } from "react";

export interface ComponentDNAProps {
  /** Name of the component */
  name: string;
  /** 21st.dev components used as building blocks */
  sources?: Array<{
    name: string;
    registry: string;
    url?: string;
  }>;
  /** Design tokens applied from Circuit Forge */
  tokens?: string[];
  /** Pre-filled /ork:design-to-code command for forking */
  forkCommand?: string;
}

export function ComponentDNA({ name, sources, tokens, forkCommand }: ComponentDNAProps) {
  const [open, setOpen] = useState(false);

  const copyForkCommand = () => {
    if (forkCommand) {
      navigator.clipboard.writeText(forkCommand);
    }
  };

  return (
    <div className="mt-4 rounded-lg border" style={{ borderColor: "var(--color-fd-border)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors"
        style={{ color: "var(--color-fd-muted-foreground)" }}
      >
        <svg className="h-3.5 w-3.5" style={{ color: "var(--color-fd-primary)" }} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2" />
        </svg>
        <span className="font-mono font-medium">Component DNA</span>
        <span className="ml-auto text-[10px]">{name}</span>
        <svg
          className="h-3 w-3 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      <div
        className="grid transition-all duration-200"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="border-t px-3 py-3 space-y-3" style={{ borderColor: "var(--color-fd-border)" }}>
            {/* Sources */}
            {sources && sources.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-fd-muted-foreground)" }}>
                  Built from
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sources.map((src) => (
                    <a
                      key={src.name}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono transition-colors"
                      style={{
                        background: "var(--color-fd-primary-10)",
                        color: "var(--color-fd-primary)",
                      }}
                    >
                      {src.name}
                      <span className="text-[9px]" style={{ color: "var(--color-fd-muted-foreground)" }}>
                        {src.registry}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Tokens */}
            {tokens && tokens.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-fd-muted-foreground)" }}>
                  Design tokens
                </p>
                <div className="flex flex-wrap gap-1">
                  {tokens.map((token) => (
                    <span
                      key={token}
                      className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                      style={{
                        background: "var(--color-fd-muted)",
                        color: "var(--color-fd-muted-foreground)",
                      }}
                    >
                      {token}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Fork command */}
            {forkCommand && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-fd-muted-foreground)" }}>
                  Fork this component
                </p>
                <button
                  onClick={copyForkCommand}
                  className="group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 font-mono text-[11px] transition-all"
                  style={{
                    background: "var(--color-fd-surface-sunken, var(--color-fd-muted))",
                    color: "var(--color-fd-foreground)",
                  }}
                >
                  <span className="truncate text-left flex-1">{forkCommand}</span>
                  <svg className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="5" y="5" width="8" height="8" rx="1.5" />
                    <path d="M3 11V3h8" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
