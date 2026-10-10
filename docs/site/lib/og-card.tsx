// Link cards (1200x630) for skill, agent and doc pages, in the style of the site
// link card (design/og-card, app/opengraph-image.tsx): BG #05070F, the Geist
// "OrchestKit" wordmark under an indigo-to-violet bar, a frosted panel.
// Layout: approved-design/mockup.txt beside the route. Nothing is drawn in the
// bottom 95 px, where X lays its title bar (design/og-card/README.md).

import type { ReactNode } from "react";
import type { AgentCardData, CardKind, SkillCardData } from "@/lib/og-card-data";

export const CARD = { width: 1200, height: 630 } as const;
const FG = "#E5E8F0";
const MUTED = "#AFB4C1";
const DIM = "#8C92A3";
const INDIGO = "#457CFD";
const VIOLET = "#9982F8";
const HAIR = "rgba(255, 255, 255, 0.13)";
const DOMAIN = "orchestkit.yonyon.ai";

function Bar({ width }: { width: number }) {
	return <div style={{ width, height: 4, borderRadius: 2, backgroundImage: `linear-gradient(90deg, ${INDIGO}, ${VIOLET})` }} />;
}

function Header({ kind, handle }: { kind: CardKind; handle?: string }) {
	return (
		<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
			<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
				<Bar width={44} />
				<div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
					<span style={{ fontFamily: "Geist", fontWeight: 700, fontSize: 30, color: FG, letterSpacing: -0.5 }}>OrchestKit</span>
					{kind !== "doc" && <span style={{ fontFamily: "Geist", fontWeight: 500, fontSize: 22, color: DIM }}>{kind}</span>}
				</div>
			</div>
			{handle && <span style={{ fontFamily: "Geist Mono", fontSize: 22, color: MUTED, marginTop: 14 }}>{handle}</span>}
		</div>
	);
}

function Footer() {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
			<Bar width={28} />
			<span style={{ fontFamily: "Geist", fontWeight: 500, fontSize: 20, color: MUTED }}>{DOMAIN}</span>
		</div>
	);
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: 500,
				height: 360,
				padding: "20px 24px",
				borderRadius: 22,
				backgroundColor: "rgba(255, 255, 255, 0.045)",
				border: `1px solid ${HAIR}`,
				overflow: "hidden",
			}}
		>
			<span style={{ fontFamily: "Geist", fontWeight: 500, fontSize: 16, color: DIM, marginBottom: 12 }}>{label}</span>
			{children}
		</div>
	);
}

function Shell({ kind, handle, left, right }: { kind: CardKind; handle?: string; left: ReactNode; right?: ReactNode }) {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				padding: "48px 64px 0 64px",
				backgroundColor: "#05070F",
				backgroundImage: "radial-gradient(circle at 88% 30%, rgba(69, 124, 253, 0.22), rgba(5, 7, 15, 0) 55%)",
				color: FG,
			}}
		>
			<Header kind={kind} handle={handle} />
			<div style={{ display: "flex", justifyContent: "space-between", marginTop: 26, height: 360 }}>
				<div style={{ display: "flex", flexDirection: "column", width: right ? 540 : 1000 }}>{left}</div>
				{right}
			</div>
			<div style={{ display: "flex", marginTop: 22 }}>
				<Footer />
			</div>
		</div>
	);
}

function titleSize(title: string, wide: boolean) {
	const n = title.length;
	if (wide) return n > 40 ? 52 : 64;
	return n > 26 ? 44 : n > 18 ? 52 : 62;
}

export function skillCardElement(title: string, handle: string, d: SkillCardData) {
	const left = (
		<div style={{ display: "flex", flexDirection: "column" }}>
			<span style={{ fontFamily: "Geist", fontWeight: 700, fontSize: titleSize(title, false), lineHeight: 1.05, letterSpacing: -1.5 }}>{title}</span>
			<span style={{ fontFamily: "Geist", fontWeight: 500, fontSize: 25, color: MUTED, marginTop: 18, lineHeight: 1.35 }}>{d.verdict}</span>
			<div style={{ display: "flex", flexDirection: "column", marginTop: 22, gap: 8 }}>
				{d.uses.map((u) => (
					<div key={u} style={{ display: "flex", gap: 10, fontFamily: "Geist", fontWeight: 500, fontSize: 21, color: DIM }}>
						<span style={{ color: VIOLET }}>›</span>
						<span>{u}</span>
					</div>
				))}
			</div>
		</div>
	);
	const right = (
		<Panel label={d.sampleIsInvoke ? "invoke" : "example output"}>
			{d.sample.map((line, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: sample lines repeat
				<span key={i} style={{ fontFamily: "Geist Mono", fontSize: 14, lineHeight: 1.45, color: FG, whiteSpace: "pre" }}>
					{line || " "}
				</span>
			))}
		</Panel>
	);
	return <Shell kind="skill" handle={handle} left={left} right={right} />;
}

export function agentCardElement(title: string, handle: string, d: AgentCardData) {
	const left = (
		<div style={{ display: "flex", flexDirection: "column" }}>
			<span style={{ fontFamily: "Geist", fontWeight: 700, fontSize: titleSize(title, false), lineHeight: 1.05, letterSpacing: -1.5 }}>{title}</span>
			<span style={{ fontFamily: "Geist", fontWeight: 500, fontSize: 25, color: MUTED, marginTop: 18, lineHeight: 1.35 }}>{d.line}</span>
			<span style={{ fontFamily: "Geist", fontWeight: 500, fontSize: 16, color: DIM, marginTop: 30 }}>tools</span>
			<div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
				{d.tools.map((t) => (
					<span key={t} style={{ fontFamily: "Geist Mono", fontSize: 16, color: FG, padding: "5px 10px", borderRadius: 8, border: `1px solid ${HAIR}` }}>
						{t}
					</span>
				))}
				{d.moreTools > 0 && <span style={{ fontFamily: "Geist Mono", fontSize: 16, color: DIM, padding: "5px 4px" }}>+{d.moreTools}</span>}
			</div>
		</div>
	);
	const right = (
		<Panel label="delegates to">
			{d.delegates.length ? (
				d.delegates.map((a) => (
					<div key={a} style={{ display: "flex", gap: 12, fontFamily: "Geist Mono", fontSize: 19, color: FG, marginBottom: 12 }}>
						<span style={{ color: VIOLET }}>→</span>
						<span>{a}</span>
					</div>
				))
			) : (
				<span style={{ fontFamily: "Geist", fontWeight: 500, fontSize: 20, color: MUTED }}>No sub-agents. It works alone.</span>
			)}
		</Panel>
	);
	return <Shell kind="agent" handle={handle} left={left} right={right} />;
}

export function docCardElement(title: string, description: string) {
	const left = (
		<div style={{ display: "flex", flexDirection: "column" }}>
			<span style={{ fontFamily: "Geist", fontWeight: 700, fontSize: titleSize(title, true), lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 1000 }}>{title}</span>
			{description && (
				<span style={{ fontFamily: "Geist", fontWeight: 500, fontSize: 27, color: MUTED, marginTop: 22, lineHeight: 1.35, maxWidth: 900 }}>
					{description.length > 150 ? `${description.slice(0, 147)}...` : description}
				</span>
			)}
		</div>
	);
	return <Shell kind="doc" left={left} />;
}
