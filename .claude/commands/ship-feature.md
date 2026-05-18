---
description: Plan onaylandıktan sonra feature'ı sırayla teslim et
argument-hint: <plan dosyası veya feature adı>
---

Plan: $ARGUMENTS

Plan'da belirlenen adımları sırayla takip et. Her agent kendi paketini yeşil bitirir bitirmez Conventional Commit atar. Sıradaki agent temiz tree'de başlar. Tipik akış:

1. **anchor-engineer** programs/ değişikliklerini yapar (varsa) → `anchor build` yeşilse `feat(programs): ...` veya `chore(programs): ...` commit
2. **solana-client-engineer** SDK güncellemesini yapar (varsa) → SDK build + test yeşilse `feat(sdk): ...` commit
3. **hub-engineer** backend logic'i ekler → hub build + test yeşilse `feat(hub): ...` commit
4. **summarizer-engineer** pipeline değişikliği yapar (varsa) → synthetic stream test yeşilse `feat(summarizer): ...` commit
5. **game-engineer** oyun değişikliği yapar (varsa) → state machine test yeşilse `feat(games): ...` commit
6. **runtime-engineer** runtime tarafını ekler → runtime build + test yeşilse `feat(runtime): ...` commit
7. **ui-designer** UI component'lerini yazar → render test yeşilse `feat(ui): ...` commit
8. **qa-engineer** test ve review yapar → testler yeşilse `test(<scope>): ...` commit (gerekirse)
9. Tüm testler çalıştırılır
10. **qa-engineer** final ship: `chore(release): ship <feature>` commit ve `git push`

Her adımdan sonra çıktıyı özetle ve commit hash'ini raporla. Bir adım kırılırsa **debug-specialist**'e ver, fix yeşilse `fix(<scope>): ...` commit. Tüm adımlar tamamlandığında **qa-engineer**'a final review yaptır.

**Kurallar:**
- Commit mesajı İngilizce, scope listesi `han-conventions` SKILL.md
- Asla `.env`, keypair, secret commit'leme
- Bir adımda hiçbir dosya değişmediyse commit yok, sıradaki agent'a geç
- Bağımlılıklar plan'ın "Bağımlılıklar" bölümünde, sıra ona göre
