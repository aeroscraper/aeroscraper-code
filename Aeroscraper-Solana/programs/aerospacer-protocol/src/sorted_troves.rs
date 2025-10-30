use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::*;

/// Simplified sorted troves module - Off-chain sorting with on-chain validation
/// 
/// NEW ARCHITECTURE:
/// - Client fetches all troves via RPC (no on-chain size limits)
/// - Client sorts by ICR off-chain (efficient, no compute limits)
/// - Client passes 2-3 neighbor accounts via remainingAccounts for validation
/// - Contract validates ICR ordering without storing linked list
/// 
/// Benefits:
/// - Reduced on-chain storage (no Node accounts, no SortedTrovesState)
/// - No transaction size limits from passing full list
/// - Simpler contract logic (~100 lines vs 668 lines)
/// - Client has full flexibility for sorting strategy

/// Validate that a trove's ICR is correctly ordered between its neighbors
/// 
/// # Arguments
/// * `trove_icr` - ICR of the trove being validated
/// * `prev_icr` - ICR of the previous neighbor (if exists), should be <= trove_icr
/// * `next_icr` - ICR of the next neighbor (if exists), should be >= trove_icr
/// 
/// # Returns
/// Ok(()) if ordering is valid, Err otherwise
/// 
/// # Ordering Rules
/// - Lower ICR = riskier = earlier in list
/// - Higher ICR = safer = later in list
/// - If prev exists: prev_icr <= trove_icr
/// - If next exists: trove_icr <= next_icr
pub fn validate_icr_ordering(
    trove_icr: u64,
    prev_icr: Option<u64>,
    next_icr: Option<u64>,
) -> Result<()> {
    // Validate prev neighbor: prev_icr <= trove_icr
    if let Some(prev) = prev_icr {
        require!(
            prev <= trove_icr,
            AerospacerProtocolError::InvalidList
        );
        msg!("✓ Valid ordering: prev_icr {} <= trove_icr {}", prev, trove_icr);
    }
    
    // Validate next neighbor: trove_icr <= next_icr
    if let Some(next) = next_icr {
        require!(
            trove_icr <= next,
            AerospacerProtocolError::InvalidList
        );
        msg!("✓ Valid ordering: trove_icr {} <= next_icr {}", trove_icr, next);
    }
    
    Ok(())
}

/// Get liquidatable troves from a pre-sorted list provided by client
/// 
/// # New Architecture
/// Client passes pre-sorted list of troves via remainingAccounts.
/// Contract validates:
/// 1. Each trove's ICR < liquidation_threshold
/// 2. ICRs are properly sorted (ascending order)
/// 
/// # Arguments
/// * `liquidation_threshold` - ICR threshold below which troves are liquidatable (typically 110)
/// * `remaining_accounts` - Pre-sorted trove accounts [UserDebtAmount, UserCollateralAmount, LiquidityThreshold] triplets
/// 
/// # Returns
/// Vec<Pubkey> of validated liquidatable trove owners
/// 
/// # Remaining Accounts Pattern (per trove)
/// For each trove in the liquidation list:
/// - [i*3 + 0]: UserDebtAmount account
/// - [i*3 + 1]: UserCollateralAmount account
/// - [i*3 + 2]: LiquidityThreshold account (contains ICR)
/// 
/// # Validation
/// - Checks ICR < threshold for each trove
/// - Validates ascending ICR order (sorted from riskiest to safest)
/// - Stops at first trove with ICR >= threshold (early termination optimization)
pub fn get_liquidatable_troves(
    liquidation_threshold: u64,
    remaining_accounts: &[AccountInfo],
) -> Result<Vec<Pubkey>> {
    let mut liquidatable = Vec::new();
    
    // Validate accounts come in triplets
    require!(
        remaining_accounts.len() % 3 == 0,
        AerospacerProtocolError::InvalidList
    );
    
    let num_troves = remaining_accounts.len() / 3;
    
    if num_troves == 0 {
        msg!("No troves provided for liquidation check");
        return Ok(liquidatable);
    }
    
    msg!("Checking {} troves for liquidation (threshold: {})", num_troves, liquidation_threshold);
    
    let mut prev_icr: Option<u64> = None;
    
    for i in 0..num_troves {
        let base_idx = i * 3;
        
        // Get accounts for this trove
        let debt_account = &remaining_accounts[base_idx];
        let _collateral_account = &remaining_accounts[base_idx + 1]; // Reserved for future use
        let lt_account = &remaining_accounts[base_idx + 2];
        
        // Deserialize UserDebtAmount to get owner
        let debt_data = debt_account.try_borrow_data()?;
        let debt = UserDebtAmount::try_deserialize(&mut &debt_data[..])?;
        let owner = debt.owner;
        drop(debt_data);
        
        // Deserialize LiquidityThreshold to get ICR
        let lt_data = lt_account.try_borrow_data()?;
        let threshold = LiquidityThreshold::try_deserialize(&mut &lt_data[..])?;
        let current_icr = threshold.ratio;
        
        // Verify LiquidityThreshold matches the debt account owner
        require!(
            threshold.owner == owner,
            AerospacerProtocolError::InvalidList
        );
        drop(lt_data);
        
        msg!("Trove {}: owner={}, ICR={}", i, owner, current_icr);
        
        // Validate ascending ICR order (sorted list)
        if let Some(prev) = prev_icr {
            require!(
                prev <= current_icr,
                AerospacerProtocolError::InvalidList
            );
        }
        
        // Check if liquidatable
        if current_icr < liquidation_threshold {
            liquidatable.push(owner);
            msg!("  -> Liquidatable (ICR {} < threshold {})", current_icr, liquidation_threshold);
            prev_icr = Some(current_icr);
        } else {
            // Sorted list optimization: stop at first safe trove
            msg!("  -> Safe (ICR {} >= threshold {}). Stopping (sorted list optimization)", current_icr, liquidation_threshold);
            break;
        }
    }
    
    msg!("Found {} liquidatable troves", liquidatable.len());
    Ok(liquidatable)
}

