import type { WsGateway } from '../ws/gateway.js';

export interface MosaicTileUpdate {
  type: 'mosaic_tile_update';
  eventId: string;
  sessionId: string;
  teamLabel: string;
  streamerWallet: string;
  lastActivity: number;
  lastSnippet?: string;
  helpOpen?: boolean;
}

/**
 * Map of eventId → set of subscriber connection ids. A judge / mentor opens
 * one WS connection per event and receives tile updates for every team in
 * that event. The streamer handler invokes broadcastTileUpdate whenever a
 * stream_chunk arrives so the judge mosaic stays live.
 */
export class MosaicSubscribers {
  private byEvent = new Map<string, Set<string>>();
  private connToEvent = new Map<string, string>();

  subscribe(connId: string, eventId: string): void {
    this.unsubscribe(connId); // single-event per connection for V1
    let set = this.byEvent.get(eventId);
    if (!set) {
      set = new Set();
      this.byEvent.set(eventId, set);
    }
    set.add(connId);
    this.connToEvent.set(connId, eventId);
  }

  unsubscribe(connId: string): void {
    const eventId = this.connToEvent.get(connId);
    if (!eventId) return;
    const set = this.byEvent.get(eventId);
    if (set) {
      set.delete(connId);
      if (set.size === 0) this.byEvent.delete(eventId);
    }
    this.connToEvent.delete(connId);
  }

  getSubscribers(eventId: string): string[] {
    return [...(this.byEvent.get(eventId) ?? [])];
  }

  count(): number {
    return this.connToEvent.size;
  }
}

export function broadcastTileUpdate(
  gateway: WsGateway,
  subs: MosaicSubscribers,
  update: MosaicTileUpdate,
): void {
  const ids = subs.getSubscribers(update.eventId);
  for (const id of ids) {
    gateway.send(id, update);
  }
}
