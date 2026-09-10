"use client";

import { startTransition, useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { HostMark, type HostId } from "@/components/host-marks";
import { SameRouteFade, sameRouteReplace } from "@/components/page-transition";
import { InstallSnippet } from "@/components/install-snippet";
import {
	HOST_INSTALLS,
	HOST_INSTALL_BY_ID,
	homeInstallHref,
	type HostInstallSpec,
} from "@/lib/host-installs";
import type { LibraryTab } from "@/lib/library-tab";
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

/** Homepage: pick a host, copy its command. Keeps the Install by host nav. */
export function HostInstallPicker({
	hosts = ["claude", "cursor", "codex", "muse", "pi", "opencode"],
	active = "claude",
	libraryTab = "skills",
}: {
	hosts?: HostId[];
	active?: HostId;
	libraryTab?: LibraryTab;
}) {
	const router = useRouter();
	const list = hosts.map((id) => HOST_INSTALL_BY_ID[id]);
	const resolved =
		list.find((item) => item.id === active)?.id ?? list[0]?.id ?? "claude";
	const [current, setCurrent] = useState<HostId>(resolved);

	useEffect(() => {
		setCurrent(resolved);
	}, [resolved]);

	const spec = HOST_INSTALL_BY_ID[current];

	const pick = (e: MouseEvent<HTMLAnchorElement>, id: HostId) => {
		if (passThroughClick(e)) return;
		e.preventDefault();
		startTransition(() => {
			setCurrent(id);
			router.replace(homeInstallHref(id, libraryTab), sameRouteReplace);
		});
	};

	return (
		<nav
			aria-label="Install by host"
			className="mx-auto mt-4 w-full max-w-[640px] text-left"
		>
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
				{list.map((item) => {
					const selected = item.id === current;
					return (
						<a
							key={item.id}
							href={homeInstallHref(item.id, libraryTab)}
							aria-current={selected ? "true" : undefined}
							onClick={(e) => pick(e, item.id)}
							className={cn(
								"relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
								selected
									? "border-fd-primary/50 bg-[var(--color-fd-primary-10)] text-fd-foreground"
									: "border-fd-border bg-[var(--color-fd-surface-raised)] text-fd-muted-foreground hover:border-fd-primary/40 hover:text-fd-foreground",
							)}
						>
							{selected ? (
								<motion.span
									layoutId="host-card-ring"
									className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-fd-primary/35"
									transition={{ type: "spring", stiffness: 420, damping: 34 }}
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
						</a>
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
