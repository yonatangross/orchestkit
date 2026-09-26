"use client";

import type { ComponentProps, Ref } from "react";

/**
 * Fumadocs HomeLayout wraps the nav and the page in its own <main>, and every
 * page under (home), plus the 404, renders its own <main> as well. axe flagged
 * the pair on /, /changelog, /community and the 404 (landmark-no-duplicate-main,
 * landmark-main-is-top-level, landmark-unique; QA 2026-09-25). This container
 * keeps fumadocs' id and classes on a plain div, so the page's own <main> is the
 * only one and the header stays a top-level banner outside it.
 */
export function HomeContainer({ className, ref, ...props }: ComponentProps<"main">) {
	return (
		<div
			id="nd-home-layout"
			{...props}
			// A div is an HTMLElement, so a ref typed for <main> receives it safely.
			ref={ref as Ref<HTMLDivElement> | undefined}
			className={`flex flex-1 flex-col [--fd-layout-width:1400px] ${className ?? ""}`}
		/>
	);
}
