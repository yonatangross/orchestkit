"use client";

import { ArrowRight, CircleDot, MessagesSquare } from "lucide-react";
import { MagicCard } from "@/components/lab/magic-card";
import { SITE } from "@/lib/constants";

function WhatsAppGlyph({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="#25D366">
			<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
		</svg>
	);
}

const doorSurface =
	"relative flex h-full no-underline text-inherit decoration-transparent shadow-none outline-none card-elevated card-lift overflow-hidden rounded-[var(--radius-card)] border border-fd-border bg-[color-mix(in_oklch,var(--color-fd-card)_52%,transparent)] backdrop-blur-md transition-[border-color,transform] duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-primary";

export function CommunityDoors() {
	return (
		<div className="grid gap-3 md:grid-cols-2 md:grid-rows-2">
			<MagicCard className="h-full overflow-hidden rounded-[var(--radius-card)] md:row-span-2">
				<a
					href={SITE.communityJoinUrl}
					className={`${doorSurface} card-trace min-h-[220px] flex-col justify-between p-6 hover:border-[#25D366]/45`}
				>
					<span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#25D366]/25 bg-[#25D366]/10">
						<WhatsAppGlyph className="h-6 w-6" />
					</span>
					<span className="mt-8 block">
						<span className="font-mono text-[11px] font-medium tracking-[0.14em] text-[#25D366] uppercase">
							Live room
						</span>
						<span className="mt-2 block text-xl font-semibold tracking-tight text-fd-foreground">
							WhatsApp
						</span>
						<span className="mt-2 block max-w-[28ch] text-sm leading-6 text-fd-muted-foreground">
							The invite rotates. This is the current door.
						</span>
					</span>
					<span className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366]">
						Join the WhatsApp community
						<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
					</span>
				</a>
			</MagicCard>

			<MagicCard className="h-full overflow-hidden rounded-[var(--radius-card)]">
				<a
					href={`${SITE.github}/discussions`}
					className={`${doorSurface} items-center gap-4 p-5 hover:border-fd-primary/40`}
				>
					<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-fd-border bg-[var(--color-fd-primary-10)] text-fd-primary">
						<MessagesSquare className="h-5 w-5" aria-hidden="true" />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block text-base font-semibold tracking-tight text-fd-foreground">
							GitHub Discussions
						</span>
						<span className="mt-1 block text-sm leading-5 text-fd-muted-foreground">
							Questions and ideas that should stay findable.
						</span>
						<span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary">
							Open Discussions
							<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
						</span>
					</span>
				</a>
			</MagicCard>

			<MagicCard className="h-full overflow-hidden rounded-[var(--radius-card)]">
				<a
					href={`${SITE.github}/issues`}
					className={`${doorSurface} items-center gap-4 p-5 hover:border-fd-primary/40`}
				>
					<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-fd-border bg-[var(--color-fd-primary-10)] text-fd-primary">
						<CircleDot className="h-5 w-5" aria-hidden="true" />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block text-base font-semibold tracking-tight text-fd-foreground">
							GitHub Issues
						</span>
						<span className="mt-1 block text-sm leading-5 text-fd-muted-foreground">
							Bugs and requests. Include host, version, and doctor.
						</span>
						<span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-fd-primary">
							Open Issues
							<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
						</span>
					</span>
				</a>
			</MagicCard>
		</div>
	);
}
