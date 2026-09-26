"use client";

import { useEffect } from "react";

/**
 * Where the theme-switch circle reveal starts: the centre of the pressed
 * toggle. Fumadocs renders the switch (`[data-theme-toggle]`, no hook for us)
 * and already wraps setTheme in document.startViewTransition; global.css turns
 * that transition into a circle clip read from --theme-x / --theme-y. One
 * delegated capture listener sets them before the click handler runs.
 * Renders nothing.
 */
export function revealOrigin(target: Element): { x: number; y: number } | null {
	const toggle = target.closest("[data-theme-toggle]");
	if (!toggle) return null;
	const button = target.closest("button") ?? toggle;
	const r = button.getBoundingClientRect();
	return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
}

export function ThemeRevealOrigin() {
	useEffect(() => {
		const onPointerDown = (event: PointerEvent) => {
			if (!(event.target instanceof Element)) return;
			const origin = revealOrigin(event.target);
			if (!origin) return;
			const root = document.documentElement.style;
			root.setProperty("--theme-x", `${origin.x}px`);
			root.setProperty("--theme-y", `${origin.y}px`);
		};
		document.addEventListener("pointerdown", onPointerDown, true);
		return () => document.removeEventListener("pointerdown", onPointerDown, true);
	}, []);
	return null;
}
