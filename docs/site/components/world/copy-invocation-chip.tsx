"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Tiny client island: the copy button inside the otherwise
 * server-rendered skill-dossier invocation chip.
 */
export function CopyInvocationChip({ invocation }: { invocation: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(invocation).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="group/chip inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--yy-george-warm)]/40 bg-[var(--yy-george-warm)]/10 px-2 py-0.5 font-mono text-xs text-fd-foreground transition-colors hover:border-[var(--yy-george-warm)]"
      aria-label={
        copied
          ? `Copied ${invocation} to clipboard`
          : `Copy ${invocation} to clipboard`
      }
    >
      <span>{invocation}</span>
      <span aria-live="polite">
        {copied ? (
          <Check
            className="h-3 w-3 shrink-0 text-[var(--yy-george-warm)]"
            aria-hidden="true"
          />
        ) : (
          <Copy
            className="h-3 w-3 shrink-0 text-fd-muted-foreground transition-colors group-hover/chip:text-[var(--yy-george-warm)]"
            aria-hidden="true"
          />
        )}
      </span>
    </button>
  );
}
