import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { Screen, Titlebar, SplitPane, Footer } from '../ui/Layout.js';
import { BroadcastFeed } from '../ui/BroadcastFeed.js';
import { ChatPanel } from '../ui/ChatPanel.js';
import { RawStream } from '../ui/RawStream.js';
import { GamesHub, type GameId } from '../ui/GamesHub.js';
import { Roulette } from '../ui/Roulette.js';
import { colors } from '../ui/colors.js';
import type { WsClient } from '../transport/ws-client.js';
import { useStream } from './hooks/useStream.js';
import { useChat } from './hooks/useChat.js';

interface AppProps {
  client: WsClient;
  sessionCode: string;
  streamerName: string;
}

type StreamMode = 'feed' | 'raw';
type Overlay = null | 'games-hub' | 'roulette';

export function App({ client, sessionCode, streamerName }: AppProps): JSX.Element {
  const { exit } = useApp();
  const [mode, setMode] = useState<StreamMode>('feed');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const { feedItems, rawLines } = useStream(client);
  const { messages, send } = useChat(client);

  const handleSend = useCallback(
    (text: string) => {
      if (text.startsWith('/')) {
        const [cmd] = text.slice(1).split(/\s+/);
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
          onQuit={() => setOverlay('games-hub')}
        />
      );
    }
    return <ChatPanel messages={messages} onSend={handleSend} focused />;
  })();

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
          <Text color={colors.dim}>
            {streamerName} · {overlay ?? mode} mode
          </Text>
        </Box>
      </Footer>
    </Screen>
  );
}
