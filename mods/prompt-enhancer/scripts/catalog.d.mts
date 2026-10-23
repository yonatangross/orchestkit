export const MAX_CATALOG_CHARS: number;
export interface Item { id: string; description: string }
export function frontmatter(source: string): Record<string, string>;
export function purpose(description: string, max: number): string;
export function scanRoot(root: string, prefix: string): { agents: Item[]; skills: Item[]; commands: Item[] };
export function render(input: { agents?: Item[]; skills?: Item[]; commands?: Item[]; mcp?: string[]; notes?: string }): string;
export function local(home: string): string;
