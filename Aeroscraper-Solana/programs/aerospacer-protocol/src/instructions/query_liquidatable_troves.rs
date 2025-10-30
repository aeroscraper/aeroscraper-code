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
/// # Remaining Accounts Pattern
/// Caller must pass Node and LiquidityThreshold account pairs for traversal:
/// - [0]: First Node account (head of sorted list)
/// - [1]: First LiquidityThreshold account
/// - [2]: Second Node account
/// - [3]: Second LiquidityThreshold account
/// - ...and so on for all troves to check
/// 
/// The function will stop early once it finds ICR >= threshold (sorted list optimization)
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
    let mut liquidatable = get_liquidatable_troves(
        params.liquidation_threshold,
        ctx.remaining_accounts,
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
