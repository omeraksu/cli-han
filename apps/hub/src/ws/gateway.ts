import type { WebSocket } from '@fastify/websocket';

export interface Connection {
  id: string;
  ws: WebSocket;
  type: 'streamer' | 'viewer';
  sessionId?: string;
  mode?: 'feed' | 'raw';
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
    return [...this.connections.values()].filter(
      (c) => c.type === 'viewer' && c.sessionId === sessionId
    );
  }

  count(): number {
    return this.connections.size;
  }
}
