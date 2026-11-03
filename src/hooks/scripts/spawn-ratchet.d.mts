type HooksDoc = { hooks: Record<string, unknown[]> };
type Tool = 'Bash' | 'Edit' | 'Write' | 'Read';
type SpawnPath = 'success' | 'permission' | 'failure';
type Counts = Record<SpawnPath, Record<Tool, number>>;
type Baseline = Partial<Record<SpawnPath, Partial<Record<Tool, number>>>>;
type Target = Partial<Record<Tool, number>>;

export declare function matches(matcher: string | undefined, tool: string): boolean;
export declare function countSpawns(hooksDoc: HooksDoc, tool: string, events: string[]): number;
export declare function measure(hooksDoc: HooksDoc): Counts;
export declare function compare(
  measured: Counts,
  baseline: Baseline,
  target: Target,
  flagged?: Counts,
): { failed: boolean; lines: string[] };
