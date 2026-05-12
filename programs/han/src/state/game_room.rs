use anchor_lang::prelude::*;

/// Room status codes
/// 1 = filling   (waiting for players)
/// 2 = ready     (all players joined, game starting)
/// 4 = finished  (game over, pending settlement)
/// 5 = settled   (winner paid out)
/// 6 = cancelled (host cancelled or no-show)
/// 7 = timed_out (24h timeout, all players refunded)
#[account]
#[derive(InitSpace)]
pub struct GameRoom {
    pub id: u64,
    pub host: Pubkey,
    pub game_type: [u8; 32],
    pub entry_fee: u64,
    pub max_players: u8,
    pub player_count: u8,
    pub players: [Pubkey; 8],
    pub status: u8,
    pub winner: Option<Pubkey>,
    pub created_at: i64,
    pub refund_claimed: u8, // bitmap: bit i = player i refunded
    pub bump: u8,
}
