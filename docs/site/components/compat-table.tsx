// The host compatibility table (approved mockup: strip and table, Yonatan 16.11.2026 09:28).
// Server HTML, so it reads the same with JavaScript off. Every number comes from
// lib/generated/compat-data.ts (scripts/stamp-compat-table.js); an unknown one shows "?" with a
// spoken reason, never 0 or "none". A table from 640 px up; on a phone, one card per host, so no
// column is cut off (outside looks review 16.11). Hand-written: no registry table fitted the
// site's tokens (component search 16.11); the host marks reuse HostMark.
import { type HostId, HostMark } from "@/components/host-marks";
import { ScrollTable } from "@/components/scroll-table";
import { COMPAT_ROWS, type CompatRow } from "@/lib/generated/compat-data";

const ISSUES = "https://github.com/yonatangross/orchestkit/issues";
const CAPTION = "Compatibility: what OrchestKit runs in, per host. Generated from the pack manifests.";
const ISSUES_NOTE =
	"Open issues are counted once each host's issues are labelled; until then the column shows ?.";

function Unknown({ why }: { why: string }) {
	return (
		<>
			<span aria-hidden="true">?</span>
			<span className="sr-only">{why}</span>
		</>
	);
}

function count(v: number | null) {
	return v === null ? <Unknown why="not measured yet" /> : v;
}

function agents(r: CompatRow) {
	return r.roles ? `${r.roles} roles` : count(r.agents);
}

function hooks(r: CompatRow) {
	if (r.hooks === "not yet") {
		return (
			<>
				not yet
				{r.hooksIssue ? (
					<>
						{", tracked in "}
						<a
							href={`${ISSUES}/${r.hooksIssue}`}
							// A 44 px tap target from an invisible hit area, so the line keeps the card's rhythm.
							className="relative underline underline-offset-2 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-primary"
						>
							#{r.hooksIssue}
						</a>
					</>
				) : null}
			</>
		);
	}
	return count(r.hooks);
}

function issues(r: CompatRow) {
	return r.issues === null ? <Unknown why="not counted yet" /> : r.issues;
}

function HostName({ r }: { r: CompatRow }) {
	return (
		<span className="inline-flex items-center gap-2">
			<HostMark host={r.id as HostId} className="h-4 w-4" />
			{r.name}
		</span>
	);
}

export function CompatTable() {
	return (
		<div>
			<p className="text-sm text-fd-muted-foreground">{CAPTION}</p>

			<ul aria-label="Compatibility by host" className="not-prose my-4 grid list-none gap-3 p-0 sm:hidden">
				{COMPAT_ROWS.map((r) => (
					<li key={r.id} className="rounded-lg border border-fd-border bg-fd-card p-3 text-sm">
						<p className="font-semibold">
							<HostName r={r} />
						</p>
						{r.minVersion ? (
							<p className="text-fd-muted-foreground">
								needs {r.name} {r.minVersion} or newer
							</p>
						) : null}
						<p className="mt-1">
							Skills {count(r.skills)} · Agents {agents(r)}
						</p>
						<p>Hooks {hooks(r)}</p>
						<p className="text-fd-muted-foreground">
							Install: {r.route} · Open issues {issues(r)}
						</p>
					</li>
				))}
			</ul>

			<div className="hidden sm:block">
				<ScrollTable>
					<caption className="sr-only">{CAPTION}</caption>
					<thead>
						<tr>
							{["Host", "Skills", "Agents", "Hooks", "Install", "Open issues"].map((h) => (
								<th key={h} scope="col">
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{COMPAT_ROWS.map((r) => (
							<tr key={r.id}>
								<th scope="row">
									<HostName r={r} />
									{r.minVersion ? (
										<span className="block text-sm font-normal text-fd-muted-foreground">
											needs {r.name} {r.minVersion} or newer
										</span>
									) : null}
								</th>
								<td>{count(r.skills)}</td>
								<td>{agents(r)}</td>
								<td>{hooks(r)}</td>
								<td>{r.route}</td>
								<td>{issues(r)}</td>
							</tr>
						))}
					</tbody>
				</ScrollTable>
			</div>
			<p className="text-sm text-fd-muted-foreground">{ISSUES_NOTE}</p>
		</div>
	);
}
