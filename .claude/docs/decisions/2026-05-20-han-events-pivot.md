# ADR 2026-05-20 — Han for Events: B2B layer'i B2C üstüne ekle

## Status

Accepted, 2026-05-20.

## Context

19 Mayıs 2026'da Fuji testnet'e Avalanche port deploy edildi, uçtan uca proof tamamlandı:
- `Han.sol` + `HanTipRouter.sol` Fuji'de canlı
- Tip flow %3 fee split + game escrow create/join/settle Snowtrace'te doğrulandı
- Hub backend port 3001'de ayakta, runtime streamer hub'a uçtan uca bağlandı

Aynı gün kullanıcı yeni bir yön getirdi: B2B + B2C ikili pazar yönelimi. Figma deck (`VhDHQJG33eRrXZz2BZBjFL`, 13 slide) "Han for Events" vizyonunu çiziyor — hackathon, workshop ve uzun vadeli ekosistem programları için terminal-native event platformu.

Slogan: *"We run the event. The build corpus and the builder graph stay yours."*

Üç rol: organizer (`han events create`, web dashboard), judge/mentor (`han watch --event x`, CLI mosaic), instructor (`han workshop start`, split mode).

Üç paket: workshop $1.2k/event (wedge), hackathon $12k/event (SWEET SPOT), ecosystem partner $80k+/yr (recurring). Ek paket: Build Corpus Report $9k+/report (existing event'e plug-in).

İki asset (deck slide 10): **build corpus** (PTY + commits + AI summaries anchored, DX audit) + **verified builder graph** (on-chain proof-of-work, recruiting/grant pipeline).

## Decision

Han B2C üstüne **event layer** ekleyerek B2B'ye genişletilir. ADR `2026-05-13-indie-product-pivot` geçerliliğini korur — B2C indie ürün sunset edilmez. 4 ana karar verildi:

### 1. Mimari yaklaşım: katmanlı, paralel değil

Deck slide 04'ün gösterdiği: B2B = "yeni ürün" değil, B2C'nin üstüne event layer. Yani:
- **Tek hub binary** (event-tenant, multi-tenant değil)
- **Tek runtime CLI** (subcommand genişletme)
- **Tek schema** (Event/Team/Role tabloları + mevcutlara nullable `eventId`/`teamId` FK)
- **Tek chain hattı** (AVAX, Fuji V1, mainnet V2)

Wallet auth korunur (builder, tip). Web dashboard için SSO ek katman (organizer/judge).

### 2. Chain: her şey AVAX'ta kalır

Deck'in Solana referansları (slide 01 "Solana Frontier", slide 12 "USDC/SOL", slide 13 "npm i -g cli-han") **marketing içerik refresh** ile AVAX'a güncellenir. Repo bugün Fuji'de canlı, port commit `3e71522` baseline. B2B ürün Avalanche C-Chain üstünde.

Deck slide 03'teki "peer-to-peer tips, devnet today, mainnet sponsor & sub on roadmap" mesajı korunur — tip native AVAX, %3 fee `HanTipRouter` aynen.

### 3. Paket modeli

| Tier | Fiyat | Hedef | Kapsam |
|---|---|---|---|
| tier 1 · workshop | $1.2k/event | bootcamp, educator, internal team | 1 instructor + 50 student, 8h, replay, 1 accent + logo |
| tier 2 · hackathon (SWEET SPOT) | $12k/event | foundation, ecosystem team, dev tool | unlimited teams, 7d, jury, branded subdomain, mosaic, on-chain archive |
| tier 3 · ecosystem partner | $80k+/yr | chain foundation, long-term program | multi-event, DX intel cross-event, builder graph access, white-label CLI, game SDK |
| add-on · Build Corpus Report | $9k+/report | existing event organizer | instrument event with han → DX rapor (PDF + dashboard) |

### 4. Sprint öncelikleri

Sprint sıralaması kullanıcı kararı (2026-05-20): **Build Corpus Report birinci** çünkü tam paketleme gerek yok, mevcut event'e plug-in, en hızlı revenue validation.

| Sprint | Hedef | Süre |
|---|---|---|
| 0 | ADR + küçük borç temizliği (stream_end handler, hub env kalıcı) | 1-2g |
| 1 | Build Corpus Report MVP (Event/Submission schema, corpus.ts, analyzer, PDF, runtime `--event` flag) | 2-3g |
| 2 | Events schema full (EventMember/Team/TeamMember/HelpSignal/EventBranding) + organizer/team CRUD + SSO | 3-4g |
| 3 | Runtime CLI: `events`, `workshop`, `watch --event` subcommand'leri | 3-4g |
| 4 | Judge mosaic UI + workshop split UI + WS handler'ları | 4-5g |
| 5 | Web (`apps/web/` Next.js + shadcn/ui) branded event hall | 4-6g |
| 6 | `HanEventAnchor.sol` + submission anchor + builder attestation | 3-5g |
| 7 | Stripe + paket faturalama | 3-4g |
| 8 | Corpus cloud storage + DX intelligence dashboard | sürekli |

## Consequences

**Pozitif**:
- B2C terkedilmez, indie wedge korunur — solo geliştirici tip flow'u kullanmaya devam
- B2B aynı motor üstünde — tek schema, tek CLI, tek hub. Mimari basitleşir
- Build Corpus Report wedge'i $9k pilot ile revenue validation çok hızlı
- Brand foundation (renkler ink/ash/smoke/cream/ember/teal/amber, JetBrains Mono + Inter) deck slide 02-03 zaten hazır
- On-chain anchor pattern AVAX'ta — mevcut Foundry projesi + 32 yeşil test üstüne inşa

**Negatif**:
- Schema delta (event + team + role tabloları) B2C migration regresyonu gerektirir
- Web frontend sıfırdan — `apps/web/` paketi yeni, Next.js öğrenme/scaffold maliyeti
- Marketing içeriği (deck) Solana → AVAX güncellemesi gerek — Figma deck'te elle değişim
- Tier 3 ecosystem partner cross-event aggregation Sprint 8'e ertelenir, ilk müşteriye satılamayabilir
- Builder graph attestation on-chain pattern V1.5'e taşınır (ADR `2026-05-18-attestation-strategy` event log V1 yeterli demişti, deck "verified" görsel önemli ise V1.5 zorunlu)

**Risk mitigasyonu**:
- Sprint 1 sonu pilot $9k Build Corpus Report ile gerçek müşteri feedback'i
- B2C smoke test Sprint 1 sonunda regresyon kontrolü (eventId null session = mevcut akış)
- Hub backend bugün canlı (PID 56686, port 3001) — Sprint 1 boyunca aynı binary, sadece yeni route'lar

## Alternatives considered

- **Multi-tenant org/team hierarchisi** (önceki plan iterasyonunda hipotez 1): Organization/Team/Member kavramları enterprise SaaS'ında doğru ama hackathon/workshop domain'inde fazla. Event-tenant daha basit, deck'in mental modeline daha yakın
- **Solana'ya geri dön**: deck Solana referansı veriyor ama Fuji deploy bugün canlı, smoke test yeşil. Marketing tarafından refresh, kontrat tarafından AVAX'ta kalmak daha az maliyet
- **B2C sunset, sadece B2B**: tip flow ve oyun escrow zaten Fuji'de canlı — atmak israf. Paralel yaşaması motor paylaşımı için ideal
- **Web yerine TUI-only**: organizer'a sales motion için web kritik (slide 08 branded hall). TUI-only deck vizyonunu inkâr eder
- **Workshop önce, hackathon sonra** (deck wedge'i): wedge mantıklı ama kullanıcı $9k Build Corpus Report'u tercih etti — workshop bile değil, instrument-only

## Implementation impact

| Doküman / kod | Değişiklik |
|---|---|
| `CLAUDE.md` | "Indie product" tek mod → ikili: B2C indie + B2B events. Subagent listesine `web-engineer` (yeni) eklenir |
| `README.md` | Roadmap bölümü Sprint 0-8 ile güncellenir |
| `apps/hub/prisma/schema.prisma` | Sprint 1'de minimum delta (Event + Submission + Session.eventId), Sprint 2'de full |
| `apps/runtime/package.json` | npm publish adı `cli-han` kararı (workspace adı `@han/runtime` kalır, publishConfig'te alias) — Sprint 0'da not, gerçek rename V1 ship öncesi |
| `apps/web/` | yeni paket, Sprint 5'te scaffold |
| `contracts/src/HanEventAnchor.sol` | yeni, Sprint 6 |
| `.claude/docs/architecture.md` | event layer eklenir, mosaic + workshop akışları çizilir |

## Referanslar

- Plan dosyası: `~/.claude/plans/benim-akl-ma-yeni-bi-nifty-metcalfe.md`
- Önceki ADR: `2026-05-13-indie-product-pivot` (B2C indie modu, hala geçerli)
- Avalanche port: `2026-05-18-solana-to-avax-port`
- Attestation: `2026-05-18-attestation-strategy` (event anchor için bu V1.5'e çekildi)
- Fuji deploy commit: `3e71522`, kontrat adresleri `.env` ve `CLAUDE.md` Fuji bilgileri
- Figma deck: `VhDHQJG33eRrXZz2BZBjFL` (13 slide, Han for Events)
