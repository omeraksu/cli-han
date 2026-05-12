import React from 'react';
import { Box, Text, useInput } from 'ink';
import { colors } from './colors.js';

export type GameId = 'roulette' | 'pong' | 'horse-race' | 'type-race';

interface GameDef {
  id: GameId;
  symbol: string;
  symbolColor: string;
  title: string;
  description: string;
  key: '1' | '2' | '3' | '4';
  available: boolean;
}

const GAMES: GameDef[] = [
  {
    id: 'roulette',
    symbol: '◇',
    symbolColor: 'dim',
    title: 'solo roulette',
    description: 'spin while you wait. free. 10s avg.',
    key: '1',
    available: true,
  },
  {
    id: 'pong',
    symbol: '◆',
    symbolColor: 'foreground',
    title: 'pong · solo',
    description: 'vs cpu. free. first to 5. multiplayer next.',
    key: '2',
    available: true,
  },
  {
    id: 'horse-race',
    symbol: '▶',
    symbolColor: 'info',
    title: 'at yarışı',
    description: 'pick a model. watch it race. 6 contenders.',
    key: '3',
    available: true,
  },
  {
    id: 'type-race',
    symbol: '✦',
    symbolColor: 'highlight',
    title: 'type race',
    description: 'up to 6 racers. on-chain stake. winner takes pot.',
    key: '4',
    available: false,
  },
];

interface GamesHubProps {
  onSelect: (id: GameId) => void;
  onQuit?: () => void;
  focused?: boolean;
}

/**
 * Games hub matching figma frame 24:11.
 *
 * Three game cards, keyboard-selected by digit. Pong + Type Race ship in
 * V1.1 per the revised game-decoupled-ui ADR, so their cards are visible
 * but marked "coming v1.1" and the select keys are no-ops for now.
 */
export function GamesHub({ onSelect, onQuit, focused = true }: GamesHubProps): React.JSX.Element {
  useInput(
    (input, key) => {
      const lower = input?.toLowerCase();
      if (lower === 'q' || key.escape) {
        if (onQuit) onQuit();
        return;
      }
      const game = GAMES.find((g) => g.key === input);
      if (game && game.available) {
        onSelect(game.id);
      }
    },
    { isActive: focused }
  );

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text color={colors.accent} bold>
        ▮ han · games hub
      </Text>
      <Box marginTop={1} marginBottom={1}>
        <Text color={colors.dim}>pick what to play while claude thinks.</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {GAMES.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
      </Box>

      <Box marginTop={2}>
        <Text color={colors.dim}>more games via game SDK · roadmap V2</Text>
      </Box>

      <Box marginTop={2}>
        <Text color={colors.info}>[ 1-4 ] select{'   '}</Text>
        <Text color={colors.info}>[ Q ] back to stream</Text>
      </Box>
    </Box>
  );
}

function GameCard({ game }: { game: GameDef }): React.JSX.Element {
  const symbolColor = colors[game.symbolColor as keyof typeof colors] ?? colors.foreground;

  return (
    <Box
      flexDirection="row"
      borderStyle="round"
      borderColor={game.available ? colors.border : colors.smoke}
      paddingX={2}
      paddingY={0}
      marginBottom={1}
    >
      <Box width={4}>
        <Text color={symbolColor} bold>
          {game.symbol}
        </Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        <Box>
          <Text color={colors.foreground} bold>
            {game.title}
          </Text>
          {!game.available ? (
            <Text color={colors.dim}>{'   '}· coming v1.1</Text>
          ) : null}
        </Box>
        <Text color={colors.dim}>{game.description}</Text>
      </Box>
      <Box width={14} justifyContent="flex-end">
        <Text color={game.available ? colors.info : colors.dim}>→ press {game.key}</Text>
      </Box>
    </Box>
  );
}
