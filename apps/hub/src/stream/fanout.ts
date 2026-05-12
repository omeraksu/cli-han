import type { WebSocket } from '@fastify/websocket';
import type { StreamEvent } from './cache.js';

export interface FeedItem {
  type: 'feed';
  ts: number;
  summary: string;
}

interface ViewerEntry {
  ws: WebSocket;
  mode: 'feed' | 'raw';
}

export class StreamFanout {
  private viewers: Map<string, ViewerEntry> = new Map();

  addViewer(viewerId: string, ws: WebSocket): void {
    this.viewers.set(viewerId, { ws, mode: 'feed' });
  }

  removeViewer(viewerId: string): void {
    this.viewers.delete(viewerId);
  }

  setMode(viewerId: string, mode: 'feed' | 'raw'): void {
    const entry = this.viewers.get(viewerId);
    if (entry) {
      entry.mode = mode;
    }
  }

  broadcast(event: StreamEvent): void {
    const msg = JSON.stringify({ type: 'stream_event', payload: event });
    for (const [, entry] of this.viewers) {
      if (entry.mode === 'raw' && entry.ws.readyState === 1 /* OPEN */) {
        entry.ws.send(msg);
      }
    }
  }

  broadcastFeedItem(item: FeedItem): void {
    const msg = JSON.stringify(item);
    for (const [, entry] of this.viewers) {
      if (entry.mode === 'feed' && entry.ws.readyState === 1) {
        entry.ws.send(msg);
      }
    }
  }

  broadcastAll(msg: string): void {
    for (const [, entry] of this.viewers) {
      if (entry.ws.readyState === 1) {
        entry.ws.send(msg);
      }
    }
  }

  viewerCount(): number {
    return this.viewers.size;
  }

  viewerIds(): string[] {
    return Array.from(this.viewers.keys());
  }
}
