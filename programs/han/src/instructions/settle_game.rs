use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::HanError;
use crate::state::{Config, GameRoom};

#[event]
pub struct GameSettled {
    pub room_id: u64,
    pub winner: Pubkey,
    pub payout: u64,
}

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct SettleGame<'info> {
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
        has_one = authority,
    )]
    pub config: Account<'info, Config>,

    /// CHECK: winner receives the pot payout
    #[account(mut)]
    pub winner_account: UncheckedAccount<'info>,

    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn settle_game(ctx: Context<SettleGame>, room_id: u64, winner: Pubkey) -> Result<()> {
    let room = &mut ctx.accounts.room;

    require!(
        room.status == 2 || room.status == 4,
        HanError::GameNotFinished
    );
    require!(
        ctx.accounts.winner_account.key() == winner,
        HanError::InvalidWinner
    );

    // Winner must be one of the players
    let winner_index = room.players[..room.player_count as usize]
        .iter()
        .position(|p| *p == winner);
    require!(winner_index.is_some(), HanError::InvalidWinner);

    // No partial refunds must have been claimed
    require!(room.refund_claimed == 0, HanError::RefundAlreadyClaimed);

    let total_pot = room.entry_fee.saturating_mul(room.player_count as u64);

    // State update before CPI (reentrancy protection)
    room.winner = Some(winner);
    room.status = 5;

    // Transfer pot from vault to winner
    if total_pot > 0 {
        let room_id_bytes = room_id.to_le_bytes();
        let seeds: &[&[u8]] = &[b"vault", room_id_bytes.as_ref(), &[ctx.bumps.vault]];
        let signer_seeds = &[seeds];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.winner_account.to_account_info(),
                },
                signer_seeds,
            ),
            total_pot,
        )?;
    }

    emit!(GameSettled {
        room_id,
        winner,
        payout: total_pot,
    });

    Ok(())
}
