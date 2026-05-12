export type StreamEvent =
  | { v: 1; type: 'stdout'; ts: number; data: string }
  | { v: 1; type: 'command_start'; ts: number; command: string }
  | { v: 1; type: 'command_end'; ts: number; exitCode?: number }
  | {
      v: 1;
      type: 'turn';
      ts: number;
      role: 'user' | 'assistant';
      content: string;
    }
  | {
      v: 1;
      type: 'tool_call';
      ts: number;
      name: string;
      argsSummary?: string;
    }
  | {
      v: 1;
      type: 'file_edit';
      ts: number;
      path: string;
      diffSummary?: string;
    };

const RECENT_WINDOW_MS = 30_000;

export class StreamCache {
  private buffer: StreamEvent[] = [];
  private readonly maxSize = 100;
  private readonly maxAgeMs = 5 * 60 * 1000;

  push(event: StreamEvent): void {
    const now = Date.now();
    // evict stale entries
    this.buffer = this.buffer.filter((e) => now - e.ts <= this.maxAgeMs);

    this.buffer.push(event);

    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  getRecent(): StreamEvent[] {
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    return this.buffer.filter((e) => e.ts >= cutoff);
  }

  getAll(): StreamEvent[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }
}
