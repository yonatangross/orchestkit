import { TOTALS } from "@/lib/generated/shared-data";
import { PLUGINS } from "@/lib/generated/plugins-data";

const counts: Record<string, number> = {
  skills: TOTALS.skills,
  commands: TOTALS.commands,
  references: TOTALS.skills - TOTALS.commands,
  agents: TOTALS.agents,
  hooks: TOTALS.hooks,
  orkl: PLUGINS.find((p) => p.name === "orkl")?.skillCount ?? 0,
  "ork-creative": PLUGINS.find((p) => p.name === "ork-creative")?.skillCount ?? 0,
  ork: PLUGINS.find((p) => p.name === "ork")?.skillCount ?? 0,
};

export function Count({ k }: { k: keyof typeof counts }) {
  return <>{counts[k]}</>;
}
