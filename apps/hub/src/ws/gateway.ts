import type { WebSocket } from '@fastify/websocket';

export interface Connection {
  id: string;
  ws: WebSocket;
  /** Logical role on this connection. 'member' = social-only (no stream). */
  type: 'streamer' | 'viewer' | 'member';
  /** The room the connection is currently joined to. */
  roomId?: string;
  /**
   * Legacy alias for roomId — kept so existing call sites that read
   * `conn.sessionId` keep working. New code should read `conn.roomId`.
   * @deprecated use `roomId`
   */
  sessionId?: string;
  mode?: 'feed' | 'raw';
  walletAddress?: string;
  handle?: string;
}

export class WsGateway {
  private connections: Map<string, Connection> = new Map();

  register(conn: Connection): void {
    this.connections.set(conn.id, conn);
  }

  unregister(id: string): void {
    this.connections.delete(id);
  }

  send(connId: string, msg: object): void {
    const conn = this.connections.get(connId);
    if (conn && conn.ws.readyState === 1 /* OPEN */) {
      conn.ws.send(JSON.stringify(msg));
    }
  }

  get(connId: string): Connection | undefined {
    return this.connections.get(connId);
  }

  getStreamers(): Connection[] {
    return [...this.connections.values()].filter((c) => c.type === 'streamer');
  }

  getViewersForSession(sessionId: string): Connection[] {
    // Legacy name preserved; new code paths can use getMembersForRoom.
    return this.getMembersForRoom(sessionId).filter((c) => c.type === 'viewer');
  }

  getMembersForRoom(roomId: string): Connection[] {
    return [...this.connections.values()].filter(
      (c) => (c.roomId ?? c.sessionId) === roomId && c.type !== 'streamer',
    );
  }

  count(): number {
    return this.connections.size;
  }
}
