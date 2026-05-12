use anchor_lang::prelude::*;

use crate::errors::HanError;
use crate::state::{Config, GameRoom};

#[event]
pub struct GameCancelled {
    pub room_id: u64,
}

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct CancelGame<'info> {
    #[account(
        mut,
        seeds = [b"room", room_id.to_le_bytes().as_ref()],
        bump = room.bump,
        has_one = host,
    )]
    pub room: Account<'info, GameRoom>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    pub host: Signer<'info>,
}

pub fn cancel_game(ctx: Context<CancelGame>, room_id: u64) -> Result<()> {
    let room = &mut ctx.accounts.room;

    require!(room.status == 1, HanError::CannotCancel);

    room.status = 6; // cancelled

    emit!(GameCancelled { room_id });

    Ok(())
}
