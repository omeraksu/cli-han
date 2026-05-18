# 2026-05-05, Game Escrow Refund Timeout

## Context

Han'ın game escrow sistemi şu an iki refund yolu sunuyor:

1. **Host iptali**: `cancel_game` instruction, host (room yaratıcısı) odayı filling state'inde iptal eder.
2. **Manual claim**: cancel sonrası her oyuncu `claim_refund` ile kendi deposit'ini geri alır.

Validation raporu (2026-05-05) kritik bir riski işaret etti: **hub authority tek nokta hatası.** `settle_game` instruction'ını sadece hub keypair imzalayabiliyor. Eğer hub çökerse, host iptal etmezse, oyuncuların ulaşamadığı bir vault kalır. Fonlar sonsuza kilitli.

Senaryolar:
- Hub keypair kayboldu (mainnet'te ciddi, Fuji testnet'te demo blocker)
- Hub backend down, oyun bitti ama settle instruction gönderilemedi
- Host wallet kaybetti, cancel_game çağıramıyor
- Oyun başladı ama bir oyuncu disconnect, oyun ne settle ne cancel oldu

## Decision

**Solidity contract'a `timeout_refund` instruction eklenecek. V1'e girer, opsiyonel değil.**

Kuralı şu:
- GameRoom state'inde `created_at: i64` alanı zaten var
- Sabit timeout: **24 saat (86400 saniye)** room.created_at'tan itibaren
- Timeout sonrası **herhangi bir oyuncu** kendi stake'ini `timeout_refund` ile geri alabilir
- `room.status` "settled" değilse refund mümkün
- Her oyuncu kendi stake'ini ayrı ayrı çeker (pot dağılmaz, herkes kendi giriş ücretini alır)

## Implementation

```rust
pub fn timeout_refund(ctx: Context<TimeoutRefund>, room_id: u64) -> Result<()> {
    let room = &mut ctx.accounts.room;
    let player = ctx.accounts.player.key();
    let now = Clock::get()?.unix_timestamp;
    
    // Settled veya cancelled olmuş bir room timeout yapılamaz
    require!(room.status != 5 && room.status != 6, HanError::AlreadyResolved);
    
    // Timeout süresi dolmuş mu
    require!(
        now - room.created_at >= ROOM_TIMEOUT_SECONDS,
        HanError::TimeoutNotReached
    );
    
    // Oyuncu room'da var mı
    let player_idx = room.players[..room.player_count as usize]
        .iter()
        .position(|&p| p == player)
        .ok_or(HanError::NotAPlayer)?;
    
    // Aynı oyuncu iki kez claim edemesin (refund_claimed bitmap)
    require!(
        room.refund_claimed & (1 << player_idx) == 0,
        HanError::AlreadyRefunded
    );
    
    // Vault'tan oyuncuya transfer
    if room.entry_fee > 0 {
        let vault_seeds = &[b"vault", &room_id.to_le_bytes(), &[ctx.bumps.vault]];
        let signer_seeds = &[&vault_seeds[..]];
        
        let cpi = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.player.to_account_info(),
            },
            signer_seeds,
        );
        anchor_lang::system_program::transfer(cpi, room.entry_fee)?;
    }
    
    // Bitmap güncelle
    room.refund_claimed |= 1 << player_idx;
    
    // Tüm oyuncular refund aldıysa status'u "timed_out" yap
    let all_refunded = (1u8 << room.player_count) - 1;
    if room.refund_claimed == all_refunded {
        room.status = 7; // timed_out
    }
    
    emit!(TimeoutRefundClaimed { room_id, player });
    Ok(())
}
```

GameRoom struct'ına eklenmesi gerekenler:
- `refund_claimed: u8` bitmap (max 8 oyuncu, her bit bir oyuncu)
- Status enum'una `7 = timed_out` ekleniyor

Sabit:
```rust
pub const ROOM_TIMEOUT_SECONDS: i64 = 86400; // 24 saat
```

## Consequences

**Kazandıkları:**
- Hub down senaryosunda fonlar kurtarılabilir
- Trustless garanti: oyuncu hub'a güvenmek zorunda değil
- Mainnet hazırlığı için kritik
- Validation raporu kapatılır, GO sinyali korunur

**Kaybettikleri:**
- Solidity contract'a 1 yeni instruction (~80 satır kod)
- GameRoom account size +1 byte (refund_claimed bitmap)
- 24 saat çok mu uzun? Demo için sorun değil, oyuncular ortalama 5 dakikada oynar bitirir. Tartışılabilir, V2'de configurable yapılabilir.

**Edge case'ler:**
- Bir oyuncu refund alır, sonra hub geri ayağa kalkar ve settle çağırır: settle başarısız olur (refund_claimed bitmap dolu, vault boş). Status değişmez. Hub tarafı bu durumu handle etmeli.
- Oyuncu kendi keypair'ini kaybetti ve refund alamadı: bu Solana'nın doğal kısıtlaması, çözülemez.

**Test gereksinimleri (qa-engineer için):**
- Happy path: 24h dolduktan sonra oyuncu refund alır, balance doğru
- Edge: aynı oyuncu iki kez refund denemez (AlreadyRefunded error)
- Edge: timeout dolmadan refund denemez (TimeoutNotReached error)
- Edge: settled room'da timeout_refund denemez (AlreadyResolved error)
- Edge: room'da olmayan biri timeout_refund denemez (NotAPlayer error)

## Status

Accepted, 2026-05-05.

## References

- solana.new validate-idea raporu (2026-05-05)
- Mevcut cancel_game ve claim_refund: host iptali için, timeout için değil