/// Helper: Get ICR from LiquidityThreshold account
/// 
/// # Arguments
/// * `account` - LiquidityThreshold account
/// * `expected_owner` - Expected owner Pubkey for validation
/// 
/// # Returns
/// ICR value from the account
pub fn get_icr_from_account(account: &AccountInfo, expected_owner: Pubkey) -> Result<u64> {
    let threshold_data = account.try_borrow_data()?;
    let threshold = LiquidityThreshold::try_deserialize(&mut &threshold_data[..])?;
    
    require!(
        threshold.owner == expected_owner,
        AerospacerProtocolError::InvalidList
    );
    
    Ok(threshold.ratio)
}

/// Verify that a LiquidityThreshold account is a real PDA, not a fake account
/// 
/// # Arguments
/// * `account` - The account to verify
/// * `owner` - The expected owner (from deserializing the account)
/// * `program_id` - The program ID for PDA derivation
/// 
/// # Returns
/// Ok(()) if account is a valid PDA, Err otherwise
pub fn verify_liquidity_threshold_pda(
    account: &AccountInfo,
    owner: Pubkey,
    program_id: &Pubkey,
) -> Result<()> {
    let (expected_pda, _bump) = Pubkey::find_program_address(
        &[b"liquidity_threshold", owner.as_ref()],
        program_id,
    );
    
    require!(
        expected_pda == *account.key,
        AerospacerProtocolError::InvalidList
    );
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_validate_icr_ordering_valid() {
        // Valid: prev(100) <= trove(150) <= next(200)
        assert!(validate_icr_ordering(150, Some(100), Some(200)).is_ok());
        
        // Valid: no prev, trove(150) <= next(200)
        assert!(validate_icr_ordering(150, None, Some(200)).is_ok());
        
        // Valid: prev(100) <= trove(150), no next
        assert!(validate_icr_ordering(150, Some(100), None).is_ok());
        
        // Valid: no neighbors
        assert!(validate_icr_ordering(150, None, None).is_ok());
        
        // Valid: equal ICRs
        assert!(validate_icr_ordering(150, Some(150), Some(150)).is_ok());
    }
    
    #[test]
    fn test_validate_icr_ordering_invalid() {
        // Invalid: prev(200) > trove(150)
        assert!(validate_icr_ordering(150, Some(200), Some(300)).is_err());
        
        // Invalid: trove(150) > next(100)
        assert!(validate_icr_ordering(150, Some(100), Some(100)).is_err());
    }
}
