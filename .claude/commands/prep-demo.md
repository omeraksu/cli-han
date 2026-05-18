---
description: Hackathon teslim haftası, demo paketi hazırla
---

**demo-master** agent'ını çağır.

Sırayla şunu hazırla:

1. Demo script (2-3 dakika), `.claude/docs/demo-script.md`
2. Submission form alanları, `.claude/docs/submission-fields.md`
3. Pitch deck taslağı, `.claude/docs/pitch-deck-outline.md`
4. Demo videosu script'i, `.claude/docs/video-script.md`
5. README hero güncellemesi (öneri olarak)

**qa-engineer**'dan demo flow'unun çalıştığını doğrulat. Kırık feature varsa rapor et, demo'ya alma.

Demo akışında olması gerekenler:

- Han stream başlatma (`han stream`)
- İzleyici bağlanma (`han connect <kod>`)
- Broadcast feed gösterimi (özet kartları akıyor)
- `/raw` mod ile ham terminal'e geçiş
- İki izleyicinin Pong odası açıp oynaması
- Stake yatırma, kazanan settlement
- Tip atma akışı
- Devnet explorer'da TX doğrulaması

Eğer feature kırıksa **debug-specialist**'i çağır, hızlı düzelt veya demo'dan çıkar.

Çıktı:
- Tüm dosyaları yarat
- Eksik veya kırık feature listesi
- Tahmini hazırlık süresi (eksikleri kapatmak için)
