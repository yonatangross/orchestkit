// The host compatibility table (approved mockup: strip and table, Yonatan 16.11.2026 09:28).
// Server HTML, so it reads the same with JavaScript off. Every number comes from
// lib/generated/compat-data.ts (scripts/stamp-compat-table.js); an unknown one shows "?" with a
// spoken reason, never 0. Hand-written: no registry table fitted the site's tokens (component
// search 16.11); the host marks reuse HostMark.
import { type HostId, HostMark } from "@/components/host-marks";
import { ScrollTable } from "@/components/scroll-table";
import { COMPAT_ROWS, type CompatRow } from "@/lib/generated/compat-data";

function Unknown({ why }: { why: string }) {
	return (
		<>
			<span aria-hidden="true">?</span>
			<span className="sr-only">{why}</span>
		</>
	);
}

function count(v: number | "none" | null) {
	if (v === null) return <Unknown why="not measured yet" />;
	if (v === 0 || v === "none") return "none";
	return v;
}

function agents(r: CompatRow) {
	return r.roles ? `${r.roles} roles` : count(r.agents);
}

export function CompatTable() {
	return (
		<ScrollTable>
			<caption className="text-left text-sm text-fd-muted-foreground">
				Compatibility: what OrchestKit runs in, per host. Generated from the pack manifests.
			</caption>
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
							<span className="inline-flex items-center gap-2">
								<HostMark host={r.id as HostId} className="h-4 w-4" />
								{r.name}
							</span>
							{r.minVersion ? (
								<span className="block text-xs font-normal text-fd-muted-foreground">
									needs {r.name} {r.minVersion} or newer
								</span>
							) : null}
						</th>
						<td>{count(r.skills)}</td>
						<td>{agents(r)}</td>
						<td>{count(r.hooks)}</td>
						<td>{r.route}</td>
						<td>{r.issues === null ? <Unknown why="not counted yet" /> : r.issues}</td>
					</tr>
				))}
			</tbody>
		</ScrollTable>
	);
}
