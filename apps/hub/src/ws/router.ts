import type { Connection } from './gateway.js';
import { logger } from '../logger.js';

type MessageHandler = (conn: Connection, payload: unknown) => Promise<void>;

export class WsRouter {
  private handlers: Map<string, MessageHandler> = new Map();

  on(type: string, handler: MessageHandler): void {
    this.handlers.set(type, handler);
  }

  async route(conn: Connection, rawMsg: string): Promise<void> {
    let parsed: { type?: string; [key: string]: unknown };
    try {
      parsed = JSON.parse(rawMsg) as { type?: string; [key: string]: unknown };
    } catch {
      logger.warn({ connId: conn.id }, 'ws: invalid JSON');
      conn.ws.send(JSON.stringify({ type: 'error', message: 'invalid JSON' }));
      return;
    }

    const { type, ...payload } = parsed;
    if (!type) {
      conn.ws.send(JSON.stringify({ type: 'error', message: 'missing type' }));
      return;
    }

    const handler = this.handlers.get(type);
    if (!handler) {
      logger.warn({ connId: conn.id, msgType: type }, 'ws: no handler');
      conn.ws.send(JSON.stringify({ type: 'error', message: `unknown type: ${type}` }));
      return;
    }

    try {
      await handler(conn, payload);
    } catch (err) {
      logger.error({ connId: conn.id, msgType: type, err }, 'ws: handler error');
      conn.ws.send(JSON.stringify({ type: 'error', message: 'internal error' }));
    }
  }
}
