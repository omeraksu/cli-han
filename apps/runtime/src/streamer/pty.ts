import * as pty from 'node-pty';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';

export interface PtyOptions {
  shell?: string;
  cwd?: string;
  onData: (data: string) => void;
  onExit: (code: number) => void;
}

function resolveShell(prefer?: string): string {
  const candidates = [prefer, process.env['SHELL'], '/bin/zsh', '/bin/bash', '/bin/sh'];
  for (const c of candidates) {
    if (c && existsSync(c)) return c;
  }
  return '/bin/sh';
}

function buildEnv(): Record<string, string> {
  // Forward almost everything (so tools like Claude Code, git, helix
  // inherit their real config) and drop only the few prefixes that
  // either confuse posix_spawnp under `pnpm exec` or leak Han internals
  // into the child shell.
  const dropExact = new Set([
    'NODE_OPTIONS',
    'NODE_REPL_HISTORY',
    'PNPM_HOME',
    'PNPM_PACKAGE_NAME',
    'PNPM_SCRIPT_SRC_DIR',
  ]);
  const dropPrefix = ['PNPM_', 'NPM_', 'npm_', 'BERRY_'];

  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v !== 'string') continue;
    if (dropExact.has(k)) continue;
    if (dropPrefix.some((p) => k.startsWith(p))) continue;
    env[k] = v;
  }
  // Hard-code TERM if missing so colour output and resize work cleanly.
  env['TERM'] ??= 'xterm-256color';
  return env;
}

export class PtySession {
  private proc: pty.IPty;
  private batchBuf = '';
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_MS = 50;

  constructor(opts: PtyOptions) {
    const shell = resolveShell(opts.shell);
    const cwd = opts.cwd ?? homedir();

    this.proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 24,
      cwd,
      env: buildEnv(),
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
