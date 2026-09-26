import { Bot, MessageCircle, Trophy } from "lucide-react";
import { CommunityRoomThread } from "@/components/community-room-thread";
import { SITE } from "@/lib/constants";
import { pickWhatsNewPreview, stripMarkdown } from "@/lib/changelog-format";
import { CHANGELOG_ENTRIES } from "@/lib/generated/changelog-data";

function botDigestLine(): string {
	const preview = pickWhatsNewPreview(CHANGELOG_ENTRIES, 4);
	const version = preview?.entry.version ?? SITE.version;
	const picked =
		preview?.items.find((row) => !/^(deps|chore)(\(.+\))?:/i.test(stripMarkdown(row.item))) ??
		preview?.items[0];
	const raw = picked
		? stripMarkdown(picked.item.split("\n")[0])
		: "What's new is on the changelog.";
	const line = raw
		.replace(/\s*\([^)]*#\d+[^)]*\)/g, "")
		.replace(/\s*\([a-f0-9]{7,40}\)/g, "")
		.trim();
	const clipped = line.length > 72 ? `${line.slice(0, 69)}…` : line;
	return `What's new in ork ${version}: ${clipped}`;
}

const ROOM_ROWS = [
	{ Icon: Bot, title: "Release notes", body: "The bot posts what shipped in the latest release." },
	{ Icon: MessageCircle, title: "Questions and fixes", body: "Ask about a skill, a hook, or a host setup." },
	{ Icon: Trophy, title: "Wins", body: "Shipped something with OrchestKit? Tell the room." },
] as const;

/** Example of the WhatsApp group. Chat ticks; the OrchestKit bot once per demo day. */
export function CommunityRoomPreview() {
	return (
		<figure className="card-elevated card-trace mt-8 overflow-hidden rounded-[var(--radius-card)] border border-fd-border bg-[color-mix(in_oklch,var(--color-fd-card)_52%,transparent)] backdrop-blur-md">
			<figcaption className="px-5 pt-5 font-mono text-[11px] font-medium tracking-[0.14em] text-[#15803d] dark:text-[#25D366] uppercase md:px-6 md:pt-6">
				Example of the live room
			</figcaption>
			<div className="grid gap-6 px-5 pt-3 pb-5 md:grid-cols-[minmax(0,240px)_1fr] md:items-center md:px-6 md:pb-6">
				<CommunityRoomThread botLine={botDigestLine()} />
				<div>
					<p className="text-xl font-semibold tracking-tight text-fd-foreground">
						How the WhatsApp group looks
					</p>
					<p className="mt-2 max-w-[36ch] text-sm leading-6 text-pretty text-fd-muted-foreground">
						People talking. The OrchestKit bot drops what&apos;s new about once a day. The door
						above is the invite.
					</p>
					{/* What the thread on the left shows, one row per kind of message.
					    Without it the column held two lines beside a 560px phone and
					    left an empty block at 768 and up (QA N10). */}
					<ul className="mt-6 space-y-4 text-sm leading-6">
						{ROOM_ROWS.map(({ Icon, title, body }) => (
							<li key={title} className="flex gap-3">
								<span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-fd-border bg-[var(--color-fd-surface-raised)] text-fd-muted-foreground">
									<Icon className="h-3.5 w-3.5" aria-hidden="true" />
								</span>
								<span>
									<span className="block font-medium text-fd-foreground">{title}</span>
									<span className="block text-pretty text-fd-muted-foreground">{body}</span>
								</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</figure>
	);
}
