---
name: han-game-protocol
description: Han mini oyunlarının state machine yapısı, server/client protokolü, oyun SDK'sı ve Pong + Type-race detayları. game-engineer için ana referans.
---

# Han Game Protocol Reference

## Felsefe

Han'ın oyunları "mini" — birkaç dakika sürer, hızlı sonuçlanır, izleyici tekrarı eğlencelidir. Demo'da gösterişli olmalılar. Topluluk kolayca yenisini ekleyebilmeli.

## Game lifecycle

```
created (oda açıldı, escrow PDA derive edildi)
   ↓
filling (oyuncular join ediyor, escrow deposit)
   ↓
ready (minPlayers ulaşıldı, host start veya autostart)
   ↓
playing (state machine tick'liyor)
   ↓
finished (win condition gerçekleşti, server determined winner)
   ↓
settling (anchor settle_game çağrılıyor, attestation yazılıyor)
   ↓
settled (TX confirmed, oda kapanıyor)
```

İptal yolu:
- `created` → `cancelled` (host iptal etti)
- `filling` → `cancelled` (timeout veya host iptal, joined oyunculara refund)
- `playing` → `aborted` (oyuncu drop, host kararına göre)

## Manifest formatı

`apps/hub/games/<name>/manifest.json`:

```json
{
  "name": "pong",
  "displayName": "Pong",
  "description": "İki çubuk, top, kim önce 5 alır kazanır.",
  "minPlayers": 2,
  "maxPlayers": 2,
  "estimatedDurationSec": 120,
  "supportsEscrow": true,
  "supportsSpectators": true,
  "tickRate": 30,
  "version": "1.0.0"
}
```

## Server contract

`apps/hub/games/<name>/server.ts`:

```typescript
import { GameServer, GameInput, GameState } from '@han/game-sdk';

export class PongServer extends GameServer<PongState, PongInput> {
  initState(players: PlayerInfo[]): PongState {
    return {
      ball: { x: 40, y: 12, vx: 1, vy: 1 },
      paddles: {
        [players[0].pubkey]: { y: 10 },
        [players[1].pubkey]: { y: 10 },
      },
      scores: { [players[0].pubkey]: 0, [players[1].pubkey]: 0 },
      status: 'playing',
    };
  }
  
  onInput(player: string, input: PongInput): void {
    const paddle = this.state.paddles[player];
    if (input.key === 'W') paddle.y = Math.max(0, paddle.y - 1);
    if (input.key === 'S') paddle.y = Math.min(20, paddle.y + 1);
  }
  
  onTick(deltaMs: number): void {
    const ball = this.state.ball;
    ball.x += ball.vx;
    ball.y += ball.vy;
    
    // çarpışma, skor, win condition
    
    if (this.state.scores[player] >= 5) {
      this.state.status = 'finished';
      this.state.winner = player;
      this.emit('finished', { winner: player });
    }
  }
  
  onPlayerLeave(player: string): void {
    this.state.status = 'aborted';
    this.emit('aborted', { reason: 'player_left' });
  }
}
```

## Client contract

`apps/runtime/games/<name>/client.ts`:

```typescript
import { GameClient } from '@han/game-sdk';
import { Box, Text } from 'ink';

export class PongClient extends GameClient<PongState, PongInput> {
  onStateUpdate(state: PongState): void {
    this.state = state;
    this.render();
  }
  
  onKey(key: string): void {
    if (key === 'w' || key === 's') {
      this.sendInput({ key: key.toUpperCase() });
    }
    if (key === 'q') {
      this.leave();
    }
  }
  
  render(): JSX.Element {
    const { ball, paddles, scores } = this.state;
    return (
      <Box flexDirection="column">
        <Text>{Object.values(scores).join(' - ')}</Text>
        <Box>{this.drawCanvas(ball, paddles)}</Box>
        <Text dimColor>W/S move | Q quit</Text>
      </Box>
    );
  }
}
```

