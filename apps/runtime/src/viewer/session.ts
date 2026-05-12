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

/**
 * Boots the viewer Ink app, opens a WebSocket to the hub, and joins
 * the requested session.
 */
export async function startViewer(opts: ViewerOptions): Promise<void> {
  const { hubUrl, sessionId, walletAddress, handle, streamerName } = opts;

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
      sessionCode: sessionId,
      streamerName: streamerName ?? sessionId,
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
