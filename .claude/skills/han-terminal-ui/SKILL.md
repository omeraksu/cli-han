---
name: han-terminal-ui
description: Han'ın terminal UI standartları, ANSI escape sequences, ink component pattern'leri, layout sistemi, renk paleti. ui-designer için ana referans.
---

# Han Terminal UI Reference

## Felsefe

Han bir CLI ama "han bir dünya" cümlesinin görsel karşılığı olmalı. Sadelik, sıcaklık, antik + dijital kavşak. Aşırı süs yok. Terminal'in kendi karakterine saygı.

## Tech: ink

`ink` (React for terminal) tercih edildi. Sebep: declarative component model, state management, terminal layout (flexbox-tarzı). Bazı raw ANSI gerekirse `ink-raw` veya doğrudan `process.stdout.write`.

```typescript
import { render, Box, Text } from 'ink';

const App = () => (
  <Box flexDirection="column" borderStyle="round">
    <Text bold>Han</Text>
  </Box>
);

render(<App />);
```

## Renk paleti

ANSI 256-color base. True color (24-bit) bonus.

| Rol | 256-color | Hex |
|---|---|---|
| Default fg | terminal default | - |
| Accent (Han brand) | 178 (gold-ish amber) | `#d7af00` |
| Success | 34 | `#00af00` |
| Warning | 178 | aynı accent |
| Danger | 196 | `#ff0000` |
| Muted | 245 | `#8a8a8a` |
| Highlight | 51 | `#00ffff` |
| Subtle | 240 | `#585858` |

ink ile:
```jsx
<Text color="#d7af00">Han</Text>
<Text dimColor>muted</Text>
<Text bold color="green">✓ done</Text>
```

Terminal default arka planı kullan, yeniden boyamak istemezsin.

## Tipografi

Monospace zorunlu. Hiyerarşi sadece **ağırlık + renk + boşluk** ile.

```jsx
<Text bold>HEADING</Text>
<Text>body text</Text>
<Text dimColor>caption</Text>
<Text italic>{status}</Text>
```

## Box drawing

Yumuşak köşeler tercih (Han hissi):

```
╭─────╮
│     │
╰─────╯
```

ink'te:
```jsx
<Box borderStyle="round">
```

## Layout

Default izleyici layout (terminal genişliği ≥ 100 sütun):

```
╭─ stream: bob/debug-rust ──────────────────────╮ ╭─ chat ──────────╮
│                                                │ │                 │
│   broadcast feed                               │ │   alice         │
│   (özet akışı)                                 │ │   gg debugging  │
│                                                │ │                 │
│                                                │ │   carol         │
│                                                │ │   ne yapıyor?   │
│                                                │ │                 │
│                                                │ │ > [type msg]    │
╰────────────────────────────────────────────────╯ ╰─────────────────╯
[feed] [raw] [play] [tip] [quit]                              178 viewers
```

Dar terminal (< 100 sütun) → tek pane stack.

## Component contract

### Status bar

```jsx
<Box justifyContent="space-between" paddingX={1}>
  <Text>
    [<Text color="#d7af00">F</Text>eed]
    [<Text color="#d7af00">R</Text>aw]
    [<Text color="#d7af00">P</Text>lay]
    [<Text color="#d7af00">T</Text>ip]
    [<Text color="#d7af00">Q</Text>uit]
  </Text>
  <Text dimColor>{viewers} viewers</Text>
</Box>
```

### Feed pane

```jsx
<Box flexDirection="column" borderStyle="round" padding={1}>
  {feedItems.map(item => (
    <Box key={item.id} marginBottom={1}>
      <Text dimColor>{formatTime(item.ts)} </Text>
      {item.live && <Text color="red">● </Text>}
      <Text>{item.text}</Text>
    </Box>
  ))}
</Box>
```

### On-chain address

```jsx
const OnChainAddress = ({ value, kind = 'address', cluster = 'devnet' }) => {
  const short = `${value.slice(0, 4)}...${value.slice(-4)}`;
  return (
    <Box>
      <Text>
        <Text dimColor>{kind === 'tx' ? '◇ ' : ''}</Text>
        <Text>{short}</Text>
        <Text dimColor> [c]opy</Text>
      </Text>
    </Box>
  );
};
```

[c] basıldığında clipboard'a kopyalar. `clipboardy` paketi.

## Animation

`ink-spinner` veya custom braille spinner:

```jsx
import Spinner from 'ink-spinner';

<Box>
  <Spinner type="dots" />
  <Text> Bağlanıyor...</Text>
</Box>
```

`HAN_NO_ANIMATION=1` env var → tüm animasyonlar kapansın.

## Klavye shortcut'ları

| Shortcut | Action |
|---|---|
| F | Feed mode |
| R | Raw mode |
| P | Play (oyun lobby) |
| T | Tip dialog |
| C | Chat focus |
| Q | Quit |
| ? | Help overlay |
| ↑/↓ | Scroll feed/raw |
| / | Komut satırı |

ink ile:
```jsx
import { useInput } from 'ink';

useInput((input, key) => {
  if (input === 'q') exit();
  if (input === 'r') setMode('raw');
  if (input === 'f') setMode('feed');
});
```

## Dialog

```
╭─ tip streamer ────────────────╮
│                               │
│  Streamer: BobX...y2a         │
│  Amount: 0.05 SOL             │
│  Fee: ~0.000005 SOL           │
│                               │
│  [enter] confirm  [esc] cancel│
╰───────────────────────────────╯
```

## Toast

Sağ üst köşede 3-5 saniyelik küçük kutu:

```
                                    ╭─────────────────────────╮
                                    │ ✓ Tip sent              │
                                    │ ◇ 2EHzr...xK2a          │
                                    ╰─────────────────────────╯
```

## Erişilebilirlik

- Renk asla tek başına anlam taşıyıcı değil. Status indicator'lar hem renk hem sembol (`✓`, `⚠`, `●`, `◇`) içerir.
- Tüm interactive element keyboard erişilebilir.

## Test

`ink-testing-library` ile component test:

```typescript
import { render } from 'ink-testing-library';

test('FeedPane renders items', () => {
  const { lastFrame } = render(<FeedPane items={mockFeed} />);
  expect(lastFrame()).toContain('debug ediyor');
});
```

## Privacy notes

UI hassas bilgi göstermesin:
- Wallet pubkey kısaltılmış (4...4 format)
- TX hash kısaltılmış
- Hata mesajları minimum bilgi
