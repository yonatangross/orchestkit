import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import {
	StructuredData,
	softwareApplicationNode,
} from "@/components/structured-data";
import { COUNTS, SITE } from "@/lib/constants";

export const metadata: Metadata = {
	title: "Pricing",
	description: `${SITE.name} is free and open source under the MIT license. No paid tiers, no usage limits, no account required.`,
	alternates: { canonical: `${SITE.domain}/pricing` },
};

export default function PricingPage() {
	return (
		<ContentPage
			title="Pricing"
			path="/pricing"
			lead="OrchestKit is free and open source under the MIT license. There are no paid tiers, no usage limits, and no account is required."
		>
			{/* Free Offer in structured data so agents can read pricing without scraping. */}
			<StructuredData nodes={[softwareApplicationNode()]} />

			<h2>One plan: Free</h2>
			<table>
				<thead>
					<tr>
						<th>Plan</th>
						<th>Price</th>
						<th>Includes</th>
						<th>Limits</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>OrchestKit (MIT)</td>
						<td>$0</td>
						<td>
							All {COUNTS.skills} skills, {COUNTS.agents} agents, and{" "}
							{COUNTS.hooks} hooks
						</td>
						<td>None</td>
					</tr>
				</tbody>
			</table>

			<h2>What's included</h2>
			<p>
				Every OrchestKit capability is in the single free, open-source package.
				There is no premium tier, no seat licensing, and no telemetry-gated
				features. You own and run everything locally inside Claude Code.
			</p>

			<h2>What you pay for separately</h2>
			<p>
				OrchestKit itself is free. You still need{" "}
				<a href="https://www.anthropic.com/claude-code">Claude Code</a> and an
				Anthropic account to run the underlying agent — that billing is between
				you and Anthropic and is independent of OrchestKit.
			</p>

			<h2>Machine-readable pricing</h2>
			<p>
				Agents can read this pricing as plain Markdown at{" "}
				<Link href="/pricing.md">/pricing.md</Link> or from the{" "}
				<code>SoftwareApplication</code> structured data on this page and the
				homepage.
			</p>
		</ContentPage>
	);
}
