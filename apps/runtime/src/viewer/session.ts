import React from 'react';
import { render } from 'ink';
import { WsClient } from '../transport/ws-client.js';
import type { ViewerToHub } from '../transport/protocol.js';
import { App } from './App.js';

export interface ViewerOptions {
  hubUrl: string;
  sessionId: string;
  walletAddress?: string;
  handle?: string;
  streamerName?: string;
}

interface SessionLookup {
  id: string;
  streamerWallet?: string;
  streamerName?: string;
  description?: string;
  tool?: string;
}

async function fetchSession(hubUrl: string, sessionId: string): Promise<SessionLookup | null> {
  try {
    const res = await fetch(`${hubUrl}/sessions/${sessionId}`);
    if (!res.ok) return null;
    return (await res.json()) as SessionLookup;
  } catch {
    return null;
  }
}

/**
 * Boots the viewer Ink app, opens a WebSocket to the hub, and joins
 * the requested session.
 */
export async function startViewer(opts: ViewerOptions): Promise<void> {
  const { hubUrl, sessionId, walletAddress, handle, streamerName } = opts;

  const session = await fetchSession(hubUrl, sessionId);

  const wsUrl = hubUrl.replace(/^http/, 'ws');
  const client = new WsClient(`${wsUrl}/ws`);
  client.connect();

  setTimeout(() => {
    const joinMsg: ViewerToHub = {
      type: 'join',
      sessionId,
      walletAddress,
      handle,
    };
    client.send(joinMsg);
  }, 200);

  const { waitUntilExit } = render(
    React.createElement(App, {
      client,
      hubUrl,
      sessionCode: sessionId,
      streamerName: session?.streamerName ?? streamerName ?? sessionId,
      streamerWallet: session?.streamerWallet,
      viewerWallet: walletAddress,
    })
  );

  const shutdown = () => {
    client.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await waitUntilExit();
  client.close();
}
