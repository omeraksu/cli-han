import WebSocket from 'ws';

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];

export class WsClient {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private closed = false;
  private handlers: Map<string, (payload: unknown) => void> = new Map();

  constructor(private url: string) {}

  connect(): void {
    if (this.closed) return;

    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      this.attempt = 0;
      console.error(`[ws] connected to ${this.url}`);
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      this.onMessage(data.toString());
    });

    this.ws.on('close', () => {
      if (!this.closed) {
        console.error('[ws] disconnected, scheduling reconnect');
        this.schedule();
      }
    });

    this.ws.on('error', (err: Error) => {
      console.error(`[ws] error: ${err.message}`);
    });
  }

  send(msg: object): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[ws] not connected, dropping message');
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }

  on(type: string, handler: (payload: unknown) => void): void {
    this.handlers.set(type, handler);
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }

  private schedule(): void {
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)];
    this.attempt++;
    console.error(`[ws] reconnect in ${delay}ms (attempt ${this.attempt})`);
    setTimeout(() => this.connect(), delay);
  }

  private onMessage(raw: string): void {
    let msg: { type?: string } & Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as { type?: string } & Record<string, unknown>;
    } catch {
      console.error('[ws] failed to parse message:', raw);
      return;
    }

    const { type, ...payload } = msg;
    if (!type) {
      console.error('[ws] message missing type:', raw);
      return;
    }

    const handler = this.handlers.get(type);
    if (handler) {
      handler(payload);
    }
  }
}
