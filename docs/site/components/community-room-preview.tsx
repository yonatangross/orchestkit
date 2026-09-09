import { SITE } from "@/lib/constants";

type Bubble = {
	who: string;
	text: string;
	side: "in" | "out";
};

const THREAD: readonly Bubble[] = [
	{
		who: "Yonatan",
		side: "in",
		text: "Welcome in. This is the live room — ask when something breaks. Wins count too.",
	},
	{
		who: "Noa",
		side: "in",
		text: "SessionStart ran twice on my machine. Anyone else seeing that?",
	},
	{
		who: "Ari",
		side: "in",
		text: "Usually the entries map. Run doctor first.",
	},
	{
		who: "Lea",
		side: "out",
		text: "The thread caught a frontmatter miss before I opened the PR.",
	},
];

function WhatsAppGlyph({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="#25D366">
			<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
		</svg>
	);
}

function RoomPhone() {
	return (
		<div
			aria-hidden="true"
			className="mx-auto w-[220px] rounded-[1.75rem] border border-fd-border bg-[color-mix(in_oklch,var(--color-fd-foreground)_7%,transparent)] p-1.5 shadow-[var(--shadow-overlay)]"
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
						<p className="text-[10px] leading-4 text-fd-muted-foreground">WhatsApp community</p>
					</div>
				</div>
				<div className="space-y-2 px-2.5 py-3">
					{THREAD.map((bubble) => (
						<div
							key={`${bubble.who}-${bubble.text}`}
							className={
								bubble.side === "out"
									? "ml-auto max-w-[88%] rounded-2xl rounded-br-md border border-[#25D366]/20 bg-[#25D366]/10 px-2.5 py-1.5"
									: "max-w-[88%] rounded-2xl rounded-bl-md border border-fd-border bg-[color-mix(in_oklch,var(--color-fd-muted)_70%,transparent)] px-2.5 py-1.5"
							}
						>
							<p
								className={
									bubble.side === "out"
										? "text-[10px] font-medium text-[#25D366]"
										: "text-[10px] font-medium text-fd-primary"
								}
							>
								{bubble.who}
							</p>
							<p className="mt-0.5 text-[11px] leading-4 text-fd-foreground">{bubble.text}</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

/** Still illustration of the WhatsApp group. Not a live feed. */
export function CommunityRoomPreview() {
	return (
		<figure className="card-elevated card-trace mt-8 overflow-hidden rounded-[var(--radius-card)] border border-fd-border bg-[color-mix(in_oklch,var(--color-fd-card)_52%,transparent)] backdrop-blur-md">
			<figcaption className="px-5 pt-5 font-mono text-[11px] font-medium tracking-[0.14em] text-[#25D366] uppercase md:px-6 md:pt-6">
				Example of the live room
			</figcaption>
			<div className="grid gap-6 px-5 pt-3 pb-5 md:grid-cols-[minmax(0,240px)_1fr] md:items-center md:px-6 md:pb-6">
				<RoomPhone />
				<div>
					<p className="text-xl font-semibold tracking-tight text-fd-foreground">
						How the WhatsApp group looks
					</p>
					<p className="mt-2 max-w-[36ch] text-sm leading-6 text-fd-muted-foreground">
						People in the thread, group identity, the actual room. This is a still — the door
						above is the invite.
					</p>
				</div>
			</div>
		</figure>
	);
}
