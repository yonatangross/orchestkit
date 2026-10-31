export declare const UNIFIED_PRETOOL_HANDLER: string;
export declare function unifiedPretoolHooks<T extends { hooks: Record<string, unknown[]> }>(hooksDoc: T): T & {
  hooks: { PreToolUse: Array<{ matcher?: string; hooks: Array<{ type: string; args?: string[] }> }> };
};
