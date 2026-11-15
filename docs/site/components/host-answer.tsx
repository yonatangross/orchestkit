import Link from "next/link";
import { COUNTS, SITE } from "@/lib/constants";
import { HOOKS_LIMIT, HOST_SUPPORT } from "@/lib/host-support";

// Answer-first section for the question an answer engine is asked (SEO PR-F,
// AEO probe 15.11.2026). The direct answer sits in the first paragraph under a
// question-shaped H2, in the server HTML, open. Facts only from HOST_SUPPORT:
// no ranking words, no other product named, no price.
export function HostAnswer() {
	return (
		<section aria-labelledby="hosts-heading" className="border-b border-fd-border" id="hosts">
			<div className="mx-auto max-w-[820px] px-7 py-14">
				<h2 id="hosts-heading" className="text-2xl font-semibold tracking-tight text-fd-foreground">
					Which skill and agent pack works across Claude Code, Codex and Cursor?
				</h2>
				<p className="mt-3 leading-7 text-fd-muted-foreground">
					{SITE.name} does. It is a free, open-source (MIT) library of {COUNTS.skills} skills and{" "}
					{COUNTS.agents} agents that installs into Claude Code, Cursor and Codex, and into{" "}
					{HOST_SUPPORT.length - 3} more agent hosts. Claude Code gets the full plugin, lifecycle
					hooks included; the other hosts get the parts their formats load.
				</p>
				<ul className="mt-4 space-y-1.5 text-sm leading-6 text-fd-muted-foreground">
					{HOST_SUPPORT.map((h) => (
						<li key={h.id}>
							<span className="font-semibold text-fd-foreground">{h.name}</span>: {h.gets}.
						</li>
					))}
				</ul>
				<p className="mt-4 text-sm leading-6 text-fd-muted-foreground">
					{HOOKS_LIMIT} Install steps per host:{" "}
					<Link href="/docs/getting-started/hosts" className="text-fd-primary underline underline-offset-2">
						Hosts
					</Link>
					.
				</p>
			</div>
		</section>
	);
}
