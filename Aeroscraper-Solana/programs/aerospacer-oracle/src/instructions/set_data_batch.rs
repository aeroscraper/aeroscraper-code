use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::AerospacerOracleError;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SetDataBatchParams {
    /// Vector of collateral asset data to configure
    pub data: Vec<CollateralData>,
}

#[derive(Accounts)]
#[instruction(params: SetDataBatchParams)]
pub struct SetDataBatch<'info> {
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

pub fn handler(ctx: Context<SetDataBatch>, params: SetDataBatchParams) -> Result<()> {
    let state = &mut ctx.accounts.state;
    let clock = &ctx.accounts.clock;
    
    let data_len = params.data.len();
    
    // Validate batch data
    require!(data_len > 0, AerospacerOracleError::InvalidBatchData);
    require!(data_len <= 100, AerospacerOracleError::InvalidBatchData); // Limit batch size
    
    // Process each collateral data entry
    for collateral_data in params.data {
        // Validate individual data entries
        require!(!collateral_data.denom.is_empty(), AerospacerOracleError::InvalidCollateralData);
        require!(collateral_data.decimal > 0, AerospacerOracleError::InvalidCollateralData);
        require!(!collateral_data.price_id.is_empty(), AerospacerOracleError::InvalidCollateralData);
        
        // Validate price_id format (should be a valid hex string)
        if collateral_data.price_id.len() != 64 || !collateral_data.price_id.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(AerospacerOracleError::InvalidPriceId.into());
        }
        
        // Create new collateral data with timestamp
        let new_collateral_data = CollateralData {
            denom: collateral_data.denom.clone(),
            decimal: collateral_data.decimal,
            price_id: collateral_data.price_id.clone(),
            configured_at: clock.unix_timestamp,
            pyth_price_account: collateral_data.pyth_price_account,
        };
        
        // Check if denom already exists and update, otherwise add new
        if let Some(index) = state.collateral_data.iter().position(|d| d.denom == collateral_data.denom) {
            state.collateral_data[index] = new_collateral_data;
            msg!("Updated collateral data for: {}", collateral_data.denom);
        } else {
            state.collateral_data.push(new_collateral_data);
            msg!("Added new collateral data for: {}", collateral_data.denom);
        }
    }
    
    // Update last update timestamp
    state.last_update = clock.unix_timestamp;
    
    msg!("Set data batch successful");
    msg!("Processed {} collateral data entries", data_len);
    msg!("Total assets: {}", state.collateral_data.len());
    msg!("Updated at: {}", clock.unix_timestamp);
    
    Ok(())
}