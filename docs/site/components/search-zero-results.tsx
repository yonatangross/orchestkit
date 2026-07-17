"use client";

// Zero-result rescue for the ⌘K search dialog. Instead of a dead end it shows
// "did you mean" (closest page titles by edit distance) plus browse-section
// links. The title list is loaded via dynamic import so the generated index
// stays OUT of the layout bundle — it only loads when a zero-result occurs.

import Link from "next/link";
import { useEffect, useState } from "react";
import { zeroResultSuggestions, type Suggestion } from "@/lib/search-suggest";

const BROWSE_LINKS: { name: string; url: string }[] = [
	{ name: "Getting started", url: "/docs/getting-started/installation" },
	{ name: "Guides", url: "/docs/guides/cc-adoption" },
	{ name: "Skills", url: "/docs/skills/overview" },
	{ name: "Agents", url: "/docs/agents/overview" },
	{ name: "Hooks", url: "/docs/hooks/overview" },
];

export function SearchZeroResults({
	query,
	onNavigate,
}: {
	query: string;
	onNavigate?: () => void;
}) {
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

	useEffect(() => {
		let alive = true;
		import("@/lib/generated/docs-search-index")
			.then(({ DOCS_SEARCH_INDEX }) => {
				if (alive) {
					setSuggestions(zeroResultSuggestions(query, DOCS_SEARCH_INDEX, 3));
				}
			})
			.catch(() => {});
		return () => {
			alive = false;
		};
	}, [query]);

	return (
		<div className="flex flex-col gap-4 px-4 py-6 text-sm">
			<p className="text-fd-muted-foreground">
				No results for{" "}
				<span className="font-medium text-fd-foreground">
					&ldquo;{query}&rdquo;
				</span>
			</p>
			{suggestions.length > 0 && (
				<div>
					<p className="mb-1.5 text-xs font-medium text-fd-muted-foreground">
						Did you mean
					</p>
					<ul className="flex flex-col gap-1">
						{suggestions.map((s) => (
							<li key={s.url}>
								<Link
									href={s.url}
									onClick={onNavigate}
									className="text-fd-primary hover:underline"
								>
									{s.title}
								</Link>
							</li>
						))}
					</ul>
				</div>
			)}
			<div>
				<p className="mb-1.5 text-xs font-medium text-fd-muted-foreground">
					Or browse
				</p>
				<ul className="flex flex-wrap gap-x-4 gap-y-1">
					{BROWSE_LINKS.map((l) => (
						<li key={l.url}>
							<Link
								href={l.url}
								onClick={onNavigate}
								className="text-fd-primary hover:underline"
							>
								{l.name}
							</Link>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
