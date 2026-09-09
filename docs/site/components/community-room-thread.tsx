"use client";

import { useEffect, useRef, useState } from "react";
import { SITE } from "@/lib/constants";

export type RoomKind = "chat" | "bot";

export type RoomBubble = {
	id: string;
	who: string;
	text: string;
	side: "in" | "out";
	kind: RoomKind;
	time: string;
	initial: string;
	tone: string;
	reaction?: string;
};

const PEOPLE: Record<string, { initial: string; tone: string }> = {
	Yonatan: { initial: "Y", tone: "text-[#25D366]" },
	Noa: { initial: "N", tone: "text-[var(--yy-george-cool-text)]" },
	Ari: { initial: "A", tone: "text-fd-primary" },
	Lea: { initial: "L", tone: "text-[var(--yy-george-warm-text)]" },
	Sam: { initial: "S", tone: "text-fd-foreground" },
};

const CHAT: Omit<RoomBubble, "id" | "kind">[] = [
	{
		who: "Yonatan",
		side: "in",
		text: "Welcome in 👋 This is the live room — ask when something breaks. Wins count too.",
		time: "09:12",
		reaction: "👋 3",
		...PEOPLE.Yonatan,
	},
	{
		who: "Noa",
		side: "in",
		text: "SessionStart ran twice on my machine 👀 Anyone else seeing that?",
		time: "09:14",
		...PEOPLE.Noa,
	},
	{
		who: "Ari",
		side: "in",
		text: "Usually the entries map. Run doctor first ✅",
		time: "09:15",
		reaction: "👍 2",
		...PEOPLE.Ari,
	},
	{
		who: "Lea",
		side: "out",
		text: "The thread caught a frontmatter miss before I opened the PR 🙌",
		time: "09:18",
		...PEOPLE.Lea,
	},
	{
		who: "Sam",
		side: "in",
		text: "Anyone using the doctor output as a PR checklist?",
		time: "11:42",
		...PEOPLE.Sam,
	},
	{
		who: "Noa",
		side: "in",
		text: "Yes. Caught a missing hook name before CI did 🔥",
		time: "11:44",
		reaction: "🔥 4",
		...PEOPLE.Noa,
	},
	{
		who: "Ari",
		side: "in",
		text: "Wins count too. Ship it, then tell the room.",
		time: "16:08",
		...PEOPLE.Ari,
	},
	{
		who: "Lea",
		side: "out",
		text: "Updating after the daily drop ✨",
		time: "16:11",
		...PEOPLE.Lea,
	},
];

const WINDOW = 4;
const CHAT_MS = 2100;
const BOT_HOLD_MS = 5600;

export function buildRoomPlaylist(botLine: string): RoomBubble[] {
	const chat = CHAT.map((bubble, i) => ({
		...bubble,
		id: `chat-${i}`,
		kind: "chat" as const,
	}));
	const bot: RoomBubble = {
		id: "bot-daily",
		who: SITE.name,
		side: "in",
		kind: "bot",
		text: botLine,
		time: "08:01",
		initial: "OK",
		tone: "text-fd-primary",
		reaction: "👀 5",
	};
	return [...chat.slice(0, 5), bot, ...chat.slice(5)];
}

function windowAt(playlist: RoomBubble[], endIndex: number): RoomBubble[] {
	const out: RoomBubble[] = [];
	for (let i = WINDOW - 1; i >= 0; i--) {
		out.push(playlist[(endIndex - i + playlist.length) % playlist.length]);
	}
	return out;
}

function WhatsAppGlyph({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="#25D366">
			<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
		</svg>
	);
}

function Avatar({ initial, bot }: { initial: string; bot?: boolean }) {
	return (
		<span
			className={
				bot
					? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-fd-primary/30 bg-[color-mix(in_oklch,var(--color-fd-primary)_16%,transparent)] text-[8px] font-semibold tracking-tight text-fd-primary"
					: "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-fd-border bg-[color-mix(in_oklch,var(--color-fd-muted)_80%,transparent)] text-[9px] font-semibold text-fd-foreground"
			}
		>
			{initial}
		</span>
	);
}

