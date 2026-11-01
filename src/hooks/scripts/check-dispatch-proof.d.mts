type ProofToken = { event: string; tool: string; id: string; outcome: string };
type ProofRun = { event: string; tool: string; tokens: ProofToken[]; redacted?: string[] };
type HooksDoc = { hooks: Record<string, unknown[]> };

export declare function matches(matcher: string | undefined, tool: string): boolean;
export declare function expectedIds(hooksDoc: HooksDoc, event: string, tool: string): string[];
export declare function proofRuns(logText: string): ProofRun[];
export declare function judge(
  runs: ProofRun[],
  hooksDoc: HooksDoc,
  opts?: { breakId?: string; require?: string[] },
): { problems: string[]; report: string[] };
