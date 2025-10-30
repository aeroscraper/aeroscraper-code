use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::AerospacerOracleError;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RemoveDataParams {
    /// Asset denomination to remove (e.g., "inj", "atom")
    pub collateral_denom: String,
}

#[derive(Accounts)]
#[instruction(params: RemoveDataParams)]
pub struct RemoveData<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"state"],
        bump,
        constraint = state.admin == admin.key() @ AerospacerOracleError::Unauthorized
    )]
    pub state: Account<'info, OracleStateAccount>,
    
    /// CHECK: Clock sysvar for timestamp
    pub clock: Sysvar<'info, Clock>,
}

pub fn handler(ctx: Context<RemoveData>, params: RemoveDataParams) -> Result<()> {
    let state = &mut ctx.accounts.state;
    let clock = &ctx.accounts.clock;
    
    // Validate input parameters
    require!(!params.collateral_denom.is_empty(), AerospacerOracleError::InvalidCollateralData);
    
    // Find and remove the collateral data
    if let Some(index) = state.collateral_data.iter().position(|d| d.denom == params.collateral_denom) {
        let removed_data = state.collateral_data.remove(index);
        msg!("Removed collateral data for: {}", params.collateral_denom);
        msg!("Removed price ID: {}", removed_data.price_id);
        msg!("Removed decimal: {}", removed_data.decimal);
        msg!("Removed Pyth price account: {}", removed_data.pyth_price_account);
    } else {
        return Err(AerospacerOracleError::CollateralDataNotFound.into());
    }
    
    // Update last update timestamp
    state.last_update = clock.unix_timestamp;
    
    msg!("Remove data successful");
    msg!("Removed denom: {}", params.collateral_denom);
    msg!("Remaining assets: {}", state.collateral_data.len());
    msg!("Updated at: {}", clock.unix_timestamp);
    
    Ok(())
}