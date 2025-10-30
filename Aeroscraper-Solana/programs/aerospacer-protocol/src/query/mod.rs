use anchor_lang::prelude::*;
use crate::state::*;
use crate::msg::*;
use crate::error::*;
// find_insert_location is now in trove_management.rs
use crate::utils::get_liquidation_gains;

// Exact replication of INJECTIVE query/mod.rs
pub fn query_total_collateral_amounts<'a>(
    _state_account: &StateAccount,
    total_collateral_amount_accounts: &'a [AccountInfo<'a>],
) -> Result<Vec<CollateralAmountResponse>> {
    let mut res = Vec::new();
    for account_info in total_collateral_amount_accounts {
        let total_collateral: Account<TotalCollateralAmount> = Account::try_from(account_info)?;
        res.push(CollateralAmountResponse {
            denom: total_collateral.denom.clone(),
            amount: total_collateral.amount,
        });
    }
    Ok(res)
}

pub fn query_total_debt_amount(state_account: &StateAccount) -> Result<u64> {
    Ok(state_account.total_debt_amount)
}

pub fn query_trove<'a>(
    user_addr: Pubkey,
    user_collateral_amount_accounts: &'a [AccountInfo<'a>],
    user_debt_amount_account: &Account<UserDebtAmount>,
) -> Result<TroveResponse> {
    let mut collateral_amounts = Vec::new();
    for account_info in user_collateral_amount_accounts {
        let user_collateral: Account<UserCollateralAmount> = Account::try_from(account_info)?;
        if user_collateral.owner == user_addr {
            collateral_amounts.push(CollateralAmountResponse {
                denom: user_collateral.denom.clone(),
                amount: user_collateral.amount,
            });
        }
    }

    let response = TroveResponse {
        collateral_amounts,
        debt_amount: user_debt_amount_account.amount,
    };
    Ok(response)
}

pub fn query_total_stake_amount(state_account: &StateAccount) -> Result<u64> {
    Ok(state_account.total_stake_amount)
}

pub fn query_stake(
    _user_addr: Pubkey,
    state_account: &StateAccount,
    user_stake_amount_account: &Account<UserStakeAmount>,
) -> Result<StakeResponse> {
    let total_stake_amount = state_account.total_stake_amount;
    let stake_amount = user_stake_amount_account.amount;

    let percentage = if total_stake_amount > 0 {
        (stake_amount * 1_000_000_000_000_000_000) / total_stake_amount // Simplified Decimal256
    } else {
        0
    };

    Ok(StakeResponse {
        amount: stake_amount,
        percentage,
    })
}

pub fn query_liquidation_gains<'a>(
    user_addr: Pubkey,
    state_account: &StateAccount,
    user_liquidation_collateral_gain_accounts: &'a [AccountInfo<'a>],
    total_liquidation_collateral_gain_accounts: &'a [AccountInfo<'a>],
    user_stake_amount_accounts: &'a [AccountInfo<'a>],
) -> Result<u64> { // Returns Uint256 in Injective, u64 here
    let res = get_liquidation_gains(
        user_addr,
        state_account,
        user_liquidation_collateral_gain_accounts,
        total_liquidation_collateral_gain_accounts,
        user_stake_amount_accounts,
    );

    if let Ok(collateral_gains) = res {
        let mut total_amount = 0u64;
        for collateral_gain in collateral_gains {
            total_amount = total_amount.checked_add(collateral_gain.amount).ok_or(AerospacerProtocolError::OverflowError)?;
        }
        return Ok(total_amount);
    }

    Ok(0)
}
