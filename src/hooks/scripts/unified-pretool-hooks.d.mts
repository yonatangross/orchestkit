type HooksDoc = { hooks: Record<string, unknown[]> };
type CommandGroup = { matcher?: string; hooks: Array<{ type: string; args?: string[] }> };
type Variant<T> = T & { hooks: { PreToolUse: CommandGroup[]; PostToolUse: CommandGroup[]; PostToolBatch?: unknown[] } & Record<string, unknown> };

export declare const UNIFIED_PRETOOL_HANDLER: string;
export declare const UNIFIED_POSTTOOL_HANDLER: string;
export declare function unifiedPretoolHooks<T extends HooksDoc>(hooksDoc: T): Variant<T>;
export declare function unifiedPosttoolHooks<T extends HooksDoc>(hooksDoc: T): Variant<T>;
export declare function unifiedToolHooks<T extends HooksDoc>(hooksDoc: T): Variant<T>;
export declare function unionMatcher(matchers: Array<string | undefined>): string | undefined;
export declare const PRETOOL_ENTRY_TIMEOUT_S: number;
export declare const POSTTOOL_ENTRY_TIMEOUT_S: number;
