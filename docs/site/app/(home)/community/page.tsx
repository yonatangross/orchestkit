import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
	title: "Community",
	description: `Join the ${SITE.name} WhatsApp community, GitHub Discussions, and issue tracker. The WhatsApp thread is the live room; GitHub stays searchable.`,
	alternates: { canonical: `${SITE.domain}/community` },
};

function WhatsAppGlyph({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="#25D366">
			<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
		</svg>
	);
}

export default function CommunityPage() {
	return (
		<ContentPage
			title={`The ${SITE.name} community`}
			path="/community"
			lead="WhatsApp is the live room. GitHub Discussions stay searchable. Issues are for bugs. There is no Discord and no paid support plan."
		>
			<div className="not-prose grid gap-3 sm:grid-cols-3">
				<a
					href={SITE.communityJoinUrl}
					className="rounded-xl border border-fd-border bg-[var(--color-fd-surface-raised)] p-4 no-underline transition-colors hover:border-[#25D366]/50"
				>
					<WhatsAppGlyph className="h-6 w-6" />
					<p className="mt-3 text-sm font-semibold text-fd-foreground">WhatsApp</p>
					<p className="mt-1 text-[13px] leading-5 text-fd-muted-foreground">
						Join the community. Invite rotates; this link is the current door.
					</p>
				</a>
				<a
					href={`${SITE.github}/discussions`}
					className="rounded-xl border border-fd-border bg-[var(--color-fd-surface-raised)] p-4 no-underline transition-colors hover:border-fd-primary/50"
				>
					<p className="text-sm font-semibold text-fd-foreground">GitHub Discussions</p>
					<p className="mt-1 text-[13px] leading-5 text-fd-muted-foreground">
						Questions, ideas, and showcase posts that should stay findable.
					</p>
				</a>
				<a
					href={`${SITE.github}/issues`}
					className="rounded-xl border border-fd-border bg-[var(--color-fd-surface-raised)] p-4 no-underline transition-colors hover:border-fd-primary/50"
				>
					<p className="text-sm font-semibold text-fd-foreground">GitHub Issues</p>
					<p className="mt-1 text-[13px] leading-5 text-fd-muted-foreground">
						Bugs and feature requests. Include host, plugin version, and /ork:doctor.
					</p>
				</a>
			</div>

			<h2>WhatsApp, mocked</h2>
			<p>
				This is a mock of the room, not a live feed. Bubbles below are
				illustrative. Join to see the real thread.
			</p>

			<div className="not-prose overflow-hidden rounded-2xl border border-fd-border">
				<div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
					<WhatsAppGlyph className="h-8 w-8" />
					<div>
						<p className="text-sm font-semibold">OrchestKit</p>
						<p className="text-[11px] text-white/70">Community · mock</p>
					</div>
				</div>
				<div className="space-y-3 bg-[#0b141a] p-4">
					<div className="max-w-[85%] rounded-lg rounded-tl-sm bg-[#202c33] px-3 py-2 text-[13px] leading-5 text-[#e9edef]">
						<p className="text-[11px] font-medium text-[#8696a0]">Maintainer</p>
						<p className="mt-0.5">
							New here: install with <code className="text-[#53bdeb]">claude install orchestkit/ork</code>, then run{" "}
							<code className="text-[#53bdeb]">/ork:doctor</code>.
						</p>
					</div>
					<div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-[#005c4b] px-3 py-2 text-[13px] leading-5 text-[#e9edef]">
						<p>
							Cursor host: same marketplace, new chat after enable. Hooks do not
							register there.
						</p>
					</div>
					<div className="max-w-[85%] rounded-lg rounded-tl-sm bg-[#202c33] px-3 py-2 text-[13px] leading-5 text-[#e9edef]">
						<p className="text-[11px] font-medium text-[#8696a0]">Maintainer</p>
						<p className="mt-0.5">
							Muse Code is skills-only for now. No ork-muse pack. Pi is{" "}
							<code>pi install</code>, not an ork-pi pack.
						</p>
					</div>
				</div>
				<p className="bg-[#0b141a] px-4 pb-3 text-[11px] text-[#8696a0]">
					Mock UI. Not live messages.
				</p>
			</div>

			<p>
				<a href={SITE.communityJoinUrl}>Join the WhatsApp community</a>
				{" · "}
				<a href={`${SITE.github}/discussions`}>Open Discussions</a>
			</p>
		</ContentPage>
	);
}
