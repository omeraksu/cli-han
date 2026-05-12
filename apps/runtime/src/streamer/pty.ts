import * as pty from 'node-pty';

export interface PtyOptions {
  shell?: string;
  onData: (data: string) => void;
  onExit: (code: number) => void;
}

export class PtySession {
  private proc: pty.IPty;
  private batchBuf = '';
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_MS = 50;

  constructor(opts: PtyOptions) {
    const shell = opts.shell ?? process.env['SHELL'] ?? '/bin/bash';

    // node-pty cannot handle undefined env values — strip them out so
    // posix_spawnp doesn't choke on partially populated environments
    // (common when the streamer is launched from a non-TTY parent).
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === 'string') env[k] = v;
    }

    this.proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 24,
      cwd: process.cwd(),
      env,
    });

    this.proc.onData((data: string) => {
      // Write to streamer's own terminal so they see the output
      process.stdout.write(data);

      this.batchBuf += data;

      if (this.batchTimer === null) {
        this.batchTimer = setTimeout(() => {
          const chunk = this.batchBuf;
          this.batchBuf = '';
          this.batchTimer = null;
          opts.onData(chunk);
        }, this.BATCH_MS);
      }
    });

    this.proc.onExit(({ exitCode }: { exitCode: number }) => {
      if (this.batchTimer !== null) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
        if (this.batchBuf) {
          opts.onData(this.batchBuf);
          this.batchBuf = '';
        }
      }
      opts.onExit(exitCode);
    });
  }

  write(data: string): void {
    this.proc.write(data);
  }

  resize(cols: number, rows: number): void {
    this.proc.resize(cols, rows);
  }

  kill(): void {
    this.proc.kill();
  }
}
