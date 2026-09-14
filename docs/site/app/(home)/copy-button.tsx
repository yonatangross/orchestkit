"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { SITE } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { track } from "@/lib/search-beacon";

/**
 * Copy chip for the Claude Code install command. `surface` tags the
 * install_copied event so the homepage hero can be told apart from other
 * placements (factory ride) in the funnel read.
 */
export function CopyInstallButton({
	surface,
	className,
}: {
	surface?: string;
	className?: string;
} = {}) {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
		},
		[],
	);

	const copy = () => {
		navigator.clipboard.writeText(SITE.installCommand).catch(() => {});
		track(
			"install_copied",
			surface ? { host: "claude", surface } : { host: "claude" },
		);
		if (timer.current) clearTimeout(timer.current);
		setCopied(true);
		timer.current = setTimeout(() => setCopied(false), 2000);
	};

	return (
		<>
			<button
				type="button"
				onClick={copy}
				className={cn(
					"group/copy inline-flex min-h-10 max-w-full cursor-pointer items-center gap-2 rounded-lg border border-fd-border bg-fd-card px-3 py-2 text-left font-mono text-[13px] text-fd-muted-foreground transition-colors sm:px-4 sm:text-sm hover:border-fd-muted-foreground/40 hover:text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background motion-reduce:transition-none",
					className,
				)}
				aria-label={`Copy ${SITE.installCommand} to clipboard`}
			>
				<span className="shrink-0 text-fd-muted-foreground" aria-hidden="true">
					$
				</span>
				{/* overflow-wrap:anywhere breaks at spaces first and only splits a
				    word when the line truly cannot fit; break-all split
				    "orchestkit/ork" mid-word at 375px. */}
				<span className="min-w-0 [overflow-wrap:anywhere]">
					{SITE.installCommand}
				</span>
				{copied ? (
					<Check
						className="ml-1 h-3.5 w-3.5 shrink-0 text-fd-primary"
						aria-hidden="true"
					/>
				) : (
					<Copy
						className="ml-1 h-3.5 w-3.5 shrink-0 text-fd-muted-foreground transition-colors group-hover/copy:text-fd-primary motion-reduce:transition-none"
						aria-hidden="true"
					/>
				)}
			</button>
			{/* Outside the button: a live region inside a labelled button is not
			    reliably announced, because aria-label replaces its content. */}
			<span role="status" aria-live="polite" className="sr-only">
				{copied ? `Copied ${SITE.installCommand} to clipboard` : ""}
			</span>
		</>
	);
}
