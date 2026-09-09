"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
	Check,
	ChevronLeft,
	ChevronRight,
	Code2,
	Layers,
	Monitor,
	Server,
} from "lucide-react";
import { HostMark, type HostId } from "@/components/host-marks";
import { InstallSnippet } from "@/components/install-snippet";
import { COUNTS } from "@/lib/constants";
import {
	HOST_INSTALLS,
	HOST_INSTALL_BY_ID,
	STACK_HINTS,
	installCommandsForHost,
	isSkillsShHost,
	stackHintCopy,
	type StackHint,
} from "@/lib/host-installs";

type Step = 0 | 1;

const STACK_ICONS = {
	backend: Server,
	frontend: Monitor,
	fullstack: Layers,
	python: Code2,
} as const;

function honesty(host: HostId): string | null {
	switch (host) {
		case "cursor":
			return "No cursor install CLI. Paste the marketplace slug in Settings → Plugins.";
		case "codex":
			return "ork-codex is a portable pack. Not the Claude Code plugin.";
		case "muse":
			return "No ork-muse pack. Skills.sh writes SKILL.md. Muse hooks stay in .muse/hooks.json.";
		case "pi":
			return "Shipped pi manifest (#4001). Command is pi install, not ork-pi. Hooks still do not port.";
		case "opencode":
			return "No OpenCode marketplace pack. Same skills.sh starter as Muse.";
		default:
			return null;
	}
}

