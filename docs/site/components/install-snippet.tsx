"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { track } from "@/lib/search-beacon";

/**
 * CLI copy chip. Shape from 21st.dev Snippet (shugar/snippet-1): `$` prompt,
 * monospace lines, copy icon that flips to a check. Tokens are Fumadocs `fd-*`,
 * the whole chip is a real button, and the clipboard payload is the joined
 * lines (not a fake one-liner).
 */
export function InstallSnippet({
	text,
	prompt = true,
	host,
}: {
	text: string | string[];
	prompt?: boolean;
	host?: string;
}) {
	const lines = typeof text === "string" ? [text] : text;
	const payload = lines.join("\n");
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const copy = () => {
		navigator.clipboard.writeText(payload).catch(() => {});
		track("install_copied", host ? { host } : {});
		if (timer.current) clearTimeout(timer.current);
		setCopied(true);
		timer.current = setTimeout(() => setCopied(false), 2000);
	};

	return (
		<button
			type="button"
			onClick={copy}
			className="group flex w-full cursor-pointer items-start gap-3 rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] px-3 py-2.5 text-left transition-colors hover:border-fd-primary/50"
			aria-label={
				copied ? `Copied ${payload}` : `Copy ${payload} to clipboard`
			}
		>
			<div className="min-w-0 flex-1 font-mono text-[12.5px] leading-5 text-fd-foreground">
				{lines.map((line) => (
					<div
						key={line}
						className={`break-all ${prompt ? "before:mr-1.5 before:text-fd-muted-foreground before:content-['$_']" : ""}`}
					>
						{line}
					</div>
				))}
			</div>
			<span aria-live="polite" className="mt-0.5 shrink-0 text-fd-muted-foreground">
				{copied ? (
					<Check className="h-4 w-4 text-fd-primary" aria-hidden="true" />
				) : (
					<Copy
						className="h-4 w-4 transition-colors group-hover:text-fd-primary"
						aria-hidden="true"
					/>
				)}
			</span>
		</button>
	);
}
