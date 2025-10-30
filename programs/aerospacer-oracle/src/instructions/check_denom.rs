use anchor_lang::prelude::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CheckDenomParams {
    /// Asset denomination to check (e.g., "inj", "atom")
    pub denom: String,
}

#[derive(Accounts)]
#[instruction(params: CheckDenomParams)]
pub struct CheckDenom<'info> {
    #[account(
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, OracleStateAccount>,
}

pub fn handler(ctx: Context<CheckDenom>, params: CheckDenomParams) -> Result<bool> {
    let state = &ctx.accounts.state;
    
    // Check if the denom exists in collateral data
    let exists = state.collateral_data
        .iter()
        .any(|d| d.denom == params.denom);
    
    msg!("Check denom query successful");
    msg!("Denom: {}", params.denom);
    msg!("Exists: {}", exists);
    
    Ok(exists)
}
