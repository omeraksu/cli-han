# ADR 2026-05-13 — Indie product pivot, Fuji testnet odaklı V1

## Status

Accepted, 2026-05-13.

## Context

Solana Frontier Hackathon süresi 12 Mayıs 2026'da kapandı. Han submission olarak teslim edildi (Fuji testnet program `D7pgqFkNXvHPGocEknUgKHrGjwtNZfsQBQ6ey9xXYXfD` canlı, repo public, 14 commit). Submission'dan sonra geliştirici niyet açıkladı:

> "Hackathon modunda değiliz onun süresi geçti. Ben bunu ürün yapmak istiyorum."

Sonra modu netleştirdi:

- **Mod**: solo indie, gelir hedefli (start-up değil, side project değil)
- **Birincil gelir**: tip komisyonu %3 (V1), premium abonelik V2 yedek
- **Cluster hedefi**: Fuji testnet'te kalmaya devam, mainnet ileride (V2 sonrası)
- **Demo niyeti**: yavaş ama somut, "demo edebilmek" öncelikli, lansman aceleci değil

Bu, hackathon planından farklı bir frame. Aşağıdaki kararlar buna göre revize edilir.

## Decision

Han bir **indie ürün** olarak devam eder. Aşağıdaki 5 ana karar verildi:

### 1. Cluster

Fuji testnet'te kalır. Mainnet hedefi yok V1 + V1.5 boyunca. Faucet maliyeti yok, gerçek SOL riski yok, demo amaçlı yeterli. Mainnet kararı V2 öncesi yeniden değerlendirilir (kullanıcı kararı).

### 2. Gelir modeli

**V1**: tip komisyonu %3, program-less iki transfer tek TX (detay: ADR `2026-05-13-tip-fee-architecture`).

**V2**: premium abonelik $9/ay. Custom branding, replay, summarizer'da kendi modeli, custom slash commands.

**Tournament mode**: V1.5'te. Pong + Type Race pot'undan rake %2.

### 3. V1 scope

Dahil:
- Streamer mode + zengin status bar overlay (Figma 01, 02, A)
- Viewer mode split pane (mevcut)
- Lobby gerçek hub veriyle
- Chat (rate limited)
- **Tip flow** — Fuji testnet SOL transferi, %3 hub komisyonu
- Solo Roulette (mevcut)
- Profile sayfası 5 ekran
- Privacy filter (default ON)
- Wallet: local keypair V1
- Self-hosting (open core)
- Fuji testnet üzerinden demo akışı

Dahil değil (V1.5+):
- Pong + Type Race engine (V1.5)
- SAS attestation (V1.5)
- Summarizer AI pipeline (V1.5 — V1'de raw mode + basit headline yeterli)
- Premium abonelik (V2)
- local hex private key (V2)
- Mainnet deploy (V2 sonrası)

### 4. Zaman planı

4-sprint × 1 hafta:

| Sprint | Hedef |
|---|---|
| 1 — Hub canlı | Redis + Postgres lokal, e2e raw stream + chat |
| 2 — Tip + Streamer overlay | Fuji testnet'te %3 komisyonlu tip, yayıncı UI overlay |
| 3 — Profile + Onboarding | 5 Profile ekranı, first-time wizard, lobby polish |
| 4 — Polish + ilk demo | Bug fix, dokümantasyon, ilk 5 beta tester davet, demo video |

Mainnet sprint'i V2'ye taşındı. Sprint 4 "Fuji testnet polish + demo" odaklı.

### 5. Geliştirme prensipleri

Hackathon'dan devam:
1. Plan mode disiplini
2. Subagent delegation
3. Türkçe-first iletişim
4. Privacy & speed first
5. Conventional commits her yeşil adımda
6. Don't add what task doesn't need
7. ADR for divergence
8. No half-finished implementations

İndie modu için yeni:
9. Test coverage min %60
10. Backwards compatibility (semver)
11. User-facing metrik
12. Customer support (Discord/Telegram <24h)
13. Cost-conscious (<$50/ay altyapı V1)
14. Build in public

## Consequences

**Pozitif**:
- Mainnet ertelenince hem teknik (audit, fee, multisig) hem hukuki yük (ToS, vergi) gecikiyor → solo dev için sürdürülebilir
- Fuji testnet'te kalmak iterasyon hızını koruyor (deploy ücretsiz, faucet bedava)
- Indie modu net olarak tanımlanınca scope kararları (Pong/Type Race V1.5, Summarizer V1.5) doğal akıyor
- Hackathon foundation (Solidity contract, 12 Figma ekranı, agentic yapı) tam değerlendiriliyor

**Negatif**:
- Fuji testnet'te "gerçek para" yok → kullanıcı testinde davranış farkı (kayıp riski yok, ciddiyet düşük)
- Tip komisyonu Fuji testnet'te gelir üretmez (validation testi sadece)
- Mainnet ertelenince "ne zaman gerçek?" sorusu açık kalır

**Risk mitigasyonu**:
- Fuji testnet pilot 4-6 hafta, kullanıcı feedback'iyle mainnet kararı netleşir
- ToS + privacy policy V1'de yazılır (Fuji testnet bile olsa hukuki disipline alışmak)

## Alternatives considered

- **Tam mainnet V1**: ADR `2026-05-13`'in başında düşünüldü, kullanıcı Fuji testnet tercih etti
- **Mainnet + Fuji testnet ikili dağıtım**: çok karmaşık V1 için, sürdürülemez
- **Start-up modu (fundraise + takım)**: kullanıcı solo indie tercih etti
- **Open source side project**: gelir hedefi kullanıcının niyeti, monetize edilebilir indie tercih edildi

## Implementation impact

| Doküman / kod | Değişiklik |
|---|---|
| `CLAUDE.md` | "Solana Frontier Hackathon submission" → "Indie product, Fuji testnet". V1 scope güncellemesi. |
| `README.md` | "Roadmap" bölümü, "Self-host" bölümü Sprint 4'te |
| `HAN_HANDOFF.md` | "Sprint durumu" başlığı, haftalık güncellenir |
| `2026-05-12-game-decoupled-ui.md` | Revision 2 eklendi (V1.1 → V1.5) |
| `.claude/plans/...` | Plan dosyası bu pivot'ı yansıtır |

## Referanslar

- Önceki plan: `.claude/plans/neden-commit-yok-commit-prancy-crab.md`
- Tip mimarisi: ADR `2026-05-13-tip-fee-architecture`
- Game UI ADR: `2026-05-12-game-decoupled-ui` (Revision 2)
- Hackathon submission state: 12 Mayıs 2026, commit `b73fe24`
