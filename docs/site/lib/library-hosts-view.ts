import {
  LIBRARY_HOSTS,
  type LibraryHostSets,
  type LibraryItem,
} from "@/lib/generated/library-data";
import { RUN } from "@/lib/library-run";
import { HOST_INSTALLS } from "@/lib/host-installs";

export type HostKey = keyof typeof LIBRARY_HOSTS;

const HOST_NAME = Object.fromEntries(
  HOST_INSTALLS.map((h) => [h.id, h.name]),
) as Record<HostKey, string>;

/** The hosts in the site's own order (lib/host-installs.ts). */
export const HOST_ORDER: readonly HostKey[] = HOST_INSTALLS.map((h) => h.id as HostKey);

function ships(set: string[] | "all" | null, name: string): boolean {
  return set === "all" || (Array.isArray(set) && set.includes(name));
}

/**
 * Hosts a list row is on, from the manifests. Hooks run in Claude Code only.
 * Devin has no verified source yet, so it is never named here.
 */
export function onHosts(item: LibraryItem): string[] {
  const names: string[] = [];
  for (const id of HOST_ORDER) {
    const sets: LibraryHostSets = LIBRARY_HOSTS[id];
    if (item.kind === "hook") {
      if (sets.hooks === "claude") names.push(HOST_NAME[id]);
      continue;
    }
    const set = item.kind === "skill" ? sets.skills : sets.agents;
    if (ships(set, item.name)) names.push(HOST_NAME[id]);
  }
  return names;
}

const RUN_SKILLS = RUN.filter((l) => l.kind === "skill").map((l) => l.name);
const RUN_AGENTS = RUN.filter((l) => l.kind === "agent").map((l) => l.name);
const RUN_HOOKS = RUN.filter((l) => l.kind === "hook").length;

function count(shipped: number, total: number, noun: string): string {
  if (total > 0 && shipped === total) return `all ${total} ${noun}`;
  return `${shipped} of this run's ${total} ${noun}`;
}

/**
 * The line under the terminal for one host, every number computed from the
 * manifests. Claude Code has none (the run is its own). Devin shows `?`.
 */
export function hostLine(id: HostKey): string | null {
  if (id === "claude") return null;
  const name = HOST_NAME[id];
  const sets = LIBRARY_HOSTS[id];
  if (sets.skills === null) {
    return `On ${name}: ? (not shown until a real read verifies what it installs).`;
  }
  const skills = RUN_SKILLS.filter((n) => ships(sets.skills, n));
  const agents = RUN_AGENTS.filter((n) => ships(sets.agents, n));
  const parts: string[] = [];
  if (sets.roles && sets.roles.length > 0) {
    const calls = skills.map((n) => `$ork-${n}`).join(", ");
    parts.push(`${count(skills.length, RUN_SKILLS.length, "skills")} ship (${calls})`);
    parts.push(`agents run as ${sets.roles.length} roles`);
  } else {
    parts.push(
      skills.length === 0
        ? "none of this run's skills ship"
        : `${count(skills.length, RUN_SKILLS.length, "skills")}${
            agents.length === RUN_AGENTS.length && agents.length > 0
              ? ` and ${agents.length} agents of this run ship`
              : " ship"
          }`,
    );
    if (agents.length !== RUN_AGENTS.length) {
      parts.push(agents.length === 0 ? "no agents" : `${agents.length} of ${RUN_AGENTS.length} agents`);
    }
  }
  if (sets.hooks === "none") parts.push(`this run's ${RUN_HOOKS} hooks do not load on ${name}`);
  if (sets.hooks === "partial") parts.push(`only some of this run's ${RUN_HOOKS} hooks run on ${name}`);
  return `On ${name}: ${parts.join("; ")}.`;
}

export const HOST_LINES: { id: HostKey; name: string; line: string }[] = HOST_ORDER.flatMap(
  (id) => {
    const line = hostLine(id);
    return line ? [{ id, name: HOST_NAME[id], line }] : [];
  },
);
