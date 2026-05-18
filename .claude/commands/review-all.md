---
description: Tüm katmanlarda review yaptır, ship öncesi son kontrol
---

Sırayla:

1. **runtime-engineer**'a kendi kodunu review ettir, edge case kontrolleri
2. **hub-engineer**'a backend güvenlik ve rate limit kontrolü
3. **summarizer-engineer**'a pipeline maliyet ve fallback doğrulaması
4. **game-engineer**'a state machine determinism testi
5. **anchor-engineer**'a Rust kodunu denetlemesini yaptır, CU ölçümü
6. **solana-client-engineer**'a SDK API'sini denetlemesi
7. **ui-designer**'a accessibility checklist'i
8. **qa-engineer**'a full review
9. **demo-master**'a "bu jüri için yeterli mi" değerlendirmesi

Çıktıyı tek bir karar olarak özetle:

- ship-ready: tüm review'lardan geçti
- revizyon gerekli: küçük eksikler var, listele
- kritik blocker: ship etme, neden ve nasıl çözüleceği

Karar ship-ready ise **qa-engineer** annotated tag atar:

```bash
git tag -a v0.<minor>.0 -m "ship: <feature özeti>"
git push --tags
```

Tag formatı semver, v0.x.0 her demo-hazır milestone için, v0.x.y patch için.

Eğer kritik blocker varsa **architect**'i çağır, planın tekrar gözden geçir.
