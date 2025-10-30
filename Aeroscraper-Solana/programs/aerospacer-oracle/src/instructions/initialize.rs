use anchor_lang::prelude::*;
use crate::state::OracleStateAccount;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    /// External oracle provider address (e.g., Pyth Network)
    pub oracle_address: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + OracleStateAccount::LEN,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, OracleStateAccount>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    
    /// CHECK: Clock sysvar for timestamp
    pub clock: Sysvar<'info, Clock>,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    let state = &mut ctx.accounts.state;
    let clock = &ctx.accounts.clock;
    
    // Initialize state with admin and oracle address
    state.admin = ctx.accounts.admin.key();
    state.oracle_address = params.oracle_address;
    state.collateral_data = Vec::new(); // Initialize empty vector
    state.last_update = clock.unix_timestamp;
    
    msg!("Aerospacer Oracle initialized successfully");
    msg!("Admin: {}", state.admin);
    msg!("Oracle Address: {}", state.oracle_address);
    msg!("Initialization timestamp: {}", state.last_update);
    msg!("Pyth staleness threshold: 60 seconds (hardcoded)");
    msg!("Pyth min confidence: 1000 (hardcoded)");
    msg!("Ready to configure collateral assets");
    
    Ok(())
}