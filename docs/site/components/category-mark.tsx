import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * 16×16 category marks. Stroke geometry, currentColor, no Lucide dump.
 * Colors come from the parent (`category-colors.ts` / skill pills).
 */

type MarkProps = { className?: string };

function Svg({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			aria-hidden="true"
			className={cn("h-3.5 w-3.5 shrink-0", className)}
		>
			{children}
		</svg>
	);
}

const stroke = {
	stroke: "currentColor",
	strokeWidth: 1.5,
	strokeLinecap: "round" as const,
	strokeLinejoin: "round" as const,
};

function DevelopmentMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<path d="M3 11.5 8 4.5l5 7" {...stroke} />
			<path d="M5.5 11.5h5" {...stroke} />
		</Svg>
	);
}

function AiMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<circle cx="8" cy="8" r="2.2" {...stroke} />
			<path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2M4.2 4.2l1.4 1.4M10.4 10.4l1.4 1.4M4.2 11.8l1.4-1.4M10.4 5.6l1.4-1.4" {...stroke} />
		</Svg>
	);
}

function BackendMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<ellipse cx="8" cy="4.5" rx="5" ry="2" {...stroke} />
			<path d="M3 4.5v7c0 1.1 2.2 2 5 2s5-.9 5-2v-7" {...stroke} />
			<path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" {...stroke} />
		</Svg>
	);
}

function FrontendMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<rect x="2.5" y="3.5" width="11" height="9" rx="1.5" {...stroke} />
			<path d="M2.5 6.5h11" {...stroke} />
			<path d="M5 9h3" {...stroke} />
		</Svg>
	);
}

function TestingMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<circle cx="8" cy="8" r="5.5" {...stroke} />
			<path d="M5.5 8.2 7.2 10l3.5-4" {...stroke} />
		</Svg>
	);
}

function SecurityMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<path d="M8 2.5 13 5v3.2c0 3.1-2.1 5.2-5 6.3-2.9-1.1-5-3.2-5-6.3V5l5-2.5Z" {...stroke} />
		</Svg>
	);
}

function DevopsMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<path d="M11.5 5.5A4 4 0 0 0 5 6.2M4.5 10.5A4 4 0 0 0 11 9.8" {...stroke} />
			<path d="M11.5 3v2.5H9M4.5 13v-2.5H7" {...stroke} />
		</Svg>
	);
}

function ProductMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<path d="M8 2.5 13.5 8 8 13.5 2.5 8 8 2.5Z" {...stroke} />
		</Svg>
	);
}

function DataMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<path d="M4 12V8M8 12V4.5M12 12V7" {...stroke} />
			<path d="M3 12.5h10" {...stroke} />
		</Svg>
	);
}

function ResearchMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<circle cx="7" cy="7" r="3.5" {...stroke} />
			<path d="m9.6 9.6 3.4 3.4" {...stroke} />
		</Svg>
	);
}

function OtherMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<path d="M8 2.5 13 5.5v5L8 13.5 3 10.5v-5L8 2.5Z" {...stroke} />
		</Svg>
	);
}

const MARKS: Record<string, (props: MarkProps) => ReactNode> = {
	development: DevelopmentMark,
	ai: AiMark,
	backend: BackendMark,
	frontend: FrontendMark,
	testing: TestingMark,
	quality: TestingMark,
	security: SecurityMark,
	devops: DevopsMark,
	product: ProductMark,
	data: DataMark,
	research: ResearchMark,
	other: OtherMark,
};

export function CategoryMark({
	category,
	className,
}: {
	category: string;
	className?: string;
}) {
	const Mark = MARKS[category] ?? MARKS.development;
	return <Mark className={className} />;
}

function SkillsMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<rect x="3" y="3.5" width="8.5" height="10" rx="1.2" {...stroke} />
			<path d="M6.5 3.5V13.5M4.5 6.5h2M4.5 9h2" {...stroke} />
			<path d="M11.5 5.5h1.2c.7 0 1.3.6 1.3 1.3v6.2c0 .7-.6 1.3-1.3 1.3H7" {...stroke} />
		</Svg>
	);
}

function AgentsMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<circle cx="6" cy="6" r="2" {...stroke} />
			<path d="M2.5 13c.4-2.2 1.8-3.5 3.5-3.5S9.1 10.8 9.5 13" {...stroke} />
			<circle cx="11.2" cy="6.8" r="1.6" {...stroke} />
			<path d="M13.8 13c-.3-1.6-1.3-2.6-2.6-2.6" {...stroke} />
		</Svg>
	);
}

function HooksMark({ className }: MarkProps) {
	return (
		<Svg className={className}>
			<path d="M9 2.5 4.5 9h3.2L7 13.5 12.5 7H9.2L9 2.5Z" {...stroke} />
		</Svg>
	);
}

const LIBRARY_MARKS = {
	skills: SkillsMark,
	agents: AgentsMark,
	hooks: HooksMark,
} as const;

export type LibraryPrimitive = keyof typeof LIBRARY_MARKS;

export function LibraryMark({
	kind,
	className,
}: {
	kind: LibraryPrimitive;
	className?: string;
}) {
	const Mark = LIBRARY_MARKS[kind];
	return <Mark className={className} />;
}
