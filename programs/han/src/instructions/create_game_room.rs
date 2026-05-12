use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::{MAX_ENTRY_FEE, MAX_PLAYERS, MIN_ENTRY_FEE};
use crate::errors::HanError;
use crate::state::{Config, GameRoom};

#[event]
pub struct GameRoomCreated {
    pub room_id: u64,
    pub host: Pubkey,
    pub entry_fee: u64,
}

#[derive(Accounts)]
#[instruction(room_id: u64)]
pub struct CreateGameRoom<'info> {
    #[account(
        init,
        payer = host,
        space = 8 + GameRoom::INIT_SPACE,
        seeds = [b"room", room_id.to_le_bytes().as_ref()],
        bump,
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
    pub host: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_game_room(
    ctx: Context<CreateGameRoom>,
    room_id: u64,
    game_type: [u8; 32],
    entry_fee: u64,
    max_players: u8,
) -> Result<()> {
    require!(
        max_players >= 2 && max_players <= MAX_PLAYERS,
        HanError::InvalidMaxPlayers
    );

    if entry_fee > 0 {
        require!(entry_fee >= MIN_ENTRY_FEE, HanError::EntryFeeTooLow);
        require!(entry_fee <= MAX_ENTRY_FEE, HanError::EntryFeeTooHigh);
    }

    let room = &mut ctx.accounts.room;
    room.id = room_id;
    room.host = ctx.accounts.host.key();
    room.game_type = game_type;
    room.entry_fee = entry_fee;
    room.max_players = max_players;
    room.player_count = 1;
    room.players = [Pubkey::default(); 8];
    room.players[0] = ctx.accounts.host.key();
    room.status = 1; // filling
    room.winner = None;
    room.created_at = Clock::get()?.unix_timestamp;
    room.refund_claimed = 0;
    room.bump = ctx.bumps.room;

    // Host pays entry fee into vault
    if entry_fee > 0 {
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.host.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            entry_fee,
        )?;
    }

    emit!(GameRoomCreated {
        room_id,
        host: ctx.accounts.host.key(),
        entry_fee,
    });

    Ok(())
}
