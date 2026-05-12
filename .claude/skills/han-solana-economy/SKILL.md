---
name: han-solana-economy
description: Han'ın Solana program ekonomisi. PDA seed'leri, escrow logic, attestation pattern'leri, tip flow, hub authority. anchor-engineer ve solana-client-engineer için ana referans.
---

# Han Solana Economy

## Felsefe

Han'da Solana minimal ama her yerde. Tip, oyun escrow, attestation. Token yok (V1'de).

Program ince. Çoğu para hareketi program-less (System.transfer). Programa düşen iş: escrow + payout, attestation kayıt.

## V1 scope

| Akış | Mekanik | Program gerekli mi |
|---|---|---|
| Tip yayıncıya | System.transfer doğrudan | Hayır |
| Tip izleyiciye | System.transfer doğrudan | Hayır |
| Oyun entry fee deposit | join_game instruction | Evet |
| Oyun winner payout | settle_game instruction | Evet |
| Oyun iptal refund | cancel_game + claim_refund | Evet |
| Game leaderboard attestation | SAS create_attestation | Hayır (off-chain, hub authority imzalar) |
| Session attestation | V2 | - |

## Tip flow (program-less)

İzleyici aktif yayını izlerken `han tip 0.05`:

```typescript
const ix = SystemProgram.transfer({
  fromPubkey: viewerWallet.publicKey,
  toPubkey: streamerPubkey,
  lamports: 0.05 * LAMPORTS_PER_SOL,
});

const tx = new Transaction().add(ix);
const sig = await sendAndConfirm(connection, tx, [viewerWallet]);
```

### Memo / message ile tip

Opsiyonel: tip ile birlikte 32 char'lık mesaj. Memo program ile:

```typescript
const memoIx = new TransactionInstruction({
  keys: [],
  programId: MEMO_PROGRAM_ID,
  data: Buffer.from('GG iyi bug avı'),
});
```

## Game escrow

`programs/han/src/instructions/`:

```
create_game_room.rs
join_game.rs
settle_game.rs
cancel_game.rs
claim_refund.rs
close_room.rs
```

### PDA seed'leri

```rust
// Room metadata
seeds = [b"room", room_id.to_le_bytes().as_ref()]

// Vault (SOL holder)
seeds = [b"vault", room_id.to_le_bytes().as_ref()]
```

Room ID monotonic counter, hub tarafında üretilir.

### Account: GameRoom

```rust
#[account]
#[derive(InitSpace)]
pub struct GameRoom {
    pub id: u64,                    // 8
    pub host: Pubkey,               // 32
    pub game_type: [u8; 32],        // 32
    pub entry_fee: u64,             // 8
    pub max_players: u8,            // 1
    pub player_count: u8,           // 1
    pub players: [Pubkey; 8],       // 256 (max 8 oyuncu)
    pub status: u8,                 // 1
    pub winner: Option<Pubkey>,     // 33
    pub created_at: i64,            // 8
    pub bump: u8,                   // 1
}
```

### create_game_room

```rust
pub fn create_game_room(
    ctx: Context<CreateGameRoom>,
    room_id: u64,
    game_type: [u8; 32],
    entry_fee: u64,
    max_players: u8,
) -> Result<()> {
    let room = &mut ctx.accounts.room;
    room.id = room_id;
    room.host = ctx.accounts.host.key();
    room.game_type = game_type;
    room.entry_fee = entry_fee;
    room.max_players = max_players;
    room.player_count = 0;
    room.status = 1; // filling
    room.created_at = Clock::get()?.unix_timestamp;
    room.bump = ctx.bumps.room;
    
    emit!(GameRoomCreated { room_id, host: room.host, entry_fee });
    Ok(())
}
```

### join_game

```rust
pub fn join_game(ctx: Context<JoinGame>, room_id: u64) -> Result<()> {
    let room = &mut ctx.accounts.room;
    require!(room.status == 1, HanError::GameNotFilling);
    require!(room.player_count < room.max_players, HanError::RoomFull);
    
    if room.entry_fee > 0 {
        let cpi = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.player.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(cpi, room.entry_fee)?;
    }
    
    room.players[room.player_count as usize] = ctx.accounts.player.key();
    room.player_count += 1;
    
    if room.player_count >= room.max_players {
        room.status = 2; // ready
    }
    
    emit!(PlayerJoined { room_id, player: ctx.accounts.player.key() });
    Ok(())
}
```

### settle_game

