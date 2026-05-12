# First-User Experience (FUE) Test Rehberi

> Sprint 3.7 — 5 dev'i Han'ı denemeye davet et, ilk 60 saniyede takıldıkları yerleri kaydet.

## Hedef

İlk yayını **60 saniyede** açabilen bir kullanıcı oranı **%80+** olsun. Bu eşik altına düşersek onboarding'i revize ederiz (Sprint 4'te).

## Aday roster (10-12 isim, 5'ten en az ilki cevap versin)

| Kaynak | Aday | Neden |
|---|---|---|
| Kozalak hub | @kerem | Solana dev, kozalak'ın çekirdek üyesi |
| Kozalak hub | @hursel | Backend, Anchor deneyimi |
| Twitter network | @ahmettr | Claude Code aktif kullanıcısı |
| Twitter network | @selinr | Indie hacker, Türk dev community |
| Türk Solana discord | (3-5 isim) | Solana ekosisteminden, henüz kişiselleştirilmedi |
| Kişisel ağ | omeraksu'nun 2-3 yakın arkadaş | Empati + hızlı feedback |

İlk hafta 6 davet → en az 4 cevap → 2-3 gerçek dene + feedback bekle.

## Davet mesaj şablonu (DM / Discord)

> selam @<handle>,
>
> Han v0.1 devnet'te canlı 🎉 ilk birkaç kişiyi davet ediyorum, 5 dakikalık denesen çok değerli olur.
>
> şu:
> 1) terminal'de yayın aç (`han stream` ile)
> 2) ben bağlanıp sana 0.005 devnet SOL tip atayım
> 3) sonra bana 1-2 dk şu üçünü söyle:
>    - kurulum hangi adımda zorladı?
>    - lobby/chat/tip/Roulette/Profile hangisi şaşırttı?
>    - ne eklesem 1 hafta içinde tekrar açarsın?
>
> repo: https://github.com/omeraksu/cli-han  (5dk kurulum, README'de adımlar)
> feedback formu: https://forms.gle/... (5 soru, 2dk)
>
> teşekkürler!
> omar

## Feedback formu (Google Forms veya benzeri)

5 soru, hepsi opsiyonel, 2 dk:

1. **Kurulumdan ilk yayını açana kadar geçen süre**: <30sn / <2dk / 2-5dk / 5dk+ / yapamadım
2. **En çok takıldığın yer**: brew/postgres/redis · pnpm install · anchor / migration · wizard · stream başlatma · diğer (yaz)
3. **Hangi ekran şaşırttı veya hoşa gitti**: lobby · viewer split pane · chat · /tip dialog · /play roulette · /profile · /settings
4. **Han'ı tekrar açar mıydın 1 hafta içinde**: evet · belki · hayır → neden?
5. **Eklenmeli (1 cümle)**: ___

Form linki: https://forms.gle/<TBD> (kullanıcı tarafından yaratılacak)

## Discord/Telegram

İlk 20 kullanıcıya hızlı destek için bir kanal lazım. Pragmatik:

- **Discord**: kozalak hub'da `#han` private channel (ilk 6-12 hafta)
- **Telegram**: ayrı grup, başlangıçta kapalı davet

Bu rehberde sadece roster + mesaj şablonu var; gerçek Discord/Telegram kurulumu V1.1'de (Sprint 4 sonrası).

## Gözlem checklist (test sırasında)

| Adım | Beklenen | Gerçek |
|---|---|---|
| `brew install redis postgresql@14` | <2dk | __ |
| `pnpm install && pnpm -r build` | <90sn | __ |
| `prisma migrate dev` | <10sn | __ |
| `han stream` ilk açılış | <15sn (wizard dahil) | __ |
| Wizard handle + bio submit | <10sn | __ |
| Status bar görünür | hemen | __ |
| Viewer `han browse` lobby görünür | <2sn | __ |
| Connect ile split pane | <1sn | __ |
| `/tip 0.005` → 'sent' | <8sn (devnet RPC) | __ |
| `/play` → Roulette | hemen | __ |
| `/profile me` → ViewSelf | hemen | __ |

## Bilinen sınırlar (kullanıcıya önceden söyle)

- **devnet only** — gerçek para yok, faucet'ten airdrop alabilirler
- **Pong + Type Race yok** (V1.5)
- **Summarizer AI yok** — broadcast feed boş, raw mode tam çalışır
- **Profile stats mock** — gerçek backend Sprint 4 sonrası
- **Helius RPC opsiyonel** — default public devnet RPC yeterli

## Feedback haftalık özet

Her Pazartesi:
- Form cevaplarını topla
- En yaygın blocker'ı listele
- Sprint planına 1-2 P0 fix ekle (eğer varsa)

İlk 6 hafta boyunca her Pazartesi 30 dk: feedback review + sprint planlama.
