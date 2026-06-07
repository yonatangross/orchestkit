import type { ReactNode } from "react";
import { SITE } from "@/lib/constants";
import {
	StructuredData,
	breadcrumbNode,
	organizationNode,
} from "@/components/structured-data";

// Shared shell for standalone trust / marketing pages (about, contact, privacy,
// pricing, compare, alternatives). Server-rendered prose so the content is
// visible in raw HTML to AI crawlers, with Organization + BreadcrumbList JSON-LD
// and consistent typography (no typography plugin in this project — child
// elements are styled via Tailwind arbitrary variants).
export function ContentPage({
	title,
	path,
	lead,
	children,
}: {
	title: string;
	path: string;
	lead?: string;
	children: ReactNode;
}) {
	const url = `${SITE.domain}${path}`;
	return (
		<main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-20">
			<StructuredData
				nodes={[
					organizationNode(),
					breadcrumbNode([
						{ name: SITE.name, url: SITE.domain },
						{ name: title, url },
					]),
				]}
			/>
			<h1
				data-speakable-headline
				className="text-3xl font-semibold tracking-tight text-fd-foreground sm:text-4xl"
			>
				{title}
			</h1>
			{lead ? (
				<p
					data-speakable-summary
					className="mt-4 text-lg leading-7 text-fd-muted-foreground"
				>
					{lead}
				</p>
			) : null}
			<div className="mt-8 [&_a]:text-fd-primary [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-fd-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-fd-foreground [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-fd-foreground [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_h3]:text-fd-foreground [&_li]:my-1.5 [&_li]:text-fd-muted-foreground [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-4 [&_p]:leading-7 [&_p]:text-fd-muted-foreground [&_table]:my-6 [&_table]:w-full [&_table]:text-sm [&_td]:border-fd-border [&_td]:border-b [&_td]:p-2 [&_td]:text-fd-muted-foreground [&_th]:border-fd-border [&_th]:border-b [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-fd-foreground [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6">
				{children}
			</div>
		</main>
	);
}
