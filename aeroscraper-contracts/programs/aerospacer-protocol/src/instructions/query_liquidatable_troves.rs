use anchor_lang::prelude::*;
use crate::error::*;
use crate::sorted_troves::get_liquidatable_troves;

/// Query parameters for finding liquidatable troves
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct QueryLiquidatableTrovesParams {
    pub liquidation_threshold: u64, // ICR threshold (typically 110 for 110%)
    pub max_troves: u8, // Limit results to avoid huge responses (default 50)
}

/// Query context - read-only, no mutations
#[derive(Accounts)]
pub struct QueryLiquidatableTroves {
    // NOTE: Sorted troves state removed - off-chain sorting architecture
    // Client provides pre-sorted trove list via remainingAccounts
}

/// Handler for query_liquidatable_troves instruction
/// Returns liquidatable troves via Anchor return data (set_return_data)
/// 
/// # Remaining Accounts Pattern (Triplets)
/// Caller must pass pre-sorted trove account triplets via remainingAccounts:
/// - [0]: First UserDebtAmount account (PDA)
/// - [1]: First UserCollateralAmount account (PDA)
/// - [2]: First LiquidityThreshold account (PDA, contains ICR)
/// - [3]: Second UserDebtAmount account (PDA)
/// - [4]: Second UserCollateralAmount account (PDA)
/// - [5]: Second LiquidityThreshold account (PDA, contains ICR)
/// - ...and so on for all troves to check
/// 
/// The function will stop early once it finds ICR >= threshold (sorted list optimization)
/// 
/// # Security
/// All accounts are verified to be real PDAs owned by the program to prevent fake account injection attacks
/// 
/// # Returns
/// Vec<Pubkey> of liquidatable trove owners via AnchorSerialize return data
pub fn handler(ctx: Context<QueryLiquidatableTroves>, params: QueryLiquidatableTrovesParams) -> Result<()> {
    // Validate parameters
    require!(
        params.liquidation_threshold > 0,
        AerospacerProtocolError::InvalidAmount
    );
    
    require!(
        params.max_troves > 0 && params.max_troves <= 50,
        AerospacerProtocolError::InvalidList
    );
    
    msg!("Querying liquidatable troves with threshold: {}%", params.liquidation_threshold);
    msg!("Max troves to return: {}", params.max_troves);
    
    // Validate pre-sorted list provided by client via remainingAccounts
    // Pass program_id for PDA verification (security)
    let mut liquidatable = get_liquidatable_troves(
        params.liquidation_threshold,
        ctx.remaining_accounts,
        ctx.program_id,
    )?;
    
    // Limit results to max_troves
    if liquidatable.len() > params.max_troves as usize {
        msg!("Truncating results from {} to {}", liquidatable.len(), params.max_troves);
        liquidatable.truncate(params.max_troves as usize);
    }
    
    msg!("Found {} liquidatable troves", liquidatable.len());
    
    // Return data via Anchor's set_return_data
    // Clients can decode this as Vec<Pubkey>
    anchor_lang::solana_program::program::set_return_data(&liquidatable.try_to_vec()?);
    
    Ok(())
}
