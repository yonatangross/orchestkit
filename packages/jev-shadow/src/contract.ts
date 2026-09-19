/** The all-harness v1 shape. This package never calls a model or a network. */
export const JEV_SHADOW_SCHEMA_VERSION = 1 as const;

export const JEV_SHADOW_REQUIRED_KEYS = Object.freeze([
  'schema_version', 'namespace', 'producer', 'seam', 'mode', 'decision_id', 'phase',
  'harness', 'session_id', 'prompt_id', 'router', 'jev_pick', 'jev_confidence',
  'incumbent_pick', 'agree', 'floor', 'decided_by', 'unknown_reason',
] as const);

export const JEV_SHADOW_HARNESSES = Object.freeze([
  'claude-code', 'codex', 'cursor', 'devin', 'pi', 'agy', 'gemini', 'grok', 'platform',
] as const);

export type JevShadowHarness = (typeof JEV_SHADOW_HARNESSES)[number];
export type UnknownReason = Readonly<Record<string, string>> | null;
export type IncumbentOutcome = { readonly status: 'failed' | 'unobserved'; readonly choice: null; readonly reason: string };
export type JevShadowRecord = Readonly<{
  schema_version: 1;
  namespace: string;
  producer: string;
  seam: string;
  mode: 'shadow';
  decision_id: string;
  phase: 'pending' | 'paired' | 'handoff' | 'unobserved';
  harness: JevShadowHarness;
  session_id: string | null;
  prompt_id: string | null;
  router: string | null;
  jev_pick: string | null;
  jev_confidence: number | null;
  incumbent_pick: string | null | IncumbentOutcome;
  agree: boolean | null;
  floor: number | null;
  decided_by: 'incumbent' | 'jev' | 'none' | 'unknown';
  unknown_reason: UnknownReason;
  incumbent_pick_reason?: string | null;
  handoff_to?: string | null;
  tool_call_id?: string | null;
  incumbent_model?: string | null;
  candidate_set_sha256?: string | null;
  selected_pick?: string | null;
  selected_by?: 'jev' | 'incumbent' | 'none' | 'unknown';
  incumbent_origin?: 'independent' | 'not_run' | 'unobserved';
}>;

export const JEV_SHADOW_CONTRACT_ARTIFACT = Object.freeze({
  schema_version: JEV_SHADOW_SCHEMA_VERSION,
  required: JEV_SHADOW_REQUIRED_KEYS,
  harnesses: JEV_SHADOW_HARNESSES,
  invariants: Object.freeze([
    'null values require unknown_reason[field]',
    'failed or unobserved incumbent requires agree=null',
    'incumbent_origin=not_run requires incumbent_pick=null and incumbent_pick_reason',
    'selected execution is not an independent incumbent comparison',
  ]),
});
