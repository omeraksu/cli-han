import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { Connection, PublicKey } from '@solana/web3.js';
import { loadLocalKeypair, sendTipWithFee } from '@han/sdk';
import { Screen, Titlebar, SplitPane, Footer } from '../ui/Layout.js';
import { BroadcastFeed } from '../ui/BroadcastFeed.js';
import { ChatPanel } from '../ui/ChatPanel.js';
import { RawStream } from '../ui/RawStream.js';
import { GamesHub, type GameId } from '../ui/GamesHub.js';
import { Roulette } from '../ui/Roulette.js';
import { TipDialog, type TipState } from '../ui/TipDialog.js';
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
type Overlay = null | 'games-hub' | 'roulette' | 'tip';

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
  const [mode, setMode] = useState<StreamMode>('feed');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tip, setTip] = useState<TipOverlayState>({
    amount: DEFAULT_TIP_SOL,
    status: 'confirm',
  });
  const { feedItems, rawLines } = useStream(client);
  const { messages, send } = useChat(client);
  const metrics = useViewerMetrics(client);

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
        left={
          mode === 'feed' ? (
            <BroadcastFeed items={feedItems} maxItems={6} streamerName={streamerName} />
          ) : (
            <RawStream lines={rawLines} maxLines={32} />
          )
        }
        right={rightPane}
      />
      <Footer>
        <Box justifyContent="space-between">
          <Text color={colors.dim}>/raw   /play   /tip   /quit</Text>
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