```rust
pub fn settle_game(ctx: Context<SettleGame>, room_id: u64, winner: Pubkey) -> Result<()> {
    let room = &mut ctx.accounts.room;
    require!(room.status == 4, HanError::GameNotFinished);
    
    require!(
        ctx.accounts.authority.key() == HUB_AUTHORITY_PUBKEY,
        HanError::UnauthorizedSettler
    );
    
    require!(
        room.players[..room.player_count as usize].contains(&winner),
        HanError::InvalidWinner
    );
    
    // State update önce (reentrancy koruması)
    room.winner = Some(winner);
    room.status = 5; // settled
    
    let total_pot = room.entry_fee * room.player_count as u64;
    if total_pot > 0 {
        let vault_seeds = &[b"vault", &room_id.to_le_bytes(), &[ctx.bumps.vault]];
        let signer_seeds = &[&vault_seeds[..]];
        
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.winner_account.to_account_info(),
            },
            signer_seeds,
        );
        anchor_lang::system_program::transfer(cpi, total_pot)?;
    }
    
    emit!(GameSettled { room_id, winner, payout: total_pot });
    Ok(())
}
```

`HUB_AUTHORITY_PUBKEY`: hub'ın Privy delegated wallet'ının pubkey'i. V1'de hardcode, V2'de Config PDA.

### cancel_game

Filling state'inde, host iptal ederse veya timeout. Joined oyunculara refund için ayrı `claim_refund` instruction.

### claim_refund

Cancel sonrası her oyuncu kendisi çağırır, vault'tan kendi deposit'ini geri alır.

### timeout_refund (V1, kritik)

**Neden var:** Hub authority tek nokta hatası. Eğer hub çökerse veya kayboldu/cancel da etmediyse, oyuncuların ulaşamadığı bir vault kalır. Trustless garanti için bu instruction zorunlu.

**Sabit:** `pub const ROOM_TIMEOUT_SECONDS: i64 = 86400;` (24 saat)

**Davranış:** Room.created_at'tan 24 saat sonra, settled veya cancelled değilse, **herhangi bir oyuncu** kendi stake'ini çekebilir. Pot dağılmaz, herkes kendi entry_fee'sini alır.

```rust
pub fn timeout_refund(ctx: Context<TimeoutRefund>, room_id: u64) -> Result<()> {
    let room = &mut ctx.accounts.room;
    let player = ctx.accounts.player.key();
    let now = Clock::get()?.unix_timestamp;
    
    require!(room.status != 5 && room.status != 6, HanError::AlreadyResolved);
    require!(now - room.created_at >= ROOM_TIMEOUT_SECONDS, HanError::TimeoutNotReached);
    
    let player_idx = room.players[..room.player_count as usize]
        .iter()
        .position(|&p| p == player)
        .ok_or(HanError::NotAPlayer)?;
    
    require!(
        room.refund_claimed & (1 << player_idx) == 0,
        HanError::AlreadyRefunded
    );
    
    if room.entry_fee > 0 {
        let vault_seeds = &[b"vault", &room_id.to_le_bytes(), &[ctx.bumps.vault]];
        let signer_seeds = &[&vault_seeds[..]];
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.player.to_account_info(),
            },
            signer_seeds,
        );
        anchor_lang::system_program::transfer(cpi, room.entry_fee)?;
    }
    
    room.refund_claimed |= 1 << player_idx;
    
    let all_refunded = (1u8 << room.player_count) - 1;
    if room.refund_claimed == all_refunded {
        room.status = 7; // timed_out
    }
    
    emit!(TimeoutRefundClaimed { room_id, player });
    Ok(())
}
```

GameRoom struct'a iki ekleme:
- `refund_claimed: u8` bitmap (max 8 oyuncu)
- Status enum: `7 = timed_out`

ADR: `.claude/docs/decisions/2026-05-05-refund-timeout.md`

## Attestation

**Karar:** SAS (Solana Attestation Service) kullanılır. Custom Anchor attestation kapsam dışı.

ADR: `.claude/docs/decisions/2026-05-05-sas-vs-custom-pda.md`

`sas-lib` paketi kullanılır. Han'ın Anchor program'ında attestation kodu yok, hub authority off-chain imzalar.

### Setup (deployment, bir kez)

`scripts/setup-sas.ts` deployment'tan sonra çalıştırılır:

