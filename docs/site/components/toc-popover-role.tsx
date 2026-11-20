"use client";

import { useEffect } from "react";

/**
 * Fumadocs renders the mobile TOC bar as a <header> outside every sectioning
 * element, so axe and screen readers count it as a second site banner below
 * xl. It is a toolbar holding the "Table of contents" toggle inside the
 * navigation landmark we give its container, so drop the implicit banner role.
 * Fumadocs exposes no prop for that element. Renders nothing.
 */
export function TocPopoverRole() {
	useEffect(() => {
		document.querySelector("[data-toc-popover] > header")?.setAttribute("role", "none");
	}, []);
	return null;
}
