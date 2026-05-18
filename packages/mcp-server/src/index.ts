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
 *   - han_tip            send a 3%-fee native-AVAX tip via HanTipRouter
 *
 * Transport: stdio (Claude Code / Cursor / generic MCP clients).
 *
 * Env:
 *   HAN_HUB_URL              default http://localhost:3000
 *   HAN_WALLET_PATH          default ~/.config/han-avax/wallet.json
 *   AVAX_RPC_URL             default https://api.avax-test.network/ext/bc/C/rpc
 *   AVAX_NETWORK             default fuji
 *
 * ADR: 2026-05-13-mcp-server-architecture
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import WebSocket from 'ws';
import { z } from 'zod';
import {
  createPublicClient,
  createWalletClient,
  fallback,
  getAddress,
  http,
  type Address,
  type PrivateKeyAccount,
} from 'viem';
import { avalanche, avalancheFuji } from 'viem/chains';
import { loadLocalAccount, sendTipWithFee } from '@han/sdk/dist/index.js';

const HUB_URL = process.env['HAN_HUB_URL'] ?? 'http://localhost:3000';
const WALLET_PATH = process.env['HAN_WALLET_PATH'];
const NETWORK = (process.env['AVAX_NETWORK'] ?? 'fuji') as 'fuji' | 'mainnet';
const RPC_URL =
  process.env['AVAX_RPC_URL'] ??
  (NETWORK === 'mainnet'
    ? 'https://api.avax.network/ext/bc/C/rpc'
    : 'https://api.avax-test.network/ext/bc/C/rpc');

let cachedAccount: PrivateKeyAccount | null = null;
function getAccount(): PrivateKeyAccount {
  if (!cachedAccount) {
    cachedAccount = loadLocalAccount(WALLET_PATH);
  }
  return cachedAccount;
}

interface HubConfig {
  network: string;
  chainId: number;
  tipRouter: string;
  feeReceiver: string;
  hanContract: string | null;
  tipFeeBps: number;
}

let cachedHubConfig: HubConfig | null = null;
async function getHubConfig(): Promise<HubConfig> {
  if (cachedHubConfig) return cachedHubConfig;
  const res = await fetch(`${HUB_URL}/config`);
  if (!res.ok) {
    throw new Error(`hub /config returned ${res.status}: ${await res.text()}`);
  }
  cachedHubConfig = (await res.json()) as HubConfig;
  return cachedHubConfig;
}

interface ActiveSession {
  id: string;
  ws: WebSocket;
  walletAddress: string;
  wsToken: string;
  startedAt: number;
}

let active: ActiveSession | null = null;

function explorerUrl(hash: string): string {
  const base = NETWORK === 'mainnet' ? 'https://snowtrace.io' : 'https://testnet.snowtrace.io';
  return `${base}/tx/${hash}`;
}

