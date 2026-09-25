"use client";

import {
	startTransition,
	useEffect,
	useRef,
	useState,
	type KeyboardEvent,
	type MouseEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Copy } from "lucide-react";
import { HostMark, type HostId } from "@/components/host-marks";
import { SameRouteFade, sameRouteReplace } from "@/components/page-transition";
import { InstallSnippet, useTrackedCopy } from "@/components/install-snippet";
import { SearchParamsSync } from "@/components/search-params-sync";
import {
	HOST_INSTALLS,
	HOST_INSTALL_BY_ID,
	homeInstallHref,
	parseHostId,
	type HostInstallSpec,
} from "@/lib/host-installs";
import { parseLibraryTab, type LibraryTab } from "@/lib/library-tab";
import { track } from "@/lib/search-beacon";
import { cn } from "@/lib/cn";

function Card({ spec }: { spec: HostInstallSpec }) {
	return (
		<article className="not-prose flex flex-col gap-3 rounded-xl border border-fd-border bg-[var(--color-fd-surface-raised)] p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-fd-border bg-fd-background">
						<HostMark host={spec.id} />
					</span>
					<div className="min-w-0">
						<p className="text-sm font-semibold text-fd-foreground">
							{spec.name}
						</p>
						<p className="mt-0.5 text-[12.5px] leading-5 text-fd-muted-foreground">
							{spec.what}
						</p>
					</div>
				</div>
				<Link
					href={spec.href}
					className="shrink-0 font-mono text-[11px] text-fd-primary underline-offset-2 hover:underline"
				>
					Docs
				</Link>
			</div>
			<p className="text-[12px] leading-5 text-fd-muted-foreground">{spec.where}</p>
			<InstallSnippet
				text={spec.commands}
				copy={spec.copy}
				prompt={spec.prompt}
				host={spec.id}
				surface="docs-card"
			/>
			{spec.then ? (
				<div className="space-y-1.5">
					<p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground">
						{spec.then.label}
					</p>
					<InstallSnippet
						text={spec.then.commands}
						prompt={spec.then.prompt}
						host={spec.id}
						event="setup_copied"
						surface="docs-card"
					/>
				</div>
			) : null}
		</article>
	);
}

/** One host: copy the install, copy the next command. */
export function HostInstall({ host }: { host: HostId }) {
	return <Card spec={HOST_INSTALL_BY_ID[host]} />;
}

/** All hosts, or a subset (skills.sh page uses pi / muse / opencode). */
export function HostInstallGrid({ hosts }: { hosts?: HostId[] }) {
	const list = hosts
		? hosts.map((id) => HOST_INSTALL_BY_ID[id])
		: HOST_INSTALLS;
	return (
		<div className="not-prose grid gap-3 sm:grid-cols-2">
			{list.map((spec) => (
				<Card key={spec.id} spec={spec} />
			))}
		</div>
	);
}

function passThroughClick(e: MouseEvent) {
	return (
		e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0
	);
}

/** Why the command box shows the host it shows (install_viewed.source). */
type HostSource = "default" | "deeplink" | "click";

/**
 * Homepage hero: pick a host, then that host's one command right under it.
 *
 * Operator report 2026-09-25 + PostHog (30 days): 32 of 42 host picks were not
 * Claude Code, yet the hero printed the Claude Code command first and the
 * other hosts' commands sat under eight big cards below the fold (median home
 * scroll 10%). Nobody who picked another host copied its command. So the hero
 * now leads with compact host chips (Claude Code preselected) and the command
 * for the picked host, one line per command, labelled with the host.
 *
 * The selected host and the catalog tab come from the URL (`?host=`, `?lib=`)
 * via SearchParamsSync, not from page props, so `/` stays statically rendered.
 * The prerendered HTML shows the Claude Code default; a deep link switches to
 * its host right after hydration.
 *
 * Keyboard: one tab stop on the chip group (roving tabindex), arrows move
 * focus, Enter/Space activates. Chips wrap, so ArrowDown/ArrowUp step by the
 * computed column count and fall back to one step when the group is not a
 * grid. prefers-reduced-motion disables the hover lift and ring spring.
 */