export function SetupWizard() {
	const [currentStep, setCurrentStep] = useState<Step>(0);
	const [host, setHost] = useState<HostId>("claude");
	const [stack, setStack] = useState<StackHint | null>(null);

	const spec = HOST_INSTALL_BY_ID[host];
	const commands = useMemo(
		() => installCommandsForHost(host, stack),
		[host, stack],
	);
	const hint = stackHintCopy(host, stack);
	const note = honesty(host);

	const goNext = useCallback(() => {
		setCurrentStep((s) => (s === 0 ? 1 : s));
	}, []);

	const goBack = useCallback(() => {
		setCurrentStep((s) => (s === 1 ? 0 : s));
	}, []);

	const pickClaude = useCallback(() => {
		setHost("claude");
		setCurrentStep(0);
	}, []);

	const selectStack = useCallback((id: StackHint) => {
		setStack((prev) => (prev === id ? null : id));
	}, []);

	return (
		<div className="not-prose">
			<div className="overflow-hidden rounded-xl border border-fd-border">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-fd-border bg-fd-muted/50 px-4 py-3">
					<p className="text-[12.5px] leading-5 text-fd-muted-foreground">
						Pick the host you run. Stack is optional and never a second plugin.
					</p>
					<button
						type="button"
						onClick={pickClaude}
						aria-pressed={host === "claude" && currentStep === 0}
						className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
							host === "claude"
								? "border-[var(--color-fd-primary-30)] bg-[var(--color-fd-primary-10)] text-fd-primary shadow-sm"
								: "border-fd-border text-fd-muted-foreground hover:border-fd-border hover:bg-fd-muted"
						}`}
					>
						I&apos;m on Claude Code, just copy
					</button>
				</div>

				<div className="flex flex-col lg:flex-row">
					<div className="flex-1 p-5 lg:w-[60%]">
						<div className="mb-5 flex items-center gap-2">
							{([0, 1] as const).map((i) => (
								<button
									key={i}
									type="button"
									onClick={() => setCurrentStep(i)}
									aria-current={currentStep === i ? "step" : undefined}
									aria-label={
										i === 0 ? "Step 1: Host" : "Step 2: Stack hint"
									}
									className={`flex items-center gap-2 ${i < 1 ? "flex-1" : ""}`}
								>
									<span
										className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all ${
											currentStep === i
												? "bg-fd-primary text-fd-primary-foreground shadow-sm"
												: currentStep > i
													? "bg-[var(--color-fd-primary-20)] text-fd-primary"
													: "bg-fd-muted text-fd-muted-foreground"
										}`}
									>
										{currentStep > i ? (
											<Check className="h-3.5 w-3.5" />
										) : (
											i + 1
										)}
									</span>
									<span
										className={`hidden text-xs font-medium sm:inline ${
											currentStep === i
												? "text-fd-foreground"
												: "text-fd-muted-foreground"
										}`}
									>
										{i === 0 ? "Host" : "Stack"}
									</span>
									{i < 1 && (
										<div
											className={`mx-2 hidden h-px flex-1 sm:block ${
												currentStep > i
													? "bg-[var(--color-fd-primary-30)]"
													: "bg-fd-border"
											}`}
										/>
									)}
								</button>
							))}
						</div>

						{currentStep === 0 && (
							<div>
								<p className="mb-3 text-sm font-medium text-fd-foreground">
									Which host do you run?
								</p>
								<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
									{HOST_INSTALLS.map((item) => {
										const active = host === item.id;
										return (
											<button
												key={item.id}
												type="button"
												onClick={() => setHost(item.id)}
												aria-pressed={active}
												className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all ${
													active
														? "border-[var(--color-fd-primary-30)] bg-[var(--color-fd-primary-10)] shadow-sm"
														: "border-fd-border hover:border-fd-border hover:bg-fd-muted"
												}`}
											>
												<HostMark
													host={item.id}
													className={`h-6 w-6 ${
														active
															? "text-fd-primary"
															: "text-fd-muted-foreground"
													}`}
												/>
												<p
													className={`text-sm font-medium ${
														active
															? "text-fd-primary"
															: "text-fd-foreground"
													}`}
												>
													{item.name}
												</p>
											</button>
										);
									})}
								</div>
							</div>
						)}

						{currentStep === 1 && (
							<div>
								<p className="mb-1 text-sm font-medium text-fd-foreground">
									Optional stack hint
								</p>
								<p className="mb-3 text-[12.5px] leading-5 text-fd-muted-foreground">
								Does not pick another plugin. Claude and Cursor keep the
								same install. Codex keeps ork-codex. Pi keeps{" "}
								<code className="font-mono text-[11px]">pi install</code>.
								Muse and OpenCode may add extra{" "}
								<code className="font-mono text-[11px]">-s</code> flags
								to the starter 12.
								</p>
								<div className="grid grid-cols-2 gap-3">
									{STACK_HINTS.map((opt) => {
										const active = stack === opt.id;
										const Icon = STACK_ICONS[opt.id];
										return (
											<button
												key={opt.id}
												type="button"
												onClick={() => selectStack(opt.id)}
												aria-pressed={active}
												className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all ${
													active
														? "border-[var(--color-fd-primary-30)] bg-[var(--color-fd-primary-10)] shadow-sm"
														: "border-fd-border hover:border-fd-border hover:bg-fd-muted"
												}`}
											>
												<Icon
													className={`h-6 w-6 ${
														active
															? "text-fd-primary"
															: "text-fd-muted-foreground"
													}`}
												/>
												<div>
													<p
														className={`text-sm font-medium ${
															active
																? "text-fd-primary"
																: "text-fd-foreground"
														}`}
													>
														{opt.label}
													</p>
													<p className="mt-0.5 text-[11px] text-fd-muted-foreground">
														{opt.description}
													</p>
												</div>
											</button>
										);
									})}
								</div>
							</div>
						)}

						<div className="mt-6 flex items-center justify-between">
							<button
								type="button"
								onClick={goBack}
								disabled={currentStep === 0}
								className="inline-flex items-center gap-1 rounded-lg border border-fd-border px-3 py-1.5 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-muted disabled:cursor-not-allowed disabled:opacity-40"
							>
								<ChevronLeft className="h-4 w-4" />
								Back
							</button>
							<button
								type="button"
								onClick={goNext}
								disabled={currentStep === 1}
								className="inline-flex items-center gap-1 rounded-lg border border-fd-border px-3 py-1.5 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-muted disabled:cursor-not-allowed disabled:opacity-40"
							>
								Next
								<ChevronRight className="h-4 w-4" />
							</button>
						</div>
					</div>

					<aside className="border-t border-fd-border bg-fd-muted/30 p-5 lg:w-[40%] lg:border-t-0 lg:border-l">
						<div className="mb-4 flex items-center gap-2.5">
							<span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-fd-border bg-fd-background">
								<HostMark host={host} />
							</span>
							<div className="min-w-0">
								<p className="text-sm font-semibold text-fd-foreground">
									{spec.name}
								</p>
								<p className="mt-0.5 text-[12px] leading-5 text-fd-muted-foreground">
									{spec.what}
								</p>
							</div>
						</div>

						<p className="mb-3 text-[12px] leading-5 text-fd-muted-foreground">
							{spec.where}
						</p>

						{(host === "claude" || host === "cursor") && (
							<dl className="mb-3 grid grid-cols-3 gap-2 text-center">
								<div>
									<dt className="text-[10px] uppercase tracking-wider text-fd-muted-foreground">
										Skills
									</dt>
									<dd className="font-mono text-sm text-fd-foreground">
										{COUNTS.skills}
									</dd>
								</div>
								<div>
									<dt className="text-[10px] uppercase tracking-wider text-fd-muted-foreground">
										Agents
									</dt>
									<dd className="font-mono text-sm text-fd-foreground">
										{COUNTS.agents}
									</dd>
								</div>
								<div>
									<dt className="text-[10px] uppercase tracking-wider text-fd-muted-foreground">
										Hooks
									</dt>
									<dd className="font-mono text-sm text-fd-foreground">
										{host === "cursor" ? "off" : COUNTS.hooks}
									</dd>
								</div>
							</dl>
						)}

						<div className="space-y-2">
							<InstallSnippet
								text={commands}
								prompt={spec.prompt}
								host={host}
							/>
							{spec.then ? (
								<div className="space-y-1.5">
									<p className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-fd-muted-foreground">
										{spec.then.label}
									</p>
									<InstallSnippet
										text={spec.then.commands}
										prompt={spec.then.prompt}
										host={host}
									/>
								</div>
							) : null}
						</div>

						{hint ? (
							<p className="mt-3 text-[12.5px] leading-5 text-fd-muted-foreground">
								{hint}
							</p>
						) : null}

						{note ? (
							<p className="mt-3 text-[12.5px] leading-5 text-fd-muted-foreground">
								{note}
							</p>
						) : null}

						{isSkillsShHost(host) && stack ? (
							<p className="mt-2 font-mono text-[11px] text-fd-muted-foreground">
								Still one skills.sh command. No second plugin.
							</p>
						) : null}

						<p className="mt-4">
							<Link
								href={spec.href}
								className="font-mono text-[12px] text-fd-primary underline-offset-2 hover:underline"
							>
								{spec.name} docs →
							</Link>
						</p>
					</aside>
				</div>
			</div>
		</div>
	);
}