async function openSession(opts: {
  description?: string;
  tool?: string;
  model?: string;
  handle?: string;
}): Promise<ActiveSession> {
  if (active) {
    throw new Error(`a session is already live (${active.id}); call han_stream_stop first`);
  }

  const account = getAccount();
  const wallet = account.address;

  const nonceRes = await fetch(`${HUB_URL}/sessions/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet }),
  });
  if (!nonceRes.ok) {
    throw new Error(`hub /sessions/nonce returned ${nonceRes.status}: ${await nonceRes.text()}`);
  }
  const { nonce, message } = (await nonceRes.json()) as { nonce: string; message?: string };
  const signMessage = message ?? `Han login\nnonce: ${nonce}`;
  const signature = await account.signMessage({ message: signMessage });

  const res = await fetch(`${HUB_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      streamerWallet: wallet,
      nonce,
      signature,
      streamerName: opts.handle,
      description: opts.description,
      tool: opts.tool ?? 'mcp',
    }),
  });
  if (!res.ok) {
    throw new Error(`hub /sessions returned ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { sessionId: string; code: string; wsToken: string };

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
      walletAddress: wallet,
      wsToken: body.wsToken,
      streamerName: opts.handle,
      description: opts.description,
      tool: opts.tool ?? 'mcp',
    }),
  );

  active = {
    id: body.sessionId,
    ws,
    walletAddress: wallet,
    wsToken: body.wsToken,
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
    description: z.string().min(1).max(120).optional(),
    tool: z.string().min(1).max(32).optional(),
    model: z.string().min(1).max(64).optional(),
    handle: z.string().min(1).max(32).optional(),
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
  'End the current Han streaming session.',
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
  'Push a single turn event into the live stream. Call this after every meaningful action: a user turn, an assistant turn, a tool call, or a file edit.',
  {
    role: z.enum(['user', 'assistant']).optional(),
    content: z.string().min(1).max(1000).optional(),
    toolName: z.string().min(1).max(64).optional(),
    toolArgs: z.string().max(200).optional(),
    filePath: z.string().min(1).max(256).optional(),
    fileDiff: z.string().max(500).optional(),
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
      tipAvax?: number;
      startedAt: number;
    }>;

    if (sessions.length === 0) {
      return { content: [{ type: 'text', text: 'no live streams right now.' }] };
    }

    const lines = sessions.map((s) => {
      const name = s.streamerName ?? s.id;
      const desc = s.description ?? '—';
      const tip = (s.tipAvax ?? 0).toFixed(4);
      const age = Math.max(0, Math.floor((Date.now() - s.startedAt) / 60_000));
      return `  · ${name}  ·  ${desc}  ·  ${s.viewerCount} viewers · ${age}min · ${s.tool ?? 'shell'}  ·  🔥 ${tip} AVAX  ·  id ${s.id}`;
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
  'Peek a live Han session: streamer name, description, viewer count, total tips so far.',
  {
    sessionId: z.string().min(1).max(64),
  },
  async ({ sessionId }) => {
    const res = await fetch(`${HUB_URL}/sessions/${sessionId}`);
    if (!res.ok) {
      throw new Error(`hub /sessions/${sessionId} returned ${res.status}`);
    }
    const meta = (await res.json()) as {
      streamerName?: string;
      description?: string;
      tipAvax?: number;
      viewerCount?: number;
    };

    return {
      content: [
        {
          type: 'text',
          text:
            `▮ ${meta.streamerName ?? sessionId}\n` +
            `  ${meta.description ?? '—'}\n` +
            `  ◎ ${meta.viewerCount ?? 0} viewers · 🔥 ${(meta.tipAvax ?? 0).toFixed(4)} AVAX\n\n` +
            `(live event tail comes in V1.1; for now open a viewer terminal with \`pnpm browse\` + ENTER to watch in real time.)`,
        },
      ],
    };
  },
);

server.tool(
  'han_tip',
  'Send a native-AVAX tip from the local wallet to a streamer via HanTipRouter. Han keeps 3% as commission (see ADR 2026-05-13-tip-fee-architecture). Returns the on-chain tx hash + Snowtrace link.',
  {
    to: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .describe('Recipient wallet address (0x...)'),
    amountAvax: z
      .union([z.string(), z.number()])
      .describe('Tip amount in AVAX, e.g. "0.05"'),
    sessionId: z.string().min(1).max(64).optional(),
  },
  async ({ to, amountAvax, sessionId }) => {
    const hubConfig = await getHubConfig();
    const chain = NETWORK === 'mainnet' ? avalanche : avalancheFuji;
    const transport = fallback([http(RPC_URL, { retryCount: 2 })], { rank: false });
    const publicClient = createPublicClient({ chain, transport });
    const account = getAccount();
    const walletClient = createWalletClient({ account, chain, transport });
    const result = await sendTipWithFee({
      publicClient,
      walletClient,
      router: getAddress(hubConfig.tipRouter) as Address,
      streamer: getAddress(to) as Address,
      amountAvax: String(amountAvax),
    });

    if (sessionId) {
      void fetch(`${HUB_URL}/tips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          fromWallet: account.address,
          toWallet: getAddress(to),
          router: getAddress(hubConfig.tipRouter),
          amountWei: result.amountWei.toString(),
          txHash: result.hash,
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
            `✓ tipped ${amountAvax} AVAX\n` +
            `  streamer ${result.streamerWei} wei · fee ${result.feeWei} wei\n` +
            `  tx: ${result.hash}\n` +
            `  ${explorerUrl(result.hash)}`,
        },
      ],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
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
