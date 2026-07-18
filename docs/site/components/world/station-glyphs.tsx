// "Thirteen Stations" glyph system: one geometric line-art mark per
// top-level docs section, drawn as a station along the scroll world.
//
// Style law (mirrors components/world/george.tsx and lucide): 24x24
// viewBox, single-weight 1.5px stroke, stroke = currentColor, fill = none,
// round caps/joins, <= 6 path elements per glyph. Consumers size the mark
// externally (fumadocs sidebar applies [&_svg]:size-4), so every glyph
// renders at 100% width/height of its container.

import type { ComponentType } from "react";

export interface StationGlyphProps {
	/** Stroke override, e.g. a gradient url(#id). Defaults to currentColor. */
	stroke?: string;
	className?: string;
}

export type StationGlyphComponent = ComponentType<StationGlyphProps>;

const svgProps = {
	viewBox: "0 0 24 24",
	width: "100%",
	height: "100%",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.5,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": true,
} as const;

/** getting-started: intake gate archway, the way into the world. */
export function GlyphGettingStarted(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<path d="M5 20V11a7 7 0 0 1 14 0v9" />
			<path d="M9 20v-9.5a3 3 0 0 1 6 0V20" />
			<path d="M3 20h18" />
		</svg>
	);
}

/** foundations: isometric foundation slab, load-bearing. */
export function GlyphFoundations(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<path d="m4 9 8-4 8 4-8 4z" />
			<path d="M4 9v4.5l8 4 8-4V9" />
			<path d="M12 13v4.5" />
		</svg>
	);
}

/** guides: signpost with two directional boards. */
export function GlyphGuides(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<path d="M12 21V3.5" />
			<path d="M12 5.5h6.5l2 2-2 2H12" />
			<path d="M12 11.5H5.5l-2 2 2 2H12" />
		</svg>
	);
}

/** cookbook: supply crate with steam rising off it. */
export function GlyphCookbook(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<rect x="4" y="11.5" width="16" height="8.5" rx="1" />
			<path d="M4 15.5h16" />
			<path d="M9.5 8.5c-.9-1 .9-2 0-3" />
			<path d="M14.5 8.5c-.9-1 .9-2 0-3" />
		</svg>
	);
}

/** reference: card index with one card pulled up by its tab. */
export function GlyphReference(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<rect x="4" y="9.5" width="16" height="10.5" rx="1.5" />
			<path d="M7.5 9.5v-3h9v3" />
			<path d="M10.5 6.5v-2h3v2" />
			<path d="M8.5 13.5h7" />
		</svg>
	);
}

/** skills: tool wall pegboard with pegs and a hung T-tool. */
export function GlyphSkills(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<rect x="4" y="4" width="16" height="16" rx="1.5" />
			<path d="M8.5 8h.01M12 8h.01M15.5 8h.01" />
			<path d="M13.5 12.5h4M15.5 12.5V17" />
		</svg>
	);
}

/** agents: robot arm tower reaching up from its base. */
export function GlyphAgents(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<path d="M6.5 20h9" />
			<path d="M9.5 20v-7.5l5-5" />
			<path d="M9.5 12.5h.01" />
			<path d="m14.5 7.5 3-.5m-3 .5.5 3" />
		</svg>
	);
}

/** hooks: inspection gate scanning a package with a beam. */
export function GlyphHooks(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<path d="M5 20V6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V20" />
			<path d="M12 7.5v2m0 3v2" />
			<path d="M9 20v-3.5h6V20" />
		</svg>
	);
}

/** memory: vault drawer with a crystal held above it. */
export function GlyphMemory(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<path d="m12 3 3 3.5-3 4-3-4z" />
			<path d="M9 6.5h6" />
			<path d="M4 13.5h16V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
			<path d="M10.5 16.75h3" />
		</svg>
	);
}

