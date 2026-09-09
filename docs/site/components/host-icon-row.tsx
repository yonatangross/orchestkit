import Link from "next/link";
import { HostMark } from "@/components/host-marks";

const markClass =
	"inline-flex h-10 w-10 items-center justify-center rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] text-fd-foreground transition-colors hover:border-fd-primary/50 hover:bg-[var(--color-fd-primary-10)]";

function Mark({
	href,
	label,
	host,
}: {
	href: string;
	label: string;
	host: "claude" | "cursor" | "codex" | "muse" | "pi";
}) {
	return (
		<Link href={href} aria-label={label} title={label} className={markClass}>
			<HostMark host={host} />
		</Link>
	);
}

/** Host icon row: vendored brand marks, names on hover/focus only. */
export function HostIconRow() {
	return (
		<nav
			aria-label="Install by host"
			className="mt-4 flex flex-wrap items-center justify-center gap-2"
		>
			<Mark href="/docs/getting-started/claude-code" label="Claude Code" host="claude" />
			<Mark href="/docs/getting-started/cursor" label="Cursor" host="cursor" />
			<Mark href="/docs/getting-started/codex" label="Codex" host="codex" />
			<Mark href="/docs/getting-started/skills-sh" label="Pi (skills.sh)" host="pi" />
			<Mark href="/docs/getting-started/muse" label="Muse Code" host="muse" />
		</nav>
	);
}
