export interface StreamEvent {
  v: number;
  type: 'stdout' | 'command_start' | 'command_end';
  ts: number;
  data?: string;
  command?: string;
}

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
