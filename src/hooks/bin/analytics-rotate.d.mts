/**
 * Type surface for bin/analytics-rotate.mjs.
 *
 * The implementation is plain ESM (not TypeScript) because bin/run-hook.mjs
 * runs outside the compiled bundles and has to import it at runtime. This
 * declaration lets the TypeScript side import the same single implementation
 * instead of maintaining a second, drift-prone copy.
 */

export declare const DEFAULT_MAX_BYTES: number;
export declare const DEFAULT_MAX_ARCHIVES: number;
export declare const DEFAULT_MAX_ARCHIVE_BYTES: number;

export interface RotateOptions {
  /** Active-file size cap in bytes. Above this, the file is rotated. */
  maxBytes?: number;
  /** Maximum number of rotated archives to retain per base name. */
  maxArchives?: number;
  /** Maximum total bytes across all retained archives of one base name. */
  maxArchiveBytes?: number;
}

/** Delete oldest archives until both retention caps hold. Returns pruned paths. */
export declare function pruneArchives(
  dir: string,
  base: string,
  maxArchives: number,
  maxArchiveBytes: number,
): string[];

/** Rotate the active JSONL when oversized, then enforce archive retention. */
export declare function rotateAnalyticsIfNeeded(filePath: string, options?: RotateOptions): void;
