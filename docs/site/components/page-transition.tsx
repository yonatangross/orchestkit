"use client";

/// <reference types="react/canary" />

import * as React from "react";
import type { ReactNode } from "react";

/** Same-route homepage swaps (host command, Skills/Agents/Hooks). */
export const SAME_ROUTE_TYPE = "catalog";

export const sameRouteReplace = {
	scroll: false as const,
	transitionTypes: [SAME_ROUTE_TYPE],
};

type ViewTransitionProps = {
	children?: ReactNode;
	name?: string;
	default?: unknown;
	enter?: unknown;
	exit?: unknown;
	share?: unknown;
	update?: unknown;
};

const ViewTransition =
	((React as unknown as { ViewTransition?: (props: ViewTransitionProps) => React.ReactNode })
		.ViewTransition ??
		(({ children }: ViewTransitionProps) => children)) as (
		props: ViewTransitionProps,
	) => React.ReactNode;

/**
 * Route enter/exit. Lives in `template.tsx` so it remounts with the page.
 * Layout chrome (nav, sidebar) stays put via `view-transition-name` in CSS.
 * Typed `catalog` navigations skip the page fade so query-string replaces
 * do not replay the whole homepage.
 */
export function PageTransition({ children }: { children: ReactNode }) {
	return (
		<ViewTransition
			enter={{ default: "page-enter", catalog: "none" }}
			exit={{ default: "page-exit", catalog: "none" }}
		>
			{children}
		</ViewTransition>
	);
}

/** Same-route swap (host command, Skills/Agents/Hooks). Driven by router.replace. */
export function SameRouteFade({
	childKey,
	name,
	children,
}: {
	childKey: string;
	name: string;
	children: ReactNode;
}) {
	return (
		<ViewTransition
			key={childKey}
			name={name}
			default="none"
			share={{ catalog: "catalog-fade", default: "none" }}
			enter={{ catalog: "catalog-fade", default: "none" }}
			exit={{ catalog: "catalog-fade", default: "none" }}
			update={{ catalog: "catalog-fade", default: "none" }}
		>
			{children}
		</ViewTransition>
	);
}
