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
      className="group/copy inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#1e293b] bg-[#111621] px-4 font-mono text-sm text-[#94a3b8] transition-colors hover:border-[#334155] hover:text-[#e2e8f0]"
      aria-label={copied ? "Copied install command to clipboard" : "Copy install command to clipboard"}
    >
      <span className="text-fd-muted-foreground" aria-hidden="true">$</span>
      <span>{SITE.installCommand}</span>
      {copied ? (
        <Check className="ml-1 h-3.5 w-3.5 shrink-0 text-[#10b981]" aria-hidden="true" />
      ) : (
        <Copy className="ml-1 h-3.5 w-3.5 shrink-0 text-fd-muted-foreground transition-colors group-hover/copy:text-[#10b981]" aria-hidden="true" />
      )}
    </button>
  );
}
