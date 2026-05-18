# System Prompt Güncelleme Rehberi

Bu repo'daki tüm subagent'ların ve skill'lerin sistem prompt'ları sıradan markdown dosyaları. Direkt edit edersin, Claude Code restart sonrası yeni prompt aktif. Bu dosya sık karşılaşılan güncellemeleri ve dikkat edilmesi gerekenleri içerir.

## Dosya konumları

```
.claude/agents/<isim>.md       Subagent davranışı
.claude/skills/<isim>/SKILL.md Sabit bilgi (proje skill'i)
.claude/commands/<isim>.md     Slash command
.claude/settings.json          Model, izin, env
.claude/hooks/*.json           Tool öncesi/sonrası kurallar
CLAUDE.md                      Proje genel referansı
```

## Sık güncellemeler

### Bir agent'a yeni bir kural eklemek

Örnek: runtime-engineer'a "Windows compatibility kontrolü" eklemek istiyorsun.

Dosyayı aç: `.claude/agents/runtime-engineer.md`

Mevcut bir bölüme ekle veya yeni bölüm aç:

```markdown
## Çapraz platform

Yeni özellik eklerken Windows uyumluluğunu kontrol edersin. node-pty Windows'ta ConPTY kullanır (1809+), Linux/macOS'ta forkpty. Path separator'ları `path.join` ile, asla manuel string concat. CRLF/LF farkı için stream parsing dikkatli.
```

Kaydet, Claude Code restart, agent yeni kuralı uygular.

### Bir agent'tan tool kaldırmak

Örnek: ui-designer'ın internet erişimine ihtiyacı yok, `WebFetch` zaten yok ama gibi bir senaryo.

Dosyada YAML frontmatter'ı düzenle:

```yaml
tools: Read, Write, Edit, Grep, Glob, Bash
```

### Bir agent'ın model'ini değiştirmek

Örnek: demo-master için Sonnet yeterli, Opus yerine.

```yaml
model: claude-sonnet-4-6
# claude-opus-4-7 yerine
```

Kritik agent'lar (architect, anchor-engineer, runtime-engineer) Opus'ta kalmak güvenli. Lighter işler için Sonnet (demo-master, qa-engineer) veya Haiku (debug-specialist hızlı triage).

### Bir skill'i güncellemek

Örnek: `han-game-protocol`'a yeni bir oyun spec'i eklendi.

`.claude/skills/han-game-protocol/SKILL.md` dosyasını aç, yeni oyunu ekle. Server tick logic, client render, win condition. State type definition.

Bu skill'i kullanan tüm agent'lar (game-engineer öncelikli, ui-designer ikinci derecede) yeni oyun spec'ini görür.

### Bir slash command eklemek

Örnek: `/lobby-stress-test` ile lobby fanout performans testi.

`.claude/commands/lobby-stress-test.md` yarat:

```markdown
---
description: Lobby fanout'u 100+ izleyici simüle ederek test et
---

hub-engineer'a delegate. Synthetic 100 viewer client başlat, lobby update broadcast latency ölç, p50/p95/p99 raporu üret.
```

Restart, `/lobby-stress-test` aktif.

### Bir hook eklemek

Örnek: Her game-engineer commit'i sonrası deterministic test koşsun.

`.claude/hooks/post-tool.json` dosyasını aç, yeni rule ekle:

```json
{
  "match": {
    "tool": "Bash",
    "command": "git commit*",
    "result": "success"
  },
  "action": "execute",
  "command": "if [[ $(git diff HEAD~ HEAD --name-only | grep -c 'apps/hub/games/') -gt 0 ]]; then pnpm --filter hub test:games; fi"
}
```

Dikkat: hook'lar agresif olabilir. Yavaşlatmamasına dikkat et.

## Yazım kurallarına uyum

Tüm prompt'lar `han-conventions` skill'indeki kurallara uyar:

- Em dash yok
- Kısa cümle
- Aktif ses
- Tripling yok
- Türkçe-first

Yeni bir agent yazarken bu kuralları frontmatter'da değil prose'da uygulanan şekilde yaz.

## Versiyon kontrolü

Tüm `.claude/` klasörü git'e dahil edilir. `.gitignore`'da değil. Subagent prompt değişikliklerini PR olarak inceleyebilirsin.

Önerilen branch stratejisi:

- `main` stabil agent prompt'ları
- `feature/agent-tweaks` deneysel prompt değişiklikleri
- Promosyon: PR ile review sonrası main'e merge

## Dikkat edilecekler

### Prompt çok uzun olmamalı

Her subagent dosyası 200-300 satırı geçmesin. Geçecekse skill'e bilgi taşı, agent skill'e referans versin.

### Çelişki yaratmamak

İki agent çelişen talimatlar verirse koordinasyon kırılır. Örnek: hub-engineer "WebSocket mesajlarını JSON" derken runtime-engineer "MsgPack kullan" derse, sistem patlar.

Çözüm: Çelişen talimatlar yerine `han-conventions` veya `han-architecture` skill'ine yaz, ikisi de oraya bakar.

### Tools listesini doğru tut

Bir agent'a vermediğin tool'u istediğinde Claude Code "tool not allowed" hatası verir. Tools listesini agent'ın gerçekten yapacağı işle eşleştir.

### Frontmatter zorunluluğu

YAML frontmatter zorunlu. Eksik olursa Claude Code agent'ı tanımaz.

```yaml
---
name: agent-adı
description: Bir cümlelik açıklama, dispatcher LLM bunu okur
tools: virgülle ayrılmış tool listesi
model: claude-opus-4-7  # opsiyonel
---
```

### `name` ve dosya adı uyumlu olmalı

Dosya `runtime-engineer.md` ise frontmatter'da `name: runtime-engineer` olmalı.

## Hata ayıklama

Bir agent'ın istediğin gibi davranmadığını fark edersen:

1. Agent'ın `description` alanını kontrol et. Dispatcher LLM agent seçimini buradan yapar. Description net ve özgün mü?
2. Prompt'ta talimat çelişiyor mu? Aynı şeyi farklı yerlerde farklı şekilde söylüyor olabilirsin.
3. Tools listesi yeterli mi? Agent yapamadığı bir şey istemiş olabilir.
4. Skill referansları doğru mu? Skill dosyası gerçekten orada mı?
5. Model cevap vermede zorlanıyorsa Opus'a geç.

## Yeni bir subagent eklemek için checklist

- [ ] `.claude/agents/<isim>.md` dosyası yarat
- [ ] YAML frontmatter (name, description, tools, model)
- [ ] Sorumluluk alanı net (1-2 cümle)
- [ ] Skill referansları
- [ ] Kısıtlar (neye dokunmaz)
- [ ] Çıktı formatı (yapılandırılmış)
- [ ] Yazım kuralları
- [ ] CLAUDE.md'deki agent listesine ekle
- [ ] README.md'deki agent listesine ekle
- [ ] İlgili slash command'larda yer al (varsa)

## Han'a özel notlar

Han'ın 11 subagent'ı dokunaklı bir şekilde dağıtılmış. Her birinin başka birinin alanına müdahale etmemesi kritik. Eğer yeni bir agent eklemek gerekirse (örn. "deployment-engineer"), önce architect ile konuş, ADR yaz, sonra ekle. Çakışan sorumluluk = koordinasyon kırılması.

Sık ihtiyaç duyulan eklemeler:
- **mobile-engineer** (V2'de mobile companion için)
- **growth-engineer** (V2'de marketing automation için)
- **community-engineer** (V2'de game SDK community management için)

Bunları V1 için ekleme. Scope kontrol önemli.
