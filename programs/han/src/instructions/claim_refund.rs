use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::HanError;
use crate::state::{Config, GameRoom};

#[event]
pub struct RefundClaimed {
    pub room_id: u64,
    pub player: Pubkey,
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct ClaimRefund<'info> {
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

pub fn claim_refund(ctx: Context<ClaimRefund>, room_id: u64) -> Result<()> {
    let room = &mut ctx.accounts.room;
    let player_key = ctx.accounts.player.key();

    require!(room.status == 6, HanError::RoomNotCancelled);

    // Find player index
    let player_index = room.players[..room.player_count as usize]
        .iter()
        .position(|p| *p == player_key)
        .ok_or(HanError::NotAPlayer)?;

    // Check bitmap: bit not set means not yet refunded
    let bit = 1u8 << player_index;
    require!(room.refund_claimed & bit == 0, HanError::AlreadyRefunded);

    let refund_amount = room.entry_fee;

    // Update bitmap before CPI (reentrancy protection)
    room.refund_claimed |= bit;

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

    emit!(RefundClaimed {
        room_id,
        player: player_key,
        amount: refund_amount,
    });

    Ok(())
}
