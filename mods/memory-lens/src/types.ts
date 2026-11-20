// memory-lens: types.ts - shared type definitions

/** One memory the lens can recall: a local memory file or a mirrored remote title. */
export interface MemoryDoc {
  /** Stable id: the file path for a local memory, the store id for a mirrored one. */
  id: string;
  /** Frontmatter name, or the file name without .md. */
  name: string;
  /** Frontmatter description (one line). */
  desc: string;
  /** Frontmatter type (feedback, project, reference, user), or "" when untyped. */
  type: string;
  /** The first part of the body, used for matching only, never shown. */
  body: string;
  /** First image path the memory mentions, if any. */
  image?: string;
  /** Where it came from: "local" for a memory file, else the mirror's store label. */
  source: string;
}

/** One recalled memory with why it matched. */
export interface Hit {
  doc: MemoryDoc;
  score: number;
  /** The query words it matched, strongest first. */
  why: string[];
}

/** Local, never-committed settings read at session start. */
export interface LensPrivate {
  /** Words that mark a memory as client data: its title is hidden on screen. */
  clientTerms: string[];
}

/** One entry in a mirror file written by a private job outside this mod. */
export interface MirrorItem {
  id: string;
  title: string;
  summary?: string;
  source?: string;
}