function BubbleView({ bubble, pop }: { bubble: RoomBubble; pop: boolean }) {
	const bot = bubble.kind === "bot";
	const outgoing = bubble.side === "out";
	return (
		<div className={`flex items-end gap-1.5 ${outgoing ? "flex-row-reverse" : ""} ${pop ? "community-room-pop" : ""}`}>
			{outgoing ? null : <Avatar initial={bubble.initial} bot={bot} />}
			<div
				className={
					outgoing
						? "max-w-[86%] rounded-2xl rounded-br-md border border-[#25D366]/20 bg-[#25D366]/10 px-2.5 py-1.5"
						: bot
							? "max-w-[86%] rounded-2xl rounded-bl-md border border-fd-primary/25 bg-[color-mix(in_oklch,var(--color-fd-primary)_10%,transparent)] px-2.5 py-1.5"
							: "max-w-[86%] rounded-2xl rounded-bl-md border border-fd-border bg-[color-mix(in_oklch,var(--color-fd-muted)_70%,transparent)] px-2.5 py-1.5"
				}
			>
				<p className={`flex items-center gap-1.5 text-[10px] font-medium ${bubble.tone}`}>
					<span>{bubble.who}</span>
					{bot ? (
						<span className="rounded-[3px] border border-fd-primary/30 bg-[color-mix(in_oklch,var(--color-fd-primary)_14%,transparent)] px-1 py-px text-[8px] font-semibold tracking-[0.08em] text-fd-primary uppercase">
							Bot
						</span>
					) : null}
				</p>
				<p className="mt-0.5 text-[11px] leading-4 text-fd-foreground">{bubble.text}</p>
				<p className="mt-1 text-right text-[9px] leading-none text-fd-muted-foreground">{bubble.time}</p>
				{bubble.reaction ? (
					<span className="mt-1 inline-flex rounded-full border border-fd-border bg-[color-mix(in_oklch,var(--color-fd-card)_80%,transparent)] px-1.5 py-0.5 text-[10px] leading-none text-fd-foreground">
						{bubble.reaction}
					</span>
				) : null}
			</div>
		</div>
	);
}

/** Animated example thread. Humans tick often; the OrchestKit bot once per demo day. */
export function CommunityRoomThread({ botLine }: { botLine: string }) {
	const playlist = buildRoomPlaylist(botLine);
	const startIndex = playlist.length - 1;
	const [endIndex, setEndIndex] = useState(startIndex);
	const [motionOn, setMotionOn] = useState(false);
	const indexRef = useRef(startIndex);

	useEffect(() => {
		const reduced =
			typeof window.matchMedia !== "function" ||
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (reduced) return undefined;

		setMotionOn(true);
		let timer = 0;
		const step = () => {
			const next = (indexRef.current + 1) % playlist.length;
			indexRef.current = next;
			setEndIndex(next);
			const hold = playlist[next].kind === "bot" ? BOT_HOLD_MS : CHAT_MS;
			timer = window.setTimeout(step, hold);
		};
		timer = window.setTimeout(step, CHAT_MS);
		return () => window.clearTimeout(timer);
	}, [playlist.length]);

	const visible = windowAt(playlist, endIndex);
	const showDayMark = visible.some((bubble) => bubble.kind === "bot");

	return (
		<div
			aria-hidden="true"
			className="mx-auto w-[236px] rounded-[1.75rem] border border-fd-border bg-[color-mix(in_oklch,var(--color-fd-foreground)_7%,transparent)] p-1.5 shadow-[var(--shadow-overlay)]"
		>
			<div className="overflow-hidden rounded-[1.35rem] border border-fd-border bg-[color-mix(in_oklch,var(--color-fd-card)_78%,transparent)]">
				<div className="flex items-center gap-2.5 border-b border-fd-border px-3 py-2.5">
					<span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#25D366]/25 bg-[#25D366]/10">
						<WhatsAppGlyph className="h-4 w-4" />
					</span>
					<div className="min-w-0">
						<p className="truncate text-[13px] font-semibold tracking-tight text-fd-foreground">
							{SITE.name}
						</p>
						<p className="text-[10px] leading-4 text-fd-muted-foreground">
							WhatsApp community · 48
						</p>
					</div>
				</div>
				<div className="flex min-h-[268px] flex-col justify-end gap-2.5 px-2.5 py-3">
					{showDayMark ? (
						<p className="text-center text-[9px] font-medium tracking-[0.08em] text-fd-muted-foreground uppercase">
							Today
						</p>
					) : null}
					{visible.map((bubble, i) => (
						<BubbleView
							key={`${endIndex}-${bubble.id}`}
							bubble={bubble}
							pop={motionOn && i === visible.length - 1}
						/>
					))}
				</div>
				<div className="flex items-center gap-2 border-t border-fd-border px-2.5 py-2">
					<span className="flex-1 rounded-full border border-fd-border bg-[color-mix(in_oklch,var(--color-fd-muted)_50%,transparent)] px-2.5 py-1 text-[10px] text-fd-muted-foreground">
						Message
					</span>
					<span className="text-[12px] text-[#25D366]">➤</span>
				</div>
			</div>
		</div>
	);
}
