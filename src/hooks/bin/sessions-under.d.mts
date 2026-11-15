/**
 * Type surface for bin/sessions-under.mjs (plain ESM so it runs from the
 * shipped plugin with no build step).
 */

import type { DatabaseSync } from 'node:sqlite';

export interface SessionUnderRow {
  sid: string;
  repo_path: string;
  branch: string | null;
  worktree_path: string | null;
  started_at: number;
  ended_at: number | null;
  status: string;
  ork_version: string | null;
  rules_hash: string | null;
}

interface Writable {
  write(chunk: string): unknown;
}

export declare function defaultDbPath(): string;
export declare function findSessionsUnder(db: DatabaseSync, key: string): SessionUnderRow[];
export declare function formatRow(r: SessionUnderRow): string;
export declare function main(argv: string[], out?: Writable, err?: Writable): number;
