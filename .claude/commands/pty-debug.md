---
description: PTY veya stream sorunu debug
argument-hint: <hata açıklaması veya log alıntısı>
---

**debug-specialist** agent'ını çağır.

Sorun: $ARGUMENTS

`han-pty-streaming` skill'ini referans alarak:

1. Hangi katmanda hata var (runtime PTY, runtime transport, hub ingest, hub fanout)
2. Reproduction adımları
3. Log/trace al (varsa)
4. node-pty issue'leri için: handleFlowControl, encoding, terminal size, child exit
5. WebSocket için: reconnect loop, mesaj corruption, schema mismatch
6. Root cause hipotezi
7. Düzeltme önerisi (hangi agent'a delegate)

Eğer node-pty ile ilgili çapraz-platform sorun ise WebFetch ile microsoft/node-pty issues'a bak.
