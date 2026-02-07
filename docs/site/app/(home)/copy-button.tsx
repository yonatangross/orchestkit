"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { SITE } from "@/lib/constants";

export function CopyInstallButton() {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(SITE.installCommand);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="group/copy flex h-10 cursor-pointer items-center gap-2 rounded-md border border-fd-border bg-fd-secondary px-4 font-mono text-sm text-fd-secondary-foreground transition-colors hover:bg-fd-accent"
      aria-label={copied ? "Copied install command to clipboard" : "Copy install command to clipboard"}
    >
      <span className="text-fd-muted-foreground" aria-hidden="true">$</span>
      <span>{SITE.installCommand}</span>
      {copied ? (
        <Check className="ml-1 h-3.5 w-3.5 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
      ) : (
        <Copy className="ml-1 h-3.5 w-3.5 shrink-0 text-fd-muted-foreground transition-colors group-hover/copy:text-fd-primary" aria-hidden="true" />
      )}
    </button>
  );
}