```typescript
import { 
  getCreateCredentialInstruction, 
  getCreateSchemaInstruction,
  deriveCredentialPda, 
  deriveSchemaPda 
} from 'sas-lib';

// 1. Han credential PDA yarat
const [credentialPda] = await deriveCredentialPda({
  authority: hubAuthority.publicKey,
  name: 'Han Game Results',
});

const credentialIx = await getCreateCredentialInstruction({
  payer: hubAuthority,
  authority: hubAuthority,
  credential: credentialPda,
  name: 'Han Game Results',
  signers: [hubAuthority.publicKey],
});

// 2. game_result schema yarat
const [schemaPda] = await deriveSchemaPda({
  credential: credentialPda,
  name: 'game_result',
  version: 1,
});

const schemaIx = await getCreateSchemaInstruction({
  payer: hubAuthority,
  authority: hubAuthority,
  credential: credentialPda,
  schema: schemaPda,
  name: 'game_result',
  description: 'Han game result attestation',
  fields: ['winner', 'game_type', 'score', 'player_count', 'room_id', 'timestamp'],
  // Layout: pubkey, string, u32, u8, u64, i64
});

// 3. PDA'ları .env'e yaz
console.log('SAS_CREDENTIAL_PDA=', credentialPda.toBase58());
console.log('SAS_SCHEMA_PDA=', schemaPda.toBase58());
```

### Per-game attestation

Hub `settle_game` instruction'ı başarılı olduktan sonra, attestation atılır:

```typescript
import { getCreateAttestationInstruction, deriveAttestationPda } from 'sas-lib';

async function attestGameResult(params: {
  roomId: bigint,
  winner: PublicKey,
  gameType: string,
  score: number,
  playerCount: number,
}) {
  const credentialPda = new PublicKey(process.env.SAS_CREDENTIAL_PDA!);
  const schemaPda = new PublicKey(process.env.SAS_SCHEMA_PDA!);
  
  const [attestationPda] = await deriveAttestationPda({
    credential: credentialPda,
    schema: schemaPda,
    nonce: params.roomId.toString(),
  });
  
  const ix = await getCreateAttestationInstruction({
    payer: hubAuthority,
    authority: hubAuthority,
    credential: credentialPda,
    schema: schemaPda,
    attestation: attestationPda,
    nonce: params.roomId.toString(),
    expiry: 0,
    data: serializeAttestationData({
      winner: params.winner,
      game_type: params.gameType,
      score: params.score,
      player_count: params.playerCount,
      room_id: Number(params.roomId),
      timestamp: Math.floor(Date.now() / 1000),
    }),
  });
  
  return await sendAndConfirm(connection, new Transaction().add(ix), [hubAuthority]);
}
```

### Schema spec (kesin)

```
schema: game_result
version: 1
fields:
  - winner: Pubkey
  - game_type: string (max 32 char)
  - score: u32
  - player_count: u8
  - room_id: u64
  - timestamp: i64
```

Schema değişirse yeni version yarat, eskiyi koru. Migration ADR ile.

### Doğrulama

Bir attestation'ı parse etmek:

```typescript
import { fetchAttestation } from 'sas-lib';

const attestation = await fetchAttestation(connection, attestationPda);
console.log('Authority:', attestation.authority.toBase58()); // hub authority olmalı
console.log('Schema:', attestation.schema.toBase58()); // game_result schema
console.log('Data:', attestation.data); // parsed fields
```

Solana Explorer'da `https://explorer.solana.com/address/<attestationPda>?cluster=devnet` direkt görüntülenebilir, SAS built-in viewer ile.

## Pubkey'ler ve env

```
.env (production'da KMS):

# Han program
HAN_PROGRAM_ID=<deploy sonrası>
HUB_AUTHORITY_KEYPAIR=<base58 encoded>

# SAS (setup-sas.ts sonrası)
SAS_CREDENTIAL_PDA=<setup sonrası>
SAS_SCHEMA_PDA=<setup sonrası>

# RPC (multi-endpoint failover)
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
HELIUS_API_KEY=<demo öncesi al, ücretsiz tier yeterli>
HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}

# Sabitler
ROOM_TIMEOUT_SECONDS=86400
```

ADR: `.claude/docs/decisions/2026-05-05-rpc-fallback.md`

## Test stratejisi

### Anchor test

- Happy path: create → join → settle, doğru payout
- Cancel: create → cancel → claim_refund
- Edge: room dolu, fee mismatch, unauthorized settle
- Reentrancy: settle sırasında double-call attempt

### Integration

- Hub'tan create_game_room API çağrısı, anchor program'a doğru iletim
- Privy ile authority signing
- Devnet veya solana-test-validator

### E2E

- İki gerçek client (host + joiner)
- Han hub local
- Anchor program local validator
- Pong oynanır, kazanan attestation TX'i devnet explorer'da görünür