export function HostInstallPicker({
	hosts = ["claude", "cursor", "codex", "devin", "opencode", "muse", "pi", "agy"],
}: {
	hosts?: HostId[];
}) {
	const router = useRouter();
	const reduceMotion = useReducedMotion();
	const list = hosts.map((id) => HOST_INSTALL_BY_ID[id]);
	const fallback = list[0]?.id ?? "claude";
	const [current, setCurrent] = useState<HostId>(fallback);
	const [source, setSource] = useState<HostSource>("default");
	const [libraryTab, setLibraryTab] = useState<LibraryTab>("skills");
	const [focusIdx, setFocusIdx] = useState(0);
	const gridRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

	const syncFromUrl = (params: URLSearchParams) => {
		const fromUrl = parseHostId(params.get("host") ?? undefined);
		const known = list.some((item) => item.id === fromUrl);
		const resolved = known ? fromUrl : fallback;
		setCurrent(resolved);
		if (known && params.get("host")) setSource((prev) => (prev === "click" ? prev : "deeplink"));
		// Seed the roving tab stop on the resolved host so the first Tab after
		// a ?host= deep link lands on that chip.
		setFocusIdx(Math.max(0, list.findIndex((item) => item.id === resolved)));
		setLibraryTab(parseLibraryTab(params.get("lib") ?? undefined));
	};

	const spec = HOST_INSTALL_BY_ID[current];

	const pick = (e: MouseEvent<HTMLAnchorElement>, id: HostId) => {
		// Recorded for every activation, including a modified click that opens
		// the host in a new tab: the choice is the signal, not how it was opened.
		// A deep link is not a selection and never fires this (install_viewed
		// carries source=deeplink instead).
		track("host_selected", { host: id });
		if (passThroughClick(e)) return;
		e.preventDefault();
		startTransition(() => {
			setCurrent(id);
			setSource("click");
			router.replace(homeInstallHref(id, libraryTab), sameRouteReplace);
		});
	};

	const gridColumns = () => {
		if (!gridRef.current) return 1;
		const cols = getComputedStyle(gridRef.current).gridTemplateColumns;
		return !cols || cols === "none" ? 1 : cols.split(" ").length;
	};

	const onGridKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		// Space does not activate an anchor; Enter already does natively.
		if (e.key === " ") {
			e.preventDefault();
			(e.target as HTMLElement).closest("a")?.click();
			return;
		}
		const n = list.length;
		const cols = Math.max(1, gridColumns());
		let next: number | null = null;
		switch (e.key) {
			case "ArrowRight":
				next = (focusIdx + 1) % n;
				break;
			case "ArrowLeft":
				next = (focusIdx - 1 + n) % n;
				break;
			case "ArrowDown":
				next = Math.min(focusIdx + cols, n - 1);
				break;
			case "ArrowUp":
				next = Math.max(focusIdx - cols, 0);
				break;
			case "Home":
				next = 0;
				break;
			case "End":
				next = n - 1;
				break;
			default:
				return;
		}
		e.preventDefault();
		setFocusIdx(next);
		itemRefs.current[next]?.focus();
	};

	return (
		<nav aria-label="Install by host" className="mt-6 w-full min-w-0 max-w-[560px] text-left max-[900px]:max-w-none">
			<SearchParamsSync onChange={syncFromUrl} />
			<p
				id="install-for-label"
				className="mb-2 font-mono text-[11.5px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground"
			>
				Install for
			</p>
			<div
				ref={gridRef}
				role="group"
				aria-label="Hosts"
				className="flex flex-wrap gap-1.5"
				onKeyDown={onGridKeyDown}
			>
				{list.map((item, index) => {
					const selected = item.id === current;
					return (
						<motion.a
							key={item.id}
							ref={(el) => {
								itemRefs.current[index] = el;
							}}
							href={homeInstallHref(item.id, libraryTab)}
							aria-current={selected ? "true" : undefined}
							tabIndex={index === focusIdx ? 0 : -1}
							onFocus={() => setFocusIdx(index)}
							onClick={(e) => pick(e, item.id)}
							initial={false}
							whileHover={reduceMotion ? undefined : { y: -1 }}
							whileTap={reduceMotion ? undefined : { scale: 0.97 }}
							className={cn(
								"relative inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring",
								selected
									? "border-fd-primary/60 bg-[var(--color-fd-primary-10)] font-semibold text-fd-primary"
									: "border-fd-border bg-[var(--color-fd-surface-raised)] font-medium text-fd-foreground hover:border-fd-primary/40",
							)}
						>
							{selected ? (
								<motion.span
									layoutId="host-chip-ring"
									className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-fd-primary/40"
									transition={
										reduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 420, damping: 34 }
									}
									aria-hidden="true"
								/>
							) : null}
							<HostMark host={item.id} className="h-3.5 w-3.5" />
							{item.name}
						</motion.a>
					);
				})}
			</div>
			<HostCommandPanel spec={spec} source={source} />
		</nav>
	);
}

