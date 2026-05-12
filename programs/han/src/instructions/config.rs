use anchor_lang::prelude::*;

use crate::state::Config;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_config(
    ctx: Context<InitializeConfig>,
    fee_bps: u16,
    fee_receiver: Pubkey,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.fee_receiver = fee_receiver;
    config.fee_bps = fee_bps;
    config.bump = ctx.bumps.config;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority,
    )]
    pub config: Account<'info, Config>,

    pub authority: Signer<'info>,
}

pub fn update_config(
    ctx: Context<UpdateConfig>,
    fee_bps: Option<u16>,
    fee_receiver: Option<Pubkey>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    if let Some(bps) = fee_bps {
        config.fee_bps = bps;
    }
    if let Some(receiver) = fee_receiver {
        config.fee_receiver = receiver;
    }
    Ok(())
}
