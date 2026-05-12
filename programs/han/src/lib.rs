use anchor_lang::prelude::*;

declare_id!("D7pgqFkNXvHPGocEknUgKHrGjwtNZfsQBQ6ey9xXYXfD");

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod han {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: u16,
        fee_receiver: Pubkey,
    ) -> Result<()> {
        instructions::config::initialize_config(ctx, fee_bps, fee_receiver)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: Option<u16>,
        fee_receiver: Option<Pubkey>,
    ) -> Result<()> {
        instructions::config::update_config(ctx, fee_bps, fee_receiver)
    }

    pub fn create_game_room(
        ctx: Context<CreateGameRoom>,
        room_id: u64,
        game_type: [u8; 32],
        entry_fee: u64,
        max_players: u8,
    ) -> Result<()> {
        instructions::create_game_room::create_game_room(ctx, room_id, game_type, entry_fee, max_players)
    }

    pub fn join_game(ctx: Context<JoinGame>, room_id: u64) -> Result<()> {
        instructions::join_game::join_game(ctx, room_id)
    }

    pub fn settle_game(ctx: Context<SettleGame>, room_id: u64, winner: Pubkey) -> Result<()> {
        instructions::settle_game::settle_game(ctx, room_id, winner)
    }

    pub fn cancel_game(ctx: Context<CancelGame>, room_id: u64) -> Result<()> {
        instructions::cancel_game::cancel_game(ctx, room_id)
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>, room_id: u64) -> Result<()> {
        instructions::claim_refund::claim_refund(ctx, room_id)
    }

    pub fn timeout_refund(ctx: Context<TimeoutRefund>, room_id: u64) -> Result<()> {
        instructions::timeout_refund::timeout_refund(ctx, room_id)
    }
}
