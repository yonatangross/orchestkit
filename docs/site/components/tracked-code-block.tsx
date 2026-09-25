"use client";

import { type ComponentProps, type MouseEvent, type ReactNode, useEffect, useRef } from "react";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { cn } from "@/lib/cn";
import { uniqueRegionName } from "@/lib/region-name";
import { track } from "@/lib/search-beacon";

/** "Code: <title>" or "Code: <first line>", so each code region has its own name. */
function describeCode(el: Element): string {
	const title = el.closest("figure")?.querySelector("figcaption")?.textContent?.trim();
	const first = (el.textContent ?? "").split("\n").find((l) => l.trim())?.trim();
	return `Code: ${title || first || "block"}`;
}

const LANGUAGE_RE = /(?:^|\s)language-([\w#+.-]+)/;
const MAX_TOKEN = 64;

export type CodeCopyProps = {
	path: string;
	language: string;
	first_token: string;
};

/**
 * Properties for one code_copied event, read from the rendered block at click
 * time. The language comes from the `language-<lang>` class rehype-code adds to
 * <code> (addLanguageClass in source.config.ts). The first token is the first
 * whitespace-separated word of the copied text, capped, so the event says
 * "someone copied a `claude` / `npx` / `/plugin` block" without shipping the
 * snippet itself.
 */
export function codeCopyProps(figure: Element | null, path: string): CodeCopyProps {
	const code = figure?.querySelector("pre code") ?? figure?.querySelector("pre");
	const language = code?.className.match(LANGUAGE_RE)?.[1] ?? "unknown";
	const text = figure?.querySelector("pre")?.textContent ?? "";
	const first_token = (text.trim().split(/\s+/)[0] ?? "").slice(0, MAX_TOKEN);
	return { path, language, first_token };
}

/**
 * Fumadocs' default MDX `pre`, plus a code_copied event when its copy button is
 * pressed. The copy button is internal to CodeBlock, so the event is attached
 * through the `Actions` slot that wraps it; the copy behaviour itself is
 * untouched.
 */
export function TrackedCodeBlock({
	children,
	...props
}: ComponentProps<"pre"> & { children?: ReactNode }) {
	// fumadocs renders the scrolling viewport as an unnamed role=region; name
	// it after mount so a page of code blocks is not a row of identical
	// landmarks (axe landmark-unique).
	const figure = useRef<HTMLElement>(null);
	useEffect(() => {
		const viewport = figure.current?.querySelector("[role=region]");
		if (viewport) viewport.setAttribute("aria-label", uniqueRegionName(viewport, describeCode(viewport).slice(0, 80)));
	}, []);
	const onActionsClick = (e: MouseEvent<HTMLDivElement>) => {
		if (!(e.target as Element | null)?.closest?.("button")) return;
		try {
			const figure = e.currentTarget.closest("figure");
			track("code_copied", codeCopyProps(figure, window.location.pathname));
		} catch {
			// fail-open: analytics must never break the copy button
		}
	};

	return (
		<CodeBlock
			{...(props as ComponentProps<typeof CodeBlock>)}
			ref={figure}
			Actions={({ className, children: actions }) => (
				<div
					className={cn("empty:hidden", className)}
					onClickCapture={onActionsClick}
				>
					{actions}
				</div>
			)}
		>
			<Pre>{children}</Pre>
		</CodeBlock>
	);
}
