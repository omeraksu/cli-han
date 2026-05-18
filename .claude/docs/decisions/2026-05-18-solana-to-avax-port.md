# 2026-05-18, Solana to Avalanche C-Chain Port

## Status

Accepted, 2026-05-18.

## Context

Han V1 Solana devnet üzerinde canlı ürün olarak ship edildi (~3.3K LOC, 7 Anchor instruction, program-less tip, SAS attestation stratejisi). Kullanıcı ürünü Avalanche C-Chain için ayrı bir klasör (`/https/han-avax`) olarak port etmek istedi.

Hedefler:
- Mevcut Solana repo'su dokunulmaz (V1 production)
- Yeni klasör temiz git history ile başlar
- ~%80 kod (UI, hub fanout, PTY runtime, summarizer pipeline, ink layer) zincir-agnostik, aynen taşınır
- Zincir-spesifik katman (`programs/`, `sdk/`, `apps/hub/solana/`) baştan yazılır

## Decision

**`/Users/omeraksu/https/han-avax`** ayrı repo, kararlar:

- **Chain**: Avalanche C-Chain. Fuji testnet (chain ID 43113) → mainnet (43114) sonra.
- **Contract toolchain**: Foundry + Solidity 0.8.26 + OpenZeppelin v5
- **Client toolchain**: viem 2.21+ (TypeScript-first, lightweight)
- **Token**: native AVAX (V1 stable/USDC desteği yok)
- **Tip atomicity**: `HanTipRouter.sol` minimum contract (~40 satır), tek imza
- **Game escrow**: `Han.sol` 8 fonksiyon, Anchor instruction'larıyla 1:1 mapping

### Solana → Solidity mapping

| Solana | Solidity |
|---|---|
| Anchor program (7 instructions) | `Han.sol` (8 fonksiyon) |
| PDA `seeds = [b"room", room_id]` | `mapping(uint256 => GameRoom) _rooms` |
| PDA `seeds = [b"vault", room_id]` | kontrat balance + per-room state tracking |
| PDA `seeds = [b"config"]` | singleton storage (kontratın kendisi) |
| `bump` storage | yok |
| `room.refund_claimed: u8` bitmap | aynı uint8 bitmap |
| `#[error_code]` enum | `error HanErrors.GameNotFilling()` library |
| `emit!` events | `event GameSettled(...)` Solidity |
| SystemProgram::transfer × 2 (program-less tip) | `HanTipRouter.tip(streamer)` payable |
| SAS attestation | `GameSettled` event log (V1), EAS V2'de |

### Type mapping (SDK)

| Solana | viem |
|---|---|
| `PublicKey` | `Address` (`0x${string}`) |
| `Keypair` | `PrivateKeyAccount` |
| `Connection` | `PublicClient` |
| `AnchorProvider` | `WalletClient` |
| `Program<Idl>` | `getContract({ abi, address, client })` |
| `BN` (lamports u64) | `bigint` (wei) |
| `LAMPORTS_PER_SOL = 1e9` | `parseEther('1') = 1e18` |
| `FailoverConnection` | viem `fallback` transport |
| `findProgramAddressSync` | yok (PDA yok) |

## Bootstrap stratejisi

```bash
cp -R /Users/omeraksu/https/han /Users/omeraksu/https/han-avax
cd /Users/omeraksu/https/han-avax
rm -rf .git target node_modules pnpm-lock.yaml
git init
git commit -m "chore: import han solana baseline for avax port"
```

Selective copy hafta kaybettirir. Full copy + targeted cleanup, sonra zincir katmanını yeniden yazmak en hızlı yol.

### Silinen Solana spesifik

- `programs/`, `Anchor.toml`, `Cargo.*`, `target/`
- `sdk/idl/han.json`
- `scripts/setup-sas.ts`
- `.claude/docs/decisions/2026-05-05-sas-vs-custom-pda.md`
- `.claude/agents/anchor-engineer.md`, `solana-client-engineer.md`
- `.claude/commands/deploy-devnet.md`, `solana-flow-test.md`
- `.claude/skills/han-solana-economy/`

### Eklenen

- `contracts/` (Foundry project, Han.sol + HanTipRouter.sol + 32 test)
- `sdk/abi/` (forge inspect çıktıları)
- `sdk/src/chain.ts`, `sdk/src/abi.ts`
- `sdk/src/wallet/local-account.ts` (loadLocalAccount, generatePrivateKey)
- `.claude/agents/contract-engineer.md`, `evm-client-engineer.md`
- `.claude/commands/deploy-fuji.md`, `avax-flow-test.md`
- `.claude/skills/han-avax-economy/`
- ADR `2026-05-18-attestation-strategy.md`

### Replace edilen (Solana → AVAX terminology)

- Tüm diğer agent dosyaları, skills, ADRs, slash commands

## Sınırlamalar

- `tweetnacl`/`bs58` (ed25519) yerine viem `verifyMessage` (EIP-191 secp256k1)
- Wallet file formatı `[byte[]]` (Solana keypair) → `{ "privateKey": "0x..." }`
- Prisma `lamports BIGINT` → `amountWei Decimal(78, 0)` (uint256 sığar)
- Hub session ID prefix `streamerWallet.slice(0, 4)` (base58) → `streamerWallet.slice(2, 6)` (0x prefix sonrası)

## Sonuç

V1 Fuji ship'i için 6-8 mühendislik günü tahmini (kritik path 4 gün). Mevcut UI, hub fanout, summarizer pipeline değişmeden çalışıyor. Yeni mimari aynı ekonomik garantileri sağlıyor (tip atomik, %3 fee, 24h timeout refund), bonus olarak game settlement %100 on-chain (Solana'da V1.5'e ertelenmişti).
