use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub fee_receiver: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}
