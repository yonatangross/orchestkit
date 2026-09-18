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
import { HostMark, type HostId } from "@/components/host-marks";
import { SameRouteFade, sameRouteReplace } from "@/components/page-transition";
import { InstallSnippet } from "@/components/install-snippet";
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
				prompt={spec.prompt}
				host={spec.id}
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

/**
 * Homepage: pick a host, copy its command. Keeps the Install by host nav.
 *
 * The selected host and the catalog tab come from the URL (`?host=`, `?lib=`)
 * via SearchParamsSync, not from page props, so `/` stays statically rendered.
 * The prerendered HTML shows the Claude Code default; a deep link switches to
 * its host right after hydration.
 *
 * Card motion adapted from 21st.dev Animated Card Options (isaiahbjork):
 * staggered spring entrance with an overshoot settle, hover lift, tap press.
 * That component fades unchosen cards out, which fits a one-shot onboarding
 * pick but not a switcher, so here every card stays mounted and selection is
 * the shared layoutId ring plus the snippet swap below. Keyboard: one tab stop
 * on the grid (roving tabindex), arrows move focus, Enter/Space activates.
 * prefers-reduced-motion disables the entrance, lift, and ring spring.
 *
 * The entrance runs only after mount: useReducedMotion() is null during SSR,
 * so a prerendered `initial` would bake opacity 0 into the static HTML. Cards
 * always render fully styled and the keyframes start on the first effect.
 */
export function HostInstallPicker({
	hosts = ["claude", "cursor", "codex", "muse", "pi", "opencode", "devin", "agy"],
}: {
	hosts?: HostId[];
}) {
	const router = useRouter();
	const reduceMotion = useReducedMotion();
	const list = hosts.map((id) => HOST_INSTALL_BY_ID[id]);
	const fallback = list[0]?.id ?? "claude";
	const [current, setCurrent] = useState<HostId>(fallback);
	const [libraryTab, setLibraryTab] = useState<LibraryTab>("skills");
	const [focusIdx, setFocusIdx] = useState(0);
	const [mounted, setMounted] = useState(false);
	const gridRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

	useEffect(() => setMounted(true), []);

	const syncFromUrl = (params: URLSearchParams) => {
		const fromUrl = parseHostId(params.get("host") ?? undefined);
		const resolved = list.some((item) => item.id === fromUrl)
			? fromUrl
			: fallback;
		setCurrent(resolved);
		// Seed the roving tab stop on the resolved host so the first Tab after
		// a ?host= deep link lands on that card.
		setFocusIdx(Math.max(0, list.findIndex((item) => item.id === resolved)));
		setLibraryTab(parseLibraryTab(params.get("lib") ?? undefined));
	};

	const spec = HOST_INSTALL_BY_ID[current];

	const pick = (e: MouseEvent<HTMLAnchorElement>, id: HostId) => {
		// Recorded for every activation, including a modified click that opens
		// the host in a new tab: the choice is the signal, not how it was opened.
		track("host_selected", { host: id });
		if (passThroughClick(e)) return;
		e.preventDefault();
		startTransition(() => {
			setCurrent(id);
			router.replace(homeInstallHref(id, libraryTab), sameRouteReplace);
		});
	};

	const gridColumns = () =>
		gridRef.current
			? getComputedStyle(gridRef.current).gridTemplateColumns.split(" ")
				.length
			: 1;

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
		<nav
			aria-label="Install by host"
			className="mx-auto mt-4 w-full max-w-[720px] text-left"
		>
			<SearchParamsSync onChange={syncFromUrl} />
			<div
				ref={gridRef}
				role="group"
				aria-label="Hosts"
				className="grid grid-cols-2 gap-2 sm:grid-cols-4"
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
							animate={
								mounted && !reduceMotion
									? {
											opacity: [0, 1],
											scale: [0.8, 1.01, 1],
											y: [20, 0],
											transition: {
												duration: 0.5,
												delay: index * 0.05,
												type: "spring",
												stiffness: 500,
												damping: 25,
												scale: {
													type: "tween",
													duration: 0.5,
													ease: [0.175, 0.885, 0.32, 1.275],
												},
											},
										}
									: undefined
							}
							whileHover={
								reduceMotion
									? undefined
									: {
											scale: 1.03,
											y: -2,
											transition: {
												type: "spring",
												stiffness: 400,
												damping: 10,
											},
										}
							}
							whileTap={reduceMotion ? undefined : { scale: 0.97 }}
							className={cn(
								"relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring",
								selected
									? "border-fd-primary/50 bg-[var(--color-fd-primary-10)] text-fd-foreground"
									: "border-fd-border bg-[var(--color-fd-surface-raised)] text-fd-muted-foreground hover:border-fd-primary/40 hover:text-fd-foreground",
							)}
						>
							{selected ? (
								<motion.span
									layoutId="host-card-ring"
									className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-fd-primary/35"
									transition={
										reduceMotion
											? { duration: 0 }
											: { type: "spring", stiffness: 420, damping: 34 }
									}
									aria-hidden="true"
								/>
							) : null}
							<span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-fd-border bg-fd-background">
								<HostMark host={item.id} className="h-5 w-5" />
							</span>
							<span className="text-[13px] font-semibold text-fd-foreground">
								{item.name}
							</span>
							<span
								aria-hidden="true"
								className="line-clamp-2 text-[11px] leading-4 text-fd-muted-foreground"
							>
								{item.what}
							</span>
						</motion.a>
					);
				})}
			</div>
			<HostCommandPanel spec={spec} />
		</nav>
	);
}

function HostCommandPanel({ spec }: { spec: HostInstallSpec }) {
	return (
		<SameRouteFade childKey={spec.id} name="host-command">
			<div className="mt-3 space-y-2">
				<p className="text-center text-[12px] leading-5 text-fd-muted-foreground">
					{spec.where}
				</p>
				<InstallSnippet
					text={spec.commands}
					prompt={spec.prompt}
					host={spec.id}
				/>
				{spec.then ? (
					<InstallSnippet
						text={spec.then.commands}
						prompt={spec.then.prompt}
						host={spec.id}
						event="setup_copied"
					/>
				) : null}
				<p className="text-center">
					<Link
						href={spec.href}
						className="font-mono text-[12px] text-fd-primary underline-offset-2 hover:underline"
					>
						{spec.name} docs →
					</Link>
				</p>
			</div>
		</SameRouteFade>
	);
}
