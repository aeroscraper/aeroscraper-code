use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::AerospacerOracleError;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SetDataParams {
    /// Asset denomination (e.g., "inj", "atom")
    pub denom: String,
    
    /// Decimal precision for price calculations (6, 18, etc.)
    pub decimal: u8,
    
    /// Pyth Network price feed identifier (hex format)
    pub price_id: String,
    
    /// Pyth price account address for this asset
    pub pyth_price_account: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: SetDataParams)]
pub struct SetData<'info> {
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

pub fn handler(ctx: Context<SetData>, params: SetDataParams) -> Result<()> {
    let state = &mut ctx.accounts.state;
    let clock = &ctx.accounts.clock;
    
    // Validate input parameters
    require!(!params.denom.is_empty(), AerospacerOracleError::InvalidCollateralData);
    require!(params.decimal > 0, AerospacerOracleError::InvalidCollateralData);
    require!(!params.price_id.is_empty(), AerospacerOracleError::InvalidCollateralData);
    
    // Validate price_id format (should be a valid hex string)
    if params.price_id.len() != 64 || !params.price_id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(AerospacerOracleError::InvalidPriceId.into());
    }
    
    // Create new collateral data with timestamp
    let collateral_data = CollateralData {
        denom: params.denom.clone(),
        decimal: params.decimal,
        price_id: params.price_id.clone(),
        configured_at: clock.unix_timestamp,
        pyth_price_account: params.pyth_price_account,
    };
    
    // Check if denom already exists and update, otherwise add new
    if let Some(index) = state.collateral_data.iter().position(|d| d.denom == params.denom) {
        state.collateral_data[index] = collateral_data;
        msg!("Updated collateral data for: {}", params.denom);
    } else {
        state.collateral_data.push(collateral_data);
        msg!("Added new collateral data for: {}", params.denom);
    }
    
    // Update last update timestamp
    state.last_update = clock.unix_timestamp;
    
    msg!("Set data successful");
    msg!("Denom: {}", params.denom);
    msg!("Decimal: {}", params.decimal);
    msg!("Price ID: {}", params.price_id);
    msg!("Pyth Price Account: {}", params.pyth_price_account);
    msg!("Configured at: {}", clock.unix_timestamp);
    msg!("Total assets: {}", state.collateral_data.len());
    
    Ok(())
}