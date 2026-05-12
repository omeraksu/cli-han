use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::ROOM_TIMEOUT_SECONDS;
use crate::errors::HanError;
use crate::state::{Config, GameRoom};

#[event]
pub struct TimeoutRefundClaimed {
    pub room_id: u64,
    pub player: Pubkey,
}

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct TimeoutRefund<'info> {
    #[account(
        mut,
        seeds = [b"room", room_id.to_le_bytes().as_ref()],
        bump = room.bump,
    )]
    pub room: Account<'info, GameRoom>,

    /// CHECK: vault is a system-owned PDA that only holds SOL
    #[account(
        mut,
        seeds = [b"vault", room_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn timeout_refund(ctx: Context<TimeoutRefund>, room_id: u64) -> Result<()> {
    let room = &mut ctx.accounts.room;
    let player_key = ctx.accounts.player.key();

    // Already settled or cancelled or timed_out
    require!(
        room.status != 5 && room.status != 6 && room.status != 7,
        HanError::AlreadyResolved
    );

    // Check timeout
    let now = Clock::get()?.unix_timestamp;
    require!(
        now - room.created_at >= ROOM_TIMEOUT_SECONDS,
        HanError::TimeoutNotReached
    );

    // Player must be in the room
    let player_index = room.players[..room.player_count as usize]
        .iter()
        .position(|p| *p == player_key)
        .ok_or(HanError::NotAPlayer)?;

    // Check bitmap
    let bit = 1u8 << player_index;
    require!(room.refund_claimed & bit == 0, HanError::AlreadyRefunded);

    let refund_amount = room.entry_fee;

    // Update bitmap before CPI (reentrancy protection)
    room.refund_claimed |= bit;

    // Check if all players have now claimed
    let all_mask: u8 = (1u8 << room.player_count).wrapping_sub(1);
    if room.refund_claimed == all_mask {
        room.status = 7; // timed_out
    }

    if refund_amount > 0 {
        let room_id_bytes = room_id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"vault", room_id_bytes.as_ref(), &[ctx.bumps.vault]];
        let signer_seeds = &[seeds];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.player.to_account_info(),
                },
                signer_seeds,
            ),
            refund_amount,
        )?;
    }

    emit!(TimeoutRefundClaimed {
        room_id,
        player: player_key,
    });

    Ok(())
}
