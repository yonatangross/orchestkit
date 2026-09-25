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
export type SnippetCopyEvent = "install_copied" | "setup_copied";

/**
 * Where a copy happened. PostHog (2026-09-25) could not tell a hero copy from
 * a picker or docs copy because only the hero chip sent `surface`; every copy
 * now carries one.
 */
export type CopySurface = "hero" | "docs-card" | "setup-wizard" | "factory-ride";

/** Copy `payload`, fire the funnel event, flip to a check for 2s. */
export function useTrackedCopy(
	payload: string,
	event: SnippetCopyEvent,
	props: { host?: string; surface?: CopySurface },
) {
	const [copied, setCopied] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const copy = () => {
		// The click is the funnel signal, so it is tracked either way; the
		// "Copied" state only shows once the clipboard write succeeded.
		const eventProps: Record<string, string> = {};
		if (props.host) eventProps.host = props.host;
		if (props.surface) eventProps.surface = props.surface;
		track(event, eventProps);
		navigator.clipboard
			.writeText(payload)
			.then(() => {
				if (timer.current) clearTimeout(timer.current);
				setCopied(true);
				timer.current = setTimeout(() => setCopied(false), 2000);
			})
			.catch(() => {});
	};
	return { copied, copy };
}

export function InstallSnippet({
	text,
	prompt = true,
	host,
	event = "install_copied",
	surface,
	copy: copyText,
}: {
	text: string | string[];
	/** Clipboard payload when it differs from the displayed lines. */
	copy?: string;
	prompt?: boolean;
	host?: string;
	/**
	 * Funnel event fired on copy. The install chip keeps install_copied; the
	 * "Then run /ork:setup" chip passes setup_copied so a setup copy is never
	 * counted as a second install.
	 */
	event?: SnippetCopyEvent;
	surface?: CopySurface;
}) {
	const lines = typeof text === "string" ? [text] : text;
	const payload = copyText ?? lines.join(prompt ? " && " : "\n");
	const { copied, copy } = useTrackedCopy(payload, event, { host, surface });

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
				{/* Wrap at spaces with a hanging indent after the $. break-all split
				    "yo / natangross" mid-word on the Installation page (QA 2026-09-25). */}
				{lines.map((line) => (
					<div key={line} className="flex gap-1.5">
						{prompt ? (
							<span aria-hidden="true" className="shrink-0 text-fd-muted-foreground">
								$
							</span>
						) : null}
						<span className="min-w-0 whitespace-pre-wrap [overflow-wrap:break-word]">{line}</span>
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
