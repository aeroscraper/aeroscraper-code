use anchor_lang::prelude::*;
use crate::state::FeeStateAccount;
use crate::error::AerospacerFeesError;

#[derive(Accounts)]
pub struct ToggleStakeContract<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"fee_state"],
        bump,
        constraint = state.admin == admin.key() @ AerospacerFeesError::Unauthorized
    )]
    pub state: Account<'info, FeeStateAccount>,
}

pub fn handler(ctx: Context<ToggleStakeContract>) -> Result<()> {
    let state = &mut ctx.accounts.state;
    
    state.is_stake_enabled = !state.is_stake_enabled;
    
    msg!("Stake contract toggled successfully");
    msg!("Stake enabled: {}", state.is_stake_enabled);
    
    if state.is_stake_enabled {
        msg!("Fees will now be distributed to stability pool");
    } else {
        msg!("Fees will now be distributed to fee addresses");
    }
    
    Ok(())
}
