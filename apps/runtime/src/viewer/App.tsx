import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Connection, PublicKey } from '@solana/web3.js';
import { loadLocalKeypair, sendTipWithFee } from '@han/sdk';
import { Screen, Titlebar, SplitPane, Footer } from '../ui/Layout.js';
import { BroadcastFeed } from '../ui/BroadcastFeed.js';
import { ChatPanel } from '../ui/ChatPanel.js';
import { RawStream } from '../ui/RawStream.js';
import { GamesHub, type GameId } from '../ui/GamesHub.js';
import { Roulette } from '../ui/Roulette.js';
import { Pong } from '../ui/Pong.js';
import { HorseRace } from '../ui/HorseRace.js';
import { TipDialog, type TipState } from '../ui/TipDialog.js';
import { ProfileScreen, type HanProfile, type ProfileView } from '../ui/Profile.js';
import { colors } from '../ui/colors.js';
import type { WsClient } from '../transport/ws-client.js';
import { useStream } from './hooks/useStream.js';
import { useChat } from './hooks/useChat.js';
import { useViewerMetrics } from './hooks/useViewerMetrics.js';

interface AppProps {
  client: WsClient;
  hubUrl: string;
  sessionCode: string;
  streamerName: string;
  streamerWallet?: string;
  viewerWallet?: string;
}

type StreamMode = 'feed' | 'raw';
type Overlay = null | 'games-hub' | 'roulette' | 'pong' | 'horse-race' | 'tip' | 'profile';

interface ProfileOverlayState {
  view: ProfileView;
  profile: HanProfile;
}

const MOCK_STATS = {
  streamsHosted: 2,
  hoursStreamed: 3,
  tipsReceivedUsdc: 1.2,
  gamesPlayed: 5,
  gamesWon: 2,
  potEarnedUsdc: 0.4,
};

interface TipOverlayState {
  amount: number;
  status: TipState;
  signature?: string;
  errorMessage?: string;
}

const DEFAULT_TIP_SOL = 0.005;

