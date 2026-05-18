---
description: Yayıncı→hub→izleyici akışını uçtan uca test et
---

End-to-end stream akış testi. Demo öncesi mutlaka koşturulur.

Adımlar:

1. **Hub başlat**: `pnpm --filter hub dev` (yeni terminal)
2. **Hub healthcheck**: `curl http://localhost:3000/health` → 200 OK
3. **Yayıncı başlat**: `pnpm --filter runtime dev:streamer` (yeni terminal)
4. Yayıncı terminalde basit bir komut çalıştır (`echo hello`, `ls`)
5. **İzleyici başlat**: `pnpm --filter runtime dev:viewer` (yeni terminal)
6. İzleyici `/lobby` ile aktif yayını gör, bağlan
7. **Default mode kontrolü**: izleyici broadcast feed görüyor mu (özet kartları)
8. **Raw mode kontrolü**: izleyici `/raw` ile ham output'u görüyor mu
9. **Chat kontrolü**: izleyici chat'e mesaj at, yayıncı görsün
10. **Game odası**: izleyici `/play pong` ile oda aç, başka izleyici eşleşse (test için ikinci izleyici client)
11. **Solana flow**: oyun bitince settle TX Fuji testnet explorer'da görünüyor mu

Bir adım kırılırsa hangisi olduğu rapor et, **debug-specialist**'e delegate et.

Başarılıysa "stream pipeline yeşil, demo'ya hazır" raporu.

Notlar:
- Test için Anchor program Fuji testnet'e deploy edilmiş olmalı (`/deploy-Fuji testnet` ile önce)
- Fuji testnet wallet'ında en az 0.1 SOL olmalı (test stake için)
- İkinci izleyici client'ı için ek terminal pencere lazım