## State broadcast

Server her tick (Pong: 33ms) tüm oyunculara state push eder. Spectator'lara da düşük frekansta (her 100ms).

```typescript
// Server → Client
{ type: 'game_state', room_id: '...', state: { ... }, tick: 142 }
```

## Input protokol

Client'tan server'a sadece intent (input event), server state'i kontrol eder.

```typescript
// Client → Server
{ type: 'game_input', room_id: '...', input: { key: 'W' } }
```

Rate limit: oyuna göre değişir. Pong için max 60 input/s makul.

## Escrow entegrasyonu

`supportsEscrow: true` olan oyunlarda host entry fee koyar. Lifecycle:

1. Host `han play pong --entry-fee 0.01`
2. Hub anchor `create_game_room(room_id, entry_fee)` → vault PDA
3. Lobby'ye oda eklenir
4. Joiner `han play pong --join <kod>`
5. Hub anchor `join_game(room_id)` → joiner deposit'i vault'a
6. Min player'a ulaşıldığında oyun başlar
7. Win condition → server `winner` emit eder
8. Hub anchor `settle_game(room_id, winner)` → vault → winner
9. TX confirmed → all clients notified

## Pong detayı (V1)

### State

```typescript
type PongState = {
  ball: { x: number; y: number; vx: number; vy: number };
  paddles: Record<string, { y: number }>;
  scores: Record<string, number>;
  status: 'playing' | 'finished' | 'aborted';
  winner?: string;
};
```

### Canvas

80 sütun × 24 satır terminal. Pong area 80 × 20.

```
+------------------------------------------------------------------------------+
| 3                                                                          2 |
+------------------------------------------------------------------------------+
|                                                                              |
|   ┃                                                                          |
|   ┃                                                                     ┃    |
|   ┃                                                                     ┃    |
|                                                                         ┃    |
|                                          ●                                   |
|                                                                              |
|                                                                              |
+------------------------------------------------------------------------------+
| W/S move | Q quit                                                            |
+------------------------------------------------------------------------------+
```

### Tick

30 fps. Top sabit hızda hareket. Çarpışma:
- Üst/alt duvar → vy *= -1
- Çubuk → vx *= -1, vy küçük rastgele değişim
- Sol/sağ kenar → diğer oyuncu skor

### Win condition

5 sayı ilk olan kazanır.

## Type-race detayı (V1)

### State

```typescript
type TypeRaceState = {
  paragraph: string;
  positions: Record<string, number>;
  errors: Record<string, number>;
  status: 'playing' | 'finished';
  winner?: string;
  startedAt: number;
};
```

### Paragraph havuzu

Türkçe ve İngilizce paragraflar, 100-200 karakter.

### Render

```
+------------------------------------------------------------------------------+
| Type-race | 0:23                                                             |
+------------------------------------------------------------------------------+
|                                                                              |
| Yazılım geliştirme bir sanat ve bilim karışımıdır. Sabır gerektirir.         |
| ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ |
|                                                                              |
| Players:                                                                     |
|   alice  ████████████░░░░░░░  44/68  errors: 1                               |
|   bob    ████████░░░░░░░░░░░  28/68  errors: 0                               |
|                                                                              |
+------------------------------------------------------------------------------+
| Type to play | Q quit                                                        |
+------------------------------------------------------------------------------+
```

### Win condition

Paragrafı doğru tamamlayan ilk oyuncu kazanır.

## Anti-cheat

Client server'a sadece input gönderir, state göndermez. Tick rate sınırı. Suspicious pattern detection (instant 180° hareket, vs.).

## Yeni oyun ekleme

V1'de monorepo içi:

```
apps/hub/games/<name>/
├── manifest.json
├── server.ts (extends GameServer)
└── tests/

apps/runtime/games/<name>/
└── client.ts (extends GameClient)
```

V2'de `@han/game-sdk` npm paketi olarak yayınlanır.
