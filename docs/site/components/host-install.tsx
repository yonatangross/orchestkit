"use client";

import { useState } from "react";
import Link from "next/link";
import { HostMark, type HostId } from "@/components/host-marks";
import { InstallSnippet } from "@/components/install-snippet";
import {
	HOST_INSTALLS,
	HOST_INSTALL_BY_ID,
	type HostInstallSpec,
} from "@/lib/host-installs";

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

/** Homepage: pick a host, copy its command. Keeps the Install by host nav. */
export function HostInstallPicker({
	hosts = ["claude", "cursor", "codex", "muse", "pi", "opencode"],
}: {
	hosts?: HostId[];
}) {
	const list = hosts.map((id) => HOST_INSTALL_BY_ID[id]);
	const [active, setActive] = useState<HostId>(list[0]?.id ?? "claude");
	const spec = HOST_INSTALL_BY_ID[active];

	return (
		<nav
			aria-label="Install by host"
			className="mx-auto mt-4 w-full max-w-[640px] text-left"
		>
			<div
				className="flex flex-wrap items-center justify-center gap-2"
			>
				{list.map((item) => {
					const selected = item.id === active;
					return (
						<button
							key={item.id}
							type="button"
							aria-pressed={selected}
							onClick={() => setActive(item.id)}
							className={`inline-flex h-10 items-center gap-2 rounded-lg border px-2.5 font-mono text-[12px] transition-colors ${
								selected
									? "border-fd-primary/50 bg-[var(--color-fd-primary-10)] text-fd-foreground"
									: "border-fd-border bg-[var(--color-fd-surface-raised)] text-fd-muted-foreground hover:border-fd-primary/40 hover:text-fd-foreground"
							}`}
						>
							<HostMark host={item.id} className="h-4 w-4" />
							<span>{item.name}</span>
						</button>
					);
				})}
			</div>
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
		</nav>
	);
}
