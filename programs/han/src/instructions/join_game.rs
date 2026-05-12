use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::HanError;
use crate::state::{Config, GameRoom};

#[event]
pub struct PlayerJoined {
    pub room_id: u64,
    pub player: Pubkey,
}

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct JoinGame<'info> {
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

pub fn join_game(ctx: Context<JoinGame>, room_id: u64) -> Result<()> {
    let room = &mut ctx.accounts.room;
    let player_key = ctx.accounts.player.key();

    require!(room.status == 1, HanError::GameNotFilling);
    require!(
        room.player_count < room.max_players,
        HanError::RoomFull
    );

    // Duplicate check
    let existing = room.players[..room.player_count as usize]
        .iter()
        .any(|p| *p == player_key);
    require!(!existing, HanError::DuplicatePlayer);

    let idx = room.player_count as usize;
    room.players[idx] = player_key;
    room.player_count += 1;

    // Transfer entry fee if paid game
    if room.entry_fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            room.entry_fee,
        )?;
    }

    // All players joined -> ready
    if room.player_count == room.max_players {
        room.status = 2;
    }

    emit!(PlayerJoined {
        room_id,
        player: player_key,
    });

    Ok(())
}
