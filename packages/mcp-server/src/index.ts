#!/usr/bin/env node
import 'dotenv/config';
/**
 * @han/mcp — MCP server that exposes Han's streaming + social tools to
 * MCP-aware AI tools (Claude Code, Cursor, Aider...).
 *
 * Tools (V1):
 *   - han_stream_start   start a live session (registers with the hub)
 *   - han_stream_stop    end the current session
 *   - han_log            push a turn/tool_call/file_edit event
 *   - han_browse         snapshot the lobby
 *   - han_connect        peek the last N events of someone else's session
 *   - han_tip            send a 3%-fee tip on devnet
 *
 * Transport: stdio (Claude Code / Cursor / generic MCP clients).
 * State: one active streaming session per process. The first
 * han_stream_start opens a WS to the hub; han_log keeps pushing until
 * han_stream_stop closes it.
 *
 * Env:
 *   HAN_HUB_URL          default http://localhost:3000
 *   WALLET_ADDRESS       required for streaming + tipping
 *   FEE_COLLECTOR_PUBKEY required for tipping
 *   SOLANA_RPC_URL       default https://api.devnet.solana.com
 *   SOLANA_CLUSTER       default devnet
 *
 * ADR: 2026-05-13-mcp-server-architecture
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import WebSocket from 'ws';
import { z } from 'zod';
import { Connection, PublicKey } from '@solana/web3.js';
import {
  loadLocalKeypair,
  sendTipWithFee,
} from '@han/sdk/dist/index.js';

const HUB_URL = process.env['HAN_HUB_URL'] ?? 'http://localhost:3000';
const WALLET = process.env['WALLET_ADDRESS'];
const FEE_COLLECTOR = process.env['FEE_COLLECTOR_PUBKEY'];
const RPC_URL = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
const CLUSTER = process.env['SOLANA_CLUSTER'] ?? 'devnet';

interface ActiveSession {
  id: string;
  ws: WebSocket;
  walletAddress: string;
  startedAt: number;
}

let active: ActiveSession | null = null;

function explorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER}`;
}

async function openSession(opts: {
  description?: string;
  tool?: string;
  model?: string;
  handle?: string;
}): Promise<ActiveSession> {
  if (!WALLET) {
    throw new Error('WALLET_ADDRESS env not set; han_stream_start needs a streamer wallet pubkey');
  }
  if (active) {
    throw new Error(`a session is already live (${active.id}); call han_stream_stop first`);
  }

  // 1) reserve a session id via REST
  const res = await fetch(`${HUB_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      streamerWallet: WALLET,
      streamerName: opts.handle,
      description: opts.description,
      tool: opts.tool ?? 'mcp',
    }),
  });
  if (!res.ok) {
    throw new Error(`hub /sessions returned ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { sessionId: string; code: string };

  // 2) open the WS, register as streamer
  const wsUrl = HUB_URL.replace(/^http/, 'ws') + '/ws';
  const ws = new WebSocket(wsUrl);
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });

  ws.send(
    JSON.stringify({
      type: 'register_streamer',
      sessionId: body.sessionId,
      walletAddress: WALLET,
      streamerName: opts.handle,
      description: opts.description,
      tool: opts.tool ?? 'mcp',
    }),
  );

  active = {
    id: body.sessionId,
    ws,
    walletAddress: WALLET,
    startedAt: Date.now(),
  };

  ws.on('close', () => {
    if (active && active.ws === ws) {
      active = null;
    }
  });

  return active;
}

function sendEvent(event: Record<string, unknown>): void {
  if (!active) {
    throw new Error('no active session; call han_stream_start first');
  }
  active.ws.send(
    JSON.stringify({
      type: 'stream_chunk',
      event,
      ts: Date.now(),
    }),
  );
}

const server = new McpServer({
  name: 'han',
  version: '0.1.0',
});

server.tool(
  'han_stream_start',
  'Open a live Han streaming session. The hub registers your wallet, the session shows up in the public lobby, and every han_log call afterwards is broadcast to viewers in real time.',
  {
    description: z.string().min(1).max(120).optional().describe('Short headline for the lobby card (e.g. "building han v1")'),
    tool: z.string().min(1).max(32).optional().describe('AI tool name shown to viewers (e.g. "claude-code", "cursor", "aider")'),
    model: z.string().min(1).max(64).optional().describe('Optional model identifier (e.g. "claude-sonnet-4.6")'),
    handle: z.string().min(1).max(32).optional().describe('Streamer handle override (default: WALLET prefix)'),
  },
  async (args) => {
    const session = await openSession(args);
    return {
      content: [
        {
          type: 'text',
          text: `✓ live on han · session ${session.id}\n  share: ${HUB_URL.replace(/\/$/, '')}/sessions/${session.id}\n  call han_log on every turn so viewers see what you're doing.`,
        },
      ],
    };
  },
);

server.tool(
  'han_stream_stop',
  'End the current Han streaming session. After this the session disappears from the lobby and viewers receive a stream_end frame.',
  {},
  async () => {
    if (!active) {
      return { content: [{ type: 'text', text: 'no active session' }] };
    }
    const id = active.id;
    active.ws.send(JSON.stringify({ type: 'stream_end' }));
    active.ws.close();
    active = null;
    return {
      content: [{ type: 'text', text: `✓ session ${id} closed.` }],
    };
  },
);

server.tool(
  'han_log',
  'Push a single turn event into the live stream. Call this after every meaningful action: a user turn, an assistant turn, a tool call, or a file edit. Viewers in feed mode see these as ⟁ intent / ▸ action lines.',
  {
    role: z.enum(['user', 'assistant']).optional().describe('Set for a conversation turn (user or assistant message)'),
    content: z.string().min(1).max(1000).optional().describe('Required for turn events: the message text'),
    toolName: z.string().min(1).max(64).optional().describe('Set for a tool_call event: name of the tool being called'),
    toolArgs: z.string().max(200).optional().describe('Optional short summary of the tool arguments'),
    filePath: z.string().min(1).max(256).optional().describe('Set for a file_edit event: path that was modified'),
    fileDiff: z.string().max(500).optional().describe('Optional short summary of the change (e.g. "+12/-3 lines")'),
  },
  async (args) => {
    if (!active) {
      throw new Error('no active session; call han_stream_start first');
    }

    if (args.role && args.content) {
      sendEvent({ type: 'turn', role: args.role, content: args.content });
      return { content: [{ type: 'text', text: '✓ turn logged' }] };
    }
    if (args.toolName) {
      sendEvent({ type: 'tool_call', name: args.toolName, argsSummary: args.toolArgs });
      return { content: [{ type: 'text', text: `✓ tool_call logged: ${args.toolName}` }] };
    }
    if (args.filePath) {
      sendEvent({ type: 'file_edit', path: args.filePath, diffSummary: args.fileDiff });
      return { content: [{ type: 'text', text: `✓ file_edit logged: ${args.filePath}` }] };
    }
    throw new Error('han_log expects one of: (role+content), (toolName), or (filePath)');
  },
);

server.tool(
  'han_browse',
  'Snapshot the public Han lobby — all currently live streams with their handle, description, tool, viewer count, and total tips.',
  {},
  async () => {
    const res = await fetch(`${HUB_URL}/sessions`);
    if (!res.ok) {
      throw new Error(`hub /sessions returned ${res.status}`);
    }
    const sessions = (await res.json()) as Array<{
      id: string;
      streamerName?: string;
      description?: string;
      tool?: string;
      viewerCount: number;
      tipSol?: number;
      startedAt: number;
    }>;

    if (sessions.length === 0) {
      return { content: [{ type: 'text', text: 'no live streams right now.' }] };
    }

    const lines = sessions.map((s) => {
      const name = s.streamerName ?? s.id;
      const desc = s.description ?? '—';
      const tip = (s.tipSol ?? 0).toFixed(3);
      const age = Math.max(0, Math.floor((Date.now() - s.startedAt) / 60_000));
      return `  · ${name}  ·  ${desc}  ·  ${s.viewerCount} viewers · ${age}min · ${s.tool ?? 'shell'}  ·  🔥 ${tip} SOL  ·  id ${s.id}`;
    });
    return {
      content: [
        {
          type: 'text',
          text: `▮ open hans · ${sessions.length} live\n${lines.join('\n')}\n\ncall han_connect({ sessionId }) to peek any of them.`,
        },
      ],
    };
  },
);

server.tool(
  'han_connect',
  'Peek the most recent events from another live Han session. Returns the last ~30 turn/tool_call/file_edit lines so the AI can describe what that streamer is up to.',
  {
    sessionId: z.string().min(1).max(64).describe('The session id from han_browse (e.g. "9mdv.a436")'),
  },
  async ({ sessionId }) => {
    const res = await fetch(`${HUB_URL}/sessions/${sessionId}`);
    if (!res.ok) {
      throw new Error(`hub /sessions/${sessionId} returned ${res.status}`);
    }
    const meta = (await res.json()) as {
      streamerName?: string;
      description?: string;
      tipSol?: number;
      viewerCount?: number;
    };

    // The hub does not yet expose a cache snapshot endpoint over REST,
    // so v1 returns whatever session metadata is available + the live
    // viewer count. Real-time event peek lands in V1.1 as a hub /events
    // route.
    return {
      content: [
        {
          type: 'text',
          text:
            `▮ ${meta.streamerName ?? sessionId}\n` +
            `  ${meta.description ?? '—'}\n` +
            `  ◎ ${meta.viewerCount ?? 0} viewers · 🔥 ${(meta.tipSol ?? 0).toFixed(3)} SOL\n\n` +
            `(live event tail comes in V1.1; for now open a viewer terminal with \`pnpm browse\` + ENTER to watch in real time.)`,
        },
      ],
    };
  },
);

server.tool(
  'han_tip',
  'Send a tip from the local wallet to a streamer on Solana devnet. Han keeps 3% as commission (see ADR 2026-05-13-tip-fee-architecture) and the rest goes to the streamer. Returns the on-chain signature + explorer link.',
  {
    to: z.string().min(32).max(64).describe('Recipient wallet pubkey (Solana base58)'),
    amountSol: z.number().positive().max(10).describe('Tip amount in SOL (V1 max 10)'),
    sessionId: z.string().min(1).max(64).optional().describe('Session id so the hub can attribute the tip to a live stream'),
    memo: z.string().max(120).optional(),
  },
  async ({ to, amountSol, sessionId, memo }) => {
    if (!FEE_COLLECTOR) {
      throw new Error('FEE_COLLECTOR_PUBKEY env not set; tipping requires a fee collector wallet');
    }
    const connection = new Connection(RPC_URL, 'confirmed');
    const viewer = loadLocalKeypair();
    const result = await sendTipWithFee({
      connection,
      viewer,
      streamer: new PublicKey(to),
      feeCollector: new PublicKey(FEE_COLLECTOR),
      amountSol,
      memo,
    });

    // best-effort hub notification so /sessions tipSol updates
    if (sessionId) {
      void fetch(`${HUB_URL}/tips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          fromWallet: viewer.publicKey.toBase58(),
          toWallet: to,
          feeCollector: FEE_COLLECTOR,
          amountLamports: result.amountLamports,
          txSignature: result.signature,
        }),
      }).catch(() => {
        /* hub down or rejected — the chain tx still landed */
      });
    }

    return {
      content: [
        {
          type: 'text',
          text:
            `✓ tipped ${amountSol} SOL\n` +
            `  ${result.streamerLamports} lamports to streamer · ${result.feeLamports} lamports fee\n` +
            `  sig: ${result.signature}\n` +
            `  ${explorerUrl(result.signature)}`,
        },
      ],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr (not stdout — stdout is MCP protocol)
  process.stderr.write('[han-mcp] ready on stdio · hub=' + HUB_URL + '\n');
}

main().catch((err) => {
  process.stderr.write(`[han-mcp] fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

const shutdown = (): void => {
  if (active) {
    try {
      active.ws.send(JSON.stringify({ type: 'stream_end' }));
      active.ws.close();
    } catch {
      /* noop */
    }
    active = null;
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
