import { SKILL_FLOWS } from "@/lib/generated/skill-flows-data";
import type { SkillFlowLane, SkillFlowNode } from "@/lib/generated/types";

/**
 * Skill Flow: server-rendered pipeline strip for skill reference pages.
 *
 * A generated skill page is the whole SKILL.md body verbatim (up to ~2,500
 * lines), so the shape of the skill is only recoverable by reading all of it.
 * This strip puts that shape on top of the page.
 *
 * The data is derived in scripts/generate-docs-data.js, in three tiers:
 *   table    : a `| Phase | Activities | Output |` table exists; nodes carry
 *              both the activity and what the phase yields.
 *   headings : `## STEP n:` / `## Phase n:` headings; labels only.
 *   sections : no pipeline at all (reference/pattern skills). Rendered as an
 *              unordered capability map with NO arrows, because implying a
 *              sequence that the skill does not have would be a lie.
 *
 * Zero client JS: this is static content on 113 statically-generated pages.
 *
 * Brand mapping follows skill-dossier: ice (george-cool) = metadata labels,
 * amber (george-warm) = optional/attention, indigo (fd-primary) = the spine.
 */

const LANE_TONE: Record<SkillFlowLane["id"], string> = {
  // Pre-flight and optional tails are deliberately quieter than the core
  // phases. If every lane competes at full strength, nothing reads as primary.
  pre: "border-fd-border bg-fd-secondary/40 text-fd-muted-foreground",
  core: "border-fd-primary/35 bg-fd-primary/5 text-fd-foreground",
  emit: "border-fd-border bg-fd-secondary/40 text-fd-muted-foreground",
  map: "border-fd-border bg-fd-secondary/60 text-fd-foreground",
};

const TIER_NOTE: Record<string, string> = {
  table: "Phases and outputs below are read from this skill's own phase table.",
  headings: "Steps below are read from this skill's STEP headings.",
  sections:
    "This skill is a reference library, not a pipeline. These are the areas it covers, in no particular order.",
};

function FlowNode({
  node,
  laneId,
  withArrow,
}: {
  node: SkillFlowNode;
  laneId: SkillFlowLane["id"];
  withArrow: boolean;
}) {
  return (
    // The connector lives INSIDE the <li> so it can never wrap onto the next
    // row on its own. A leading "→" at the start of a line reads as a typo.
    <li className="flex items-center gap-1.5">
      <div
        className={`flex min-w-[9rem] max-w-[13rem] flex-col self-stretch rounded-md border px-2.5 py-1.5 ${LANE_TONE[laneId]}`}
      >
        {node.num ? (
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--yy-george-cool-text)]">
            {node.num}
          </span>
        ) : null}
        <span
          className={`text-[13px] leading-snug ${laneId === "core" ? "font-semibold" : "font-medium"}`}
        >
          {node.label}
        </span>
        {node.out ? (
          <span className="mt-0.5 text-[11px] leading-snug text-fd-muted-foreground">
            <span aria-hidden="true">→ </span>
            <span className="sr-only">yields </span>
            {node.out}
          </span>
        ) : null}
        {node.tag === "optional" ? (
          <span className="mt-1 self-start rounded-full bg-fd-secondary px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-[var(--yy-george-warm-text)]">
            optional
          </span>
        ) : null}
      </div>
      {withArrow ? (
        <span aria-hidden="true" className="hidden text-fd-primary/50 sm:inline">
          →
        </span>
      ) : null}
    </li>
  );
}

function Lane({
  lane,
  ordered,
  showLabel,
}: {
  lane: SkillFlowLane;
  ordered: boolean;
  showLabel: boolean;
}) {
  const ListTag = ordered ? "ol" : "ul";
  return (
    <div>
      {/* With a single lane the heading above already names it, so don't say it twice. */}
      {showLabel ? (
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--yy-george-cool-text)]">
          {lane.label}
        </div>
      ) : null}
      <ListTag className="m-0 flex list-none flex-wrap items-stretch gap-1.5 p-0">
        {lane.nodes.map((node, i) => (
          <FlowNode
            key={`${lane.id}-${i}-${node.label}`}
            node={node}
            laneId={lane.id}
            withArrow={ordered && i < lane.nodes.length - 1}
          />
        ))}
      </ListTag>
    </div>
  );
}

export function SkillFlow({ slug }: { slug: string }) {
  const flow = SKILL_FLOWS[slug];
  if (!flow) return null;

  // Only the pipeline tiers are a sequence. A capability map must not render
  // arrows or an <ol>, or it claims an order the source never had.
  const ordered = flow.tier !== "sections";

  return (
    <section
      aria-label="Skill flow"
      className="not-prose mb-8 rounded-lg border border-fd-border bg-fd-card p-4"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="m-0 text-sm font-semibold">
          {ordered ? "How it runs" : "What it covers"}
        </h2>
        <p className="m-0 text-[11px] text-fd-muted-foreground">{TIER_NOTE[flow.tier]}</p>
      </div>
      <div className="flex flex-col gap-3">
        {flow.lanes.map((lane) => (
          <Lane
            key={lane.id}
            lane={lane}
            ordered={ordered}
            showLabel={flow.lanes.length > 1}
          />
        ))}
      </div>
    </section>
  );
}
