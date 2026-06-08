import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { SITE } from "@/lib/constants";

export const metadata: Metadata = {
	title: "Status",
	description: `Service status for the ${SITE.name} documentation site and API.`,
	alternates: { canonical: `${SITE.domain}/status` },
};

// Static status page. The docs site is a stateless static/SSR deployment on
// Vercel — if you can load this page, it is operational. The machine-readable
// liveness check is /api/health.
export default function StatusPage() {
	return (
		<ContentPage
			title="Status"
			path="/status"
			lead="OrchestKit's documentation site and public API are operational if this page loads."
		>
			<h2>Components</h2>
			<table>
				<thead>
					<tr>
						<th>Component</th>
						<th>Status</th>
						<th>Check</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Documentation site</td>
						<td>Operational</td>
						<td>
							<Link href="/">{SITE.domain}</Link>
						</td>
					</tr>
					<tr>
						<td>Search API</td>
						<td>Operational</td>
						<td>
							<Link href="/api/health">/api/health</Link>
						</td>
					</tr>
				</tbody>
			</table>

			<h2>Machine-readable health</h2>
			<p>
				Agents should poll <Link href="/api/health">/api/health</Link>, which
				returns <code>{`{ "status": "ok", ... }`}</code> with HTTP 200 when the
				deployment is serving. Errors across the API use the RFC 9457 Problem
				Details shape (<code>type</code>, <code>title</code>, <code>status</code>,
				<code>detail</code>), served as <code>application/json</code>.
			</p>

			<h2>Incidents</h2>
			<p>
				This is a static, stateless deployment with no backing database, so there
				is no per-incident state to report here. Outages, if any, are tracked on{" "}
				<a href={SITE.github}>GitHub</a>.
			</p>
		</ContentPage>
	);
}