export function App({
  client,
  hubUrl,
  sessionCode,
  streamerName,
  streamerWallet,
  viewerWallet,
}: AppProps): JSX.Element {
  const { exit } = useApp();
  // V1 default: raw. Summarizer (broadcast feed) ships in V1.5; until
  // it does, `feed` is always empty. Users can flip back via /feed.
  const [mode, setMode] = useState<StreamMode>('raw');

  // Split ratio between stream pane (left) and chat/overlay pane (right).
  // [ shifts the divider left (right pane grows), ] shifts it right.
  // Only active while an overlay is open so it never eats chat keystrokes.
  const SPLIT_DEFAULT = 0.52;
  const SPLIT_OVERLAY_DEFAULT = 0.42;
  const SPLIT_MIN = 0.25;
  const SPLIT_MAX = 0.75;
  const [splitRatio, setSplitRatio] = useState(SPLIT_DEFAULT);

  // Tell the hub our initial mode so the fanout adds us to the raw bucket.
  useEffect(() => {
    const t = setTimeout(() => {
      client.send({ type: 'switch_mode', mode: 'raw' });
    }, 300);
    return () => clearTimeout(t);
  }, [client]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tip, setTip] = useState<TipOverlayState>({
    amount: DEFAULT_TIP_SOL,
    status: 'confirm',
  });
  const [profileOverlay, setProfileOverlay] = useState<ProfileOverlayState | null>(null);
  const { feedItems, terminalSnapshot, semantic } = useStream(client);
  const { messages, send } = useChat(client);
  const metrics = useViewerMetrics(client);

  // When entering / leaving an overlay, snap the split to a sensible default
  // so games get more breathing room and chat goes back to ~52/48.
  useEffect(() => {
    setSplitRatio(overlay ? SPLIT_OVERLAY_DEFAULT : SPLIT_DEFAULT);
  }, [overlay]);

  // Adjust the split with [ / ]. Disabled while chat is focused (overlay
  // null) and while text input dialogs (tip) are active.
  useInput(
    (input) => {
      if (input === '[') {
        setSplitRatio((r) => Math.max(SPLIT_MIN, +(r - 0.05).toFixed(2)));
      } else if (input === ']') {
        setSplitRatio((r) => Math.min(SPLIT_MAX, +(r + 0.05).toFixed(2)));
      }
    },
    { isActive: overlay !== null && overlay !== 'tip' },
  );

  const runTip = useCallback(async () => {
    if (!streamerWallet) {
      setTip((t) => ({ ...t, status: 'error', errorMessage: 'streamer wallet unknown' }));
      return;
    }
    const feeCollectorPubkey = process.env['FEE_COLLECTOR_PUBKEY'];
    if (!feeCollectorPubkey) {
      setTip((t) => ({
        ...t,
        status: 'error',
        errorMessage: 'FEE_COLLECTOR_PUBKEY env missing',
      }));
      return;
    }

    setTip((t) => ({ ...t, status: 'pending' }));
    try {
      const rpcUrl = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      const viewer = loadLocalKeypair();
      const result = await sendTipWithFee({
        connection,
        viewer,
        streamer: new PublicKey(streamerWallet),
        feeCollector: new PublicKey(feeCollectorPubkey),
        amountSol: tip.amount,
      });

      // notify hub so it persists + bumps lobby tipSol
      void fetch(`${hubUrl}/tips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionCode,
          fromWallet: viewer.publicKey.toBase58(),
          toWallet: streamerWallet,
          feeCollector: feeCollectorPubkey,
          amountLamports: result.amountLamports,
          txSignature: result.signature,
        }),
      }).catch(() => {
        // hub down or rejected — the chain tx still went through
      });

      setTip((t) => ({ ...t, status: 'sent', signature: result.signature }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTip((t) => ({ ...t, status: 'error', errorMessage: message }));
    }
  }, [hubUrl, sessionCode, streamerWallet, tip.amount]);

  const handleTipCancel = useCallback(() => {
    setOverlay(null);
    setTip({ amount: DEFAULT_TIP_SOL, status: 'confirm' });
  }, []);

  const handleSend = useCallback(
    (text: string) => {
      if (text.startsWith('/')) {
        const parts = text.slice(1).split(/\s+/);
        const cmd = parts[0];

        if (cmd === 'raw') {
          setMode('raw');
          client.send({ type: 'switch_mode', mode: 'raw' });
          return;
        }
        if (cmd === 'feed') {
          setMode('feed');
          client.send({ type: 'switch_mode', mode: 'feed' });
          return;
        }
        if (cmd === 'play') {
          setOverlay('games-hub');
          return;
        }
        if (cmd === 'tip') {
          const amount = Number(parts[1] ?? DEFAULT_TIP_SOL);
          if (Number.isFinite(amount) && amount > 0) {
            setTip({ amount, status: 'confirm' });
            setOverlay('tip');
          }
          return;
        }
        if (cmd === 'profile') {
          const target = parts[1]?.replace(/^@/, '');
          if (!target || target.toLowerCase() === 'me') {
            // self view — viewer's own keypair if known, otherwise placeholder
            const pubkey = viewerWallet ?? sessionCode;
            setProfileOverlay({
              view: 'view-self',
              profile: {
                pubkey,
                handle: 'me',
                bio: 'builder · ai × web3 · kozalak hub',
                memberSince: new Date().toISOString().slice(0, 10),
                stats: MOCK_STATS,
              },
            });
          } else {
            // other view — placeholder until hub /profile/:handle lands
            setProfileOverlay({
              view: 'view-other',
              profile: {
                pubkey: streamerWallet ?? target,
                handle: target,
                bio: streamerName === target ? 'live now on han' : 'han member',
                isLive: streamerName === target,
                liveDuration: streamerName === target ? '1m' : undefined,
                viewerCount: streamerName === target ? metrics.viewerCount : 0,
                stats: MOCK_STATS,
              },
            });
          }
          setOverlay('profile');
          return;
        }
        if (cmd === 'settings') {
          setProfileOverlay({
            view: 'settings',
            profile: {
              pubkey: viewerWallet ?? sessionCode,
              handle: 'me',
            },
          });
          setOverlay('profile');
          return;
        }
        if (cmd === 'quit') {
          client.close();
          exit();
          return;
        }
        return;
      }
      send(text);
    },
    [client, send, exit]
  );

  const handleGameSelect = useCallback((id: GameId) => {
    if (id === 'roulette') {
      setOverlay('roulette');
    } else if (id === 'pong') {
      setOverlay('pong');
    } else if (id === 'horse-race') {
      setOverlay('horse-race');
    }
  }, []);

  const handleShareToChat = useCallback(
    (label: string) => {
      send(`🎲 rolled ${label}`);
      setOverlay(null);
    },
    [send]
  );

  const rightPane = (() => {
    if (overlay === 'games-hub') {
      return <GamesHub onSelect={handleGameSelect} onQuit={() => setOverlay(null)} />;
    }
    if (overlay === 'roulette') {
      return (
        <Roulette
          onShare={handleShareToChat}
          onTip={() => {
            setTip({ amount: DEFAULT_TIP_SOL, status: 'confirm' });
            setOverlay('tip');
          }}
          onQuit={() => setOverlay('games-hub')}
        />
      );
    }
    if (overlay === 'pong') {
      return (
        <Pong
          onQuit={() => setOverlay('games-hub')}
          playerName={'you'}
          focused
        />
      );
    }
    if (overlay === 'horse-race') {
      return (
        <HorseRace
          onQuit={() => setOverlay('games-hub')}
          focused
        />
      );
    }
    if (overlay === 'profile' && profileOverlay) {
      return (
        <ProfileScreen
          view={profileOverlay.view}
          profile={profileOverlay.profile}
          focused
          onBack={() => {
            setOverlay(null);
            setProfileOverlay(null);
          }}
          onEdit={() =>
            setProfileOverlay((p) => (p ? { ...p, view: 'edit' } : p))
          }
          onSettings={() =>
            setProfileOverlay((p) => (p ? { ...p, view: 'settings' } : p))
          }
          onSubmitEdit={(next) =>
            setProfileOverlay((p) => (p ? { view: 'view-self', profile: next } : p))
          }
          onTip={() => {
            setTip({ amount: DEFAULT_TIP_SOL, status: 'confirm' });
            setOverlay('tip');
          }}
          onWatchStream={() => {
            setOverlay(null);
            setProfileOverlay(null);
          }}
        />
      );
    }
    if (overlay === 'tip') {
      return (
        <TipDialog
          recipient={streamerName}
          recipientPubkey={streamerWallet}
          amount={tip.amount}
          network={process.env['SOLANA_CLUSTER'] ?? 'devnet'}
          state={tip.status}
          signature={tip.signature}
          explorerUrl={
            tip.signature
              ? `https://explorer.solana.com/tx/${tip.signature}?cluster=devnet`
              : undefined
          }
          errorMessage={tip.errorMessage}
          onConfirm={runTip}
          onCancel={handleTipCancel}
          focused
        />
      );
    }
    return <ChatPanel messages={messages} onSend={handleSend} focused />;
  })();

  void viewerWallet;

  return (
    <Screen>
      <Titlebar title={`~/  —  han viewer · ${sessionCode}`} />
      <SplitPane
        leftRatio={splitRatio}
        left={
          mode === 'feed' ? (
            <BroadcastFeed
              items={feedItems}
              semantic={semantic}
              maxItems={6}
              streamerName={streamerName}
            />
          ) : (
            <RawStream snapshot={terminalSnapshot} />
          )
        }
        right={rightPane}
      />
      <Footer>
        <Box justifyContent="space-between">
          <Text color={colors.dim}>
            /raw  /play  /tip  /profile  /quit
            {overlay && overlay !== 'tip' ? '   ·   [ [ / ] ] resize' : ''}
          </Text>
          <Box>
            <Text color={colors.dim}>{metrics.viewerCount} viewers</Text>
            <Text color={colors.dim}>{'  ·  '}</Text>
            <Text color={colors.accent}>🔥 {metrics.tipSol.toFixed(3)} SOL</Text>
            <Text color={colors.dim}>{'  ·  '}</Text>
            <Text color={colors.dim}>{streamerName}</Text>
          </Box>
        </Box>
      </Footer>
    </Screen>
  );
}