/** Inline copy chip for the follow-up command (/ork:setup and friends). */
function FollowUpChip({ spec }: { spec: HostInstallSpec }) {
	const then = spec.then;
	const payload = then ? then.commands.join("\n") : "";
	const { copied, copy } = useTrackedCopy(payload, "setup_copied", {
		host: spec.id,
		surface: "hero",
	});
	if (!then) return null;
	return (
		<span className="inline-flex min-w-0 items-center gap-2">
			<span className="shrink-0">{then.label}:</span>
			<button
				type="button"
				onClick={copy}
				aria-label={copied ? `Copied ${payload}` : `Copy ${payload} to clipboard`}
				className="group inline-flex min-w-0 items-center gap-1.5 rounded-md border border-fd-border bg-[var(--color-fd-surface-raised)] px-2 py-0.5 font-mono text-[12.5px] text-fd-foreground transition-colors hover:border-fd-primary/50"
			>
				<span className="truncate">{payload}</span>
				{copied ? (
					<Check className="h-3.5 w-3.5 shrink-0 text-fd-primary" aria-hidden="true" />
				) : (
					<Copy className="h-3.5 w-3.5 shrink-0 group-hover:text-fd-primary" aria-hidden="true" />
				)}
			</button>
		</span>
	);
}

function HostCommandPanel({ spec, source }: { spec: HostInstallSpec; source: HostSource }) {
	const payload = spec.copy ?? spec.commands.join("\n");
	const { copied, copy } = useTrackedCopy(payload, "install_copied", {
		host: spec.id,
		surface: "hero",
	});
	const boxRef = useRef<HTMLDivElement>(null);
	const viewed = useRef(false);
	const latest = useRef({ host: spec.id, source });
	latest.current = { host: spec.id, source };

	// install_viewed: once per page load, when the command box is at least half
	// on screen. With install_copied it gives a real copy rate per host, which
	// the pageview count alone could not (PostHog audit 2026-09-25).
	useEffect(() => {
		const el = boxRef.current;
		if (!el || typeof IntersectionObserver === "undefined") return;
		const io = new IntersectionObserver(
			(entries) => {
				if (viewed.current || !entries.some((e) => e.isIntersecting)) return;
				viewed.current = true;
				track("install_viewed", { ...latest.current, surface: "hero" });
				io.disconnect();
			},
			{ threshold: 0.5 },
		);
		io.observe(el);
		return () => io.disconnect();
	}, []);

	const getStarted =
		spec.id === "claude" ? "/docs/getting-started/first-10-minutes" : spec.href;

	return (
		<SameRouteFade childKey={spec.id} name="host-command">
			<div className="mt-3">
				<div
					ref={boxRef}
					data-hero-install
					className="overflow-hidden rounded-[10px] border border-[color-mix(in_oklch,var(--color-fd-primary)_45%,var(--color-fd-border))] bg-[var(--color-fd-surface-raised)]"
				>
					<div className="flex items-center justify-between gap-3 border-b border-fd-border px-3 py-2 text-[12.5px] text-fd-muted-foreground">
						<span className="min-w-0 truncate">
							<span className="font-semibold text-fd-foreground">{spec.name}</span>
							<span aria-hidden="true"> · </span>
							{spec.where}
						</span>
						<button
							type="button"
							onClick={copy}
							aria-label={copied ? `Copied ${payload}` : `Copy ${payload} to clipboard`}
							className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-fd-primary transition-colors hover:bg-[var(--color-fd-primary-10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring"
						>
							{copied ? (
								<Check className="h-3.5 w-3.5" aria-hidden="true" />
							) : (
								<Copy className="h-3.5 w-3.5" aria-hidden="true" />
							)}
							<span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
						</button>
					</div>
					{/* One line per command, never wrapped: a wrapped command read as three
					    commands with the $ on the middle line (operator, 2026-09-25). */}
					<div
						// Long lines scroll sideways on phones, so the region needs a tab
						// stop and a name (axe scrollable-region-focusable).
						tabIndex={0}
						role="region"
						aria-label={`${spec.name} install command`}
						className="scroll-shadows min-w-0 max-w-full overflow-x-auto px-3 py-2.5 font-mono text-[12.5px] leading-6 text-fd-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fd-ring xl:text-[13px]"
					>
						{spec.commands.map((line) => (
							<div key={line} className="whitespace-pre">
								{spec.prompt ? (
									<span aria-hidden="true" className="mr-2.5 text-fd-muted-foreground">
										$
									</span>
								) : null}
								{line}
							</div>
						))}
					</div>
				</div>
				<div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-fd-muted-foreground">
					<FollowUpChip spec={spec} />
					<span className="ml-auto inline-flex items-center gap-4">
						<Link
							href={spec.href}
							className="font-medium text-fd-primary underline-offset-2 hover:underline"
						>
							{spec.name} docs
						</Link>
						<Link
							href={getStarted}
							className="inline-flex items-center gap-1.5 font-semibold text-fd-primary underline-offset-2 hover:underline"
						>
							Get started <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
						</Link>
					</span>
				</div>
			</div>
		</SameRouteFade>
	);
}
