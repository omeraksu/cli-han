import { fetchLobby } from './lobby.js';
import { startViewer } from './session.js';

export interface ViewerEntryOptions {
  hubUrl: string;
  walletAddress?: string;
  sessionCode?: string;
}

/**
 * Entry point for viewer mode.
 * If sessionCode is provided, connect directly.
 * Otherwise show the lobby and let the user pick.
 */
export async function viewerEntry(opts: ViewerEntryOptions): Promise<void> {
  const { hubUrl, walletAddress, sessionCode } = opts;

  if (sessionCode) {
    await startViewer({ hubUrl, sessionId: sessionCode, walletAddress });
    return;
  }

  // Browse lobby mode
  const sessions = await fetchLobby(hubUrl);

  if (sessions.length === 0) {
    console.log('No active streams right now. Try again later.');
    return;
  }

  console.log('\nActive streams:\n');
  sessions.forEach((s, i) => {
    const agoSecs = Math.floor((Date.now() - s.startedAt) / 1000);
    const ago =
      agoSecs < 60
        ? `${agoSecs}s ago`
        : agoSecs < 3600
          ? `${Math.floor(agoSecs / 60)}m ago`
          : `${Math.floor(agoSecs / 3600)}h ago`;

    console.log(`  ${i + 1}. [${s.code}] viewers: ${s.viewerCount} | started: ${ago}`);
  });

  console.log('\nRun: han connect <code>');
}

export { startViewer } from './session.js';
export { fetchLobby } from './lobby.js';
