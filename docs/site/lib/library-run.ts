import {
  LIBRARY_ITEMS,
  type LibraryItem,
  type LibraryStationKey,
} from "@/lib/generated/library-data";

/**
 * The one replayed run: `/ork:implement add dark mode support to the
 * dashboard`, 20 lines (7 skills, 4 agents, 9 hooks). Every line is a real
 * library item; the drift test checks each id and station against the
 * generated data. Copy is the approved frame's, word for word.
 */
export type RunLine = {
  kind: "skill" | "agent" | "hook";
  name: string;
  /** Hook event, as the library item names it. */
  event?: string;
  /** The label the line shows for a hook, e.g. `PreToolUse · Agent`. */
  label?: string;
  note: string;
  station: LibraryStationKey;
};

export const RUN_PROMPT = "/ork:implement add dark mode support to the dashboard";
export const RUN_DONE = "Done. 20 library items took part in this run.";

export const RUN: readonly RunLine[] = [
  { kind: "hook", name: "unified-dispatcher", event: "UserPromptSubmit", label: "UserPromptSubmit", note: "reads the prompt", station: "ask" },
  { kind: "skill", name: "implement", note: "loaded, model sonnet", station: "build" },
  { kind: "skill", name: "explore", note: "maps the codebase first", station: "plan" },
  { kind: "skill", name: "scope-appropriate-architecture", note: "sizes the change to the project", station: "plan" },
  { kind: "hook", name: "sync-task-dispatcher", event: "PreToolUse", label: "PreToolUse · Agent", note: "checks each agent dispatch", station: "guard" },
  { kind: "agent", name: "frontend-ui-developer", note: "dispatched, model inherit", station: "build" },
  { kind: "agent", name: "backend-system-architect", note: "dispatched, model inherit", station: "build" },
  { kind: "agent", name: "test-generator", note: "dispatched, model sonnet", station: "check" },
  { kind: "agent", name: "security-auditor", note: "dispatched, model opus", station: "guard" },
  { kind: "hook", name: "agent-view-titler", event: "SubagentStart", label: "SubagentStart", note: "names each agent view", station: "build" },
  { kind: "skill", name: "design-system-tokens", note: "preloaded by frontend-ui-developer", station: "build" },
  { kind: "hook", name: "sync-write-edit-dispatcher", event: "PreToolUse", label: "PreToolUse · Write|Edit", note: "checks every edit before it lands", station: "guard" },
  { kind: "hook", name: "auto-lint", event: "PostToolUse", label: "PostToolUse · Write|Edit", note: "lints the changed file", station: "check" },
  { kind: "hook", name: "ui-change-detector", event: "PostToolUse", label: "PostToolUse · Write|Edit", note: "flags the UI change", station: "check" },
  { kind: "hook", name: "subagent-scope-auditor", event: "SubagentStop", label: "SubagentStop", note: "audits what each agent touched", station: "build" },
  { kind: "skill", name: "verify", note: "grades the work for merge", station: "check" },
  { kind: "skill", name: "commit", note: "writes a Conventional Commit", station: "ship" },
  { kind: "hook", name: "task-completion-check", event: "Stop", label: "Stop", note: "confirms the task is complete", station: "ship" },
  { kind: "skill", name: "remember", note: "stores the decision", station: "remember" },
  { kind: "hook", name: "session-handoff-generator", event: "SessionEnd", label: "SessionEnd", note: "writes the handoff for next time", station: "remember" },
];

/** The library item a run line stands for, or undefined if the data drifted. */
export function resolveRunLine(line: RunLine): LibraryItem | undefined {
  return LIBRARY_ITEMS.find((item) => {
    if (item.kind !== line.kind || item.name !== line.name) return false;
    return item.kind !== "hook" || item.event === line.event;
  });
}
