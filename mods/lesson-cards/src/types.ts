/**
 * Type definitions for lesson-cards.
 *
 * Minimal $ facade for testing with a fake implementation.
 */

export interface FsEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface FileStat {
  size: number;
  mtime?: number;
  isFile: boolean;
  isDirectory: boolean;
}

export interface $ {
  fs: {
    read: (path: string, encoding?: string) => Promise<string | Uint8Array>;
    list: (path: string) => Promise<FsEntry[] | null>;
    stat: (path: string) => Promise<FileStat | null>;
  };
  ui: {
    notice: (toolUseId: string, message: string) => Promise<void>;
    invalidate: (component: string) => Promise<void>;
  };
}

export interface ToolCallEvent {
  tool: string;
  args: Record<string, unknown>;
  tool_use_id?: string;
}

export interface UiRenderEvent {
  component: string;
  requestId?: string;
}

export interface SessionStartEvent {
  // Empty payload for session.start
}

export interface CommandRegisterEvent {
  command: string;
}

export interface MatchedLesson {
  id: string;
  severity: 'block' | 'warn';
  message: string;
  fix?: string;
  source: 'pattern' | 'bullet';
}
