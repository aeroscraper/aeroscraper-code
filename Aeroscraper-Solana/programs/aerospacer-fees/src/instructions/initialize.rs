use anchor_lang::prelude::*;
use crate::state::{FeeStateAccount, DEFAULT_FEE_ADDR_1, DEFAULT_FEE_ADDR_2};
use std::str::FromStr;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + FeeStateAccount::LEN,
        seeds = [b"fee_state"],
        bump
    )]
    pub state: Account<'info, FeeStateAccount>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let state = &mut ctx.accounts.state;
    
    state.admin = ctx.accounts.admin.key();
    state.is_stake_enabled = false; // Default to disabled
    state.stake_contract_address = Pubkey::default(); // Will be set later
    
    // Initialize with default fee addresses
    state.fee_address_1 = Pubkey::from_str(DEFAULT_FEE_ADDR_1).unwrap();
    state.fee_address_2 = Pubkey::from_str(DEFAULT_FEE_ADDR_2).unwrap();
    
    state.total_fees_collected = 0;
    
    msg!("Aerospacer Fee Distributor initialized successfully");
    msg!("Admin: {}", state.admin);
    msg!("Stake enabled: {}", state.is_stake_enabled);
    msg!("Fee Address 1: {}", state.fee_address_1);
    msg!("Fee Address 2: {}", state.fee_address_2);
    msg!("Total fees collected: {}", state.total_fees_collected);
    
    Ok(())
}


