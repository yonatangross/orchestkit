"use client";

import { useEffect } from "react";

/**
 * Keeps `--fd-banner-height` equal to the banner's VISIBLE height.
 *
 * The announcement banner is in its own row and scrolls away (operator,
 * 2026-09-25), so it passes changeLayout={false}. Fumadocs' docs layout still
 * sizes its sticky sidebar as 100dvh minus that variable, so with the variable
 * unset the sidebar ran 48px past the fold at the top of every docs page and
 * hid its footer (theme switch, GitHub). Tracking the visible height fixes the
 * top of the page and shrinks to 0 once the banner has scrolled away. The
 * variable only feeds sticky offsets and heights, never grid rows, so the
 * content does not reflow. Renders nothing.
 */
export function BannerOffset({ bannerId }: { bannerId: string }) {
	useEffect(() => {
		const root = document.documentElement;
		let frame = 0;
		const update = () => {
			frame = 0;
			const banner = document.getElementById(bannerId);
			const visible = banner ? Math.max(0, Math.round(banner.getBoundingClientRect().bottom)) : 0;
			root.style.setProperty("--fd-banner-height", `${visible}px`);
		};
		const schedule = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		update();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		// The close button removes the banner; re-measure after any click on it.
		document.addEventListener("click", schedule, true);
		return () => {
			if (frame) cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
			document.removeEventListener("click", schedule, true);
			root.style.removeProperty("--fd-banner-height");
		};
	}, [bannerId]);
	return null;
}