/** analytics: gauge dial with needle and ticks. */
export function GlyphAnalytics(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<path d="M4.5 16.5a7.5 7.5 0 0 1 15 0" />
			<path d="m12 16.5 3.5-4.5" />
			<path d="M12 16.5h.01" />
			<path d="M12 9v1.5M6.8 11.3l1.1 1.1M17.2 11.3l-1.1 1.1" />
		</svg>
	);
}

/** troubleshooting: wrench with a spark where it bites. */
export function GlyphTroubleshooting(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<path d="M8.6 10.4 4.5 14.5a2 2 0 0 0 2.8 2.8l4.1-4.1a3.8 3.8 0 0 0 5-5L14 10.6 11.2 7.8l2.4-2.4a3.8 3.8 0 0 0-5 5z" />
			<path d="M18.5 15.5v4m-2-2h4" />
		</svg>
	);
}

/** showcase: spotlight beaming down onto a stage. */
export function GlyphShowcase(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<rect x="9.5" y="3" width="5" height="3" rx="1" />
			<path d="M10.2 6 6.5 16.5h11L13.8 6" />
			<path d="M3.5 20h17" />
		</svg>
	);
}

/** changelog: release train rolling down the line. */
export function GlyphChangelog(props: StationGlyphProps) {
	return (
		<svg {...svgProps} {...props}>
			<path d="M4 16V8h5v3.5h6a3 3 0 0 1 3 3V16z" />
			<path d="M13.5 11.5v-2" />
			<circle cx="8" cy="17.8" r="1.8" />
			<circle cx="14.5" cy="17.8" r="1.8" />
			<path d="M3.5 20.5h17" />
		</svg>
	);
}

export type StationSection =
	| "getting-started"
	| "foundations"
	| "guides"
	| "cookbook"
	| "reference"
	| "skills"
	| "agents"
	| "hooks"
	| "memory"
	| "analytics"
	| "troubleshooting"
	| "showcase"
	| "changelog";

/** Typed map of all thirteen station glyphs, keyed by docs section slug. */
export const STATION_GLYPHS: Record<StationSection, StationGlyphComponent> = {
	"getting-started": GlyphGettingStarted,
	foundations: GlyphFoundations,
	guides: GlyphGuides,
	cookbook: GlyphCookbook,
	reference: GlyphReference,
	skills: GlyphSkills,
	agents: GlyphAgents,
	hooks: GlyphHooks,
	memory: GlyphMemory,
	analytics: GlyphAnalytics,
	troubleshooting: GlyphTroubleshooting,
	showcase: GlyphShowcase,
	changelog: GlyphChangelog,
};

/**
 * Resolve the station glyph for a docs slug. Accepts a bare section slug
 * ("skills"), a nested slug ("reference/skills" resolves to "reference"),
 * or a URL path ("/docs/hooks"). Returns null when no glyph is assigned.
 */
export function getSectionGlyph(slug: string): StationGlyphComponent | null {
	const segments = slug.split("/").filter(Boolean);
	const section = segments[0] === "docs" ? segments[1] : segments[0];
	if (!section) return null;
	return STATION_GLYPHS[section as StationSection] ?? null;
}

const ACTIVE_GRADIENT_ID = "ork-station-active-gradient";

/**
 * Renders a section's glyph with the indigo-to-violet gradient stroke
 * used for the ACTIVE section. The gradient runs 135deg (top-left to
 * bottom-right) from oklch(0.62 0.2 264) to oklch(0.6 0.2 290).
 */
export function ActiveGlyph({
	section,
	className,
}: {
	section: string;
	className?: string;
}) {
	const Glyph = getSectionGlyph(section);
	if (!Glyph) return null;
	return (
		<>
			<svg
				aria-hidden
				focusable="false"
				style={{ position: "absolute", width: 0, height: 0 }}
			>
				<defs>
					<linearGradient id={ACTIVE_GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0%" stopColor="oklch(0.62 0.2 264)" />
						<stop offset="100%" stopColor="oklch(0.6 0.2 290)" />
					</linearGradient>
				</defs>
			</svg>
			<Glyph stroke={`url(#${ACTIVE_GRADIENT_ID})`} className={className} />
		</>
	);
}
