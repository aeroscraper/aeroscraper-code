use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::AerospacerOracleError;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct GetPriceIdParams {
    /// Asset denomination (e.g., "inj", "atom")
    pub denom: String,
}

#[derive(Accounts)]
#[instruction(params: GetPriceIdParams)]
pub struct GetPriceId<'info> {
    #[account(
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, OracleStateAccount>,
}

pub fn handler(ctx: Context<GetPriceId>, params: GetPriceIdParams) -> Result<String> {
    let state = &ctx.accounts.state;
    
    // Find the collateral data for the requested denom
    let collateral_data = state.collateral_data
        .iter()
        .find(|d| d.denom == params.denom)
        .ok_or(AerospacerOracleError::PriceFeedNotFound)?;
    
    msg!("Price ID query successful");
    msg!("Denom: {}", params.denom);
    msg!("Price ID: {}", collateral_data.price_id);
    
    Ok(collateral_data.price_id.clone())
}
