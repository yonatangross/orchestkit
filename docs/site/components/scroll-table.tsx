"use client";

import { type ComponentProps, useRef } from "react";
import { precedingHeading, useRegionName } from "@/lib/region-name";

function describeTable(el: HTMLElement): string {
	const heading = precedingHeading(el);
	if (heading) return `Table: ${heading}`;
	const cells = [...el.querySelectorAll("thead th")].map((th) => th.textContent?.trim()).filter(Boolean);
	return cells.length ? `Table: ${cells.join(", ")}` : "Table";
}

/**
 * Fumadocs' table wrapper (`relative overflow-auto prose-no-margin my-6`) made
 * keyboard-reachable: a wide table scrolls, so the region needs a tab stop and
 * a name (axe scrollable-region-focusable, serious, on the deep reference
 * pages). The name starts generic for the server render and becomes the
 * section it sits in after mount, unique on the page. Same classes, so the
 * layout is unchanged.
 */
export function ScrollTable(props: ComponentProps<"table">) {
	const ref = useRef<HTMLDivElement>(null);
	useRegionName(ref, describeTable);
	return (
		<div
			ref={ref}
			tabIndex={0}
			role="region"
			aria-label="Table, scrolls sideways"
			className="scroll-fade relative my-6 overflow-auto prose-no-margin focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
		>
			<table {...props} />
		</div>
	);
}
