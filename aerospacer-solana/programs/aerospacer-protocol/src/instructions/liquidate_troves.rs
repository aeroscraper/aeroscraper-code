use anchor_lang::prelude::*;
use anchor_spl::token::{Token, Mint};
use crate::state::*;
use crate::error::*;
use crate::trove_management::*;
use crate::account_management::*;
use crate::oracle::*;

// Constants
const MAX_LIQUIDATION_BATCH_SIZE: usize = 50;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TroveAmounts {
    pub collateral_amounts: Vec<(String, u64)>, // Equivalent to HashMap<String, Uint256>
    pub debt_amount: u64, // Equivalent to Uint256
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct LiquidateTrovesParams {
    pub liquidation_list: Vec<Pubkey>, // Vec<String> in Injective, Vec<Pubkey> in Solana
    pub collateral_denom: String,
}

#[derive(Accounts)]
#[instruction(params: LiquidateTrovesParams)]
pub struct LiquidateTroves<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,

    #[account(mut)]
    pub state: Account<'info, StateAccount>,

    #[account(mut)]
    pub stable_coin_mint: Account<'info, Mint>,

    /// CHECK: Protocol stablecoin vault PDA
    #[account(
        mut,
        seeds = [b"protocol_stablecoin_vault"],
        bump
    )]
    pub protocol_stablecoin_vault: AccountInfo<'info>,
    
    /// CHECK: Protocol collateral vault PDA
    #[account(
        mut,
        seeds = [b"protocol_collateral_vault", params.collateral_denom.as_bytes()],
        bump
    )]
    pub protocol_collateral_vault: AccountInfo<'info>,

    /// CHECK: Per-denom collateral total PDA
    #[account(
        mut,
        seeds = [b"total_collateral_amount", params.collateral_denom.as_bytes()],
        bump
    )]
    pub total_collateral_amount: Account<'info, TotalCollateralAmount>,

    // Oracle context - integration with our aerospacer-oracle
    /// CHECK: Our oracle program - validated against state
    #[account(
        mut,
        constraint = oracle_program.key() == state.oracle_helper_addr @ AerospacerProtocolError::Unauthorized
    )]
    pub oracle_program: AccountInfo<'info>,
    
    /// CHECK: Oracle state account - validated against state
    #[account(
        mut,
        constraint = oracle_state.key() == state.oracle_state_addr @ AerospacerProtocolError::Unauthorized
    )]
    pub oracle_state: AccountInfo<'info>,
    
    /// CHECK: Pyth price account for collateral price feed
    pub pyth_price_account: AccountInfo<'info>,
    
    /// Clock sysvar for timestamp validation
    pub clock: Sysvar<'info, Clock>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    
    // remaining_accounts should contain:
    // - First 4*N accounts: Per-trove accounts (UserDebtAmount, UserCollateralAmount, LiquidityThreshold, Node)
    // - Remaining accounts: TotalLiquidationCollateralGain PDAs (one per unique denom being liquidated)
    //   These PDAs track seized collateral for distribution to stability pool stakers
}

pub fn handler(ctx: Context<LiquidateTroves>, params: LiquidateTrovesParams) -> Result<()> {
    // Validate input parameters
    require!(
        !params.liquidation_list.is_empty(),
        AerospacerProtocolError::InvalidList
    );
    
    require!(
        params.liquidation_list.len() <= MAX_LIQUIDATION_BATCH_SIZE,
        AerospacerProtocolError::InvalidList
    );
    
    require!(
        !params.collateral_denom.is_empty(),
        AerospacerProtocolError::InvalidAmount
    );
    
    // Validate remaining accounts count
    let expected_accounts = params.liquidation_list.len() * 4; // 4 accounts per user
    require!(
        ctx.remaining_accounts.len() >= expected_accounts,
        AerospacerProtocolError::InvalidList
    );
    
    // Validate liquidator authorization
    // For now, allow any liquidator - in production, you might want to restrict this
    msg!("Liquidation by: {}", ctx.accounts.liquidator.key());
    
    // Validate remaining accounts for each user
    validate_remaining_accounts(&params.liquidation_list, &ctx.remaining_accounts)?;
    
    // Create context structs for clean architecture
    let mut liquidation_ctx = LiquidationContext {
        liquidator: ctx.accounts.liquidator.clone(),
        state: ctx.accounts.state.clone(),
        stable_coin_mint: ctx.accounts.stable_coin_mint.clone(),
        protocol_stablecoin_vault: ctx.accounts.protocol_stablecoin_vault.clone(),
        protocol_collateral_vault: ctx.accounts.protocol_collateral_vault.clone(),
        total_collateral_amount: ctx.accounts.total_collateral_amount.clone(),
        token_program: ctx.accounts.token_program.clone(),
        system_program: ctx.accounts.system_program.clone(),
    };
    
    let oracle_ctx = OracleContext {
        oracle_program: ctx.accounts.oracle_program.clone(),
        oracle_state: ctx.accounts.oracle_state.clone(),
        pyth_price_account: ctx.accounts.pyth_price_account.clone(),
        clock: ctx.accounts.clock.to_account_info(),
    };

    // Use TroveManager for clean implementation
    let result = TroveManager::liquidate_troves(
        &mut liquidation_ctx,
        &oracle_ctx,
        params.liquidation_list.clone(),
        &ctx.remaining_accounts,
    )?;

    // Update the actual accounts with the results
    ctx.accounts.state.total_debt_amount = liquidation_ctx.state.total_debt_amount;
    ctx.accounts.state.total_stake_amount = liquidation_ctx.state.total_stake_amount;
    
    // NOTE: Sorted troves management moved off-chain
    msg!("Troves liquidated successfully");
    msg!("Liquidator: {}", ctx.accounts.liquidator.key());
    msg!("Collateral denom: {}", params.collateral_denom);
    msg!("Liquidated troves: {}", result.liquidated_count);
    msg!("Total debt liquidated: {}", result.total_debt_liquidated);
    msg!("Total collateral gained: {}", result.total_collateral_gained);
    
    // Log liquidation gains by denomination
    for (denom, amount) in &result.liquidation_gains {
        msg!("Collateral gained - {}: {}", denom, amount);
    }

    Ok(())
}

/// Validate remaining accounts for liquidation
fn validate_remaining_accounts(
    liquidation_list: &[Pubkey],
    remaining_accounts: &[AccountInfo],
) -> Result<()> {
    let expected_count = liquidation_list.len() * 4;
    
    require!(
        remaining_accounts.len() >= expected_count,
        AerospacerProtocolError::InvalidList
    );
    
    // Validate each user's accounts
    for (i, user) in liquidation_list.iter().enumerate() {
        let account_start = i * 4;
        
        // Validate UserDebtAmount account
        validate_user_debt_account(&remaining_accounts[account_start], user)?;
        
        // Validate UserCollateralAmount account
        validate_user_collateral_account(&remaining_accounts[account_start + 1], user)?;
        
        // Validate LiquidityThreshold account
        validate_liquidity_threshold_account(&remaining_accounts[account_start + 2], user)?;
        
        // Validate TokenAccount
        validate_token_account(&remaining_accounts[account_start + 3], user)?;
    }
    
    Ok(())
}

/// Validate UserDebtAmount account
fn validate_user_debt_account(account_info: &AccountInfo, expected_user: &Pubkey) -> Result<()> {
    require!(
        account_info.owner == &crate::ID,
        AerospacerProtocolError::Unauthorized
    );
    
    require!(
        account_info.is_writable,
        AerospacerProtocolError::Unauthorized
    );
    
    let account_data = account_info.try_borrow_data()?;
    let user_debt_amount = UserDebtAmount::try_from_slice(&account_data)?;
    
    require!(
        user_debt_amount.owner == *expected_user,
        AerospacerProtocolError::Unauthorized
    );
    
    Ok(())
}

/// Validate UserCollateralAmount account
fn validate_user_collateral_account(account_info: &AccountInfo, expected_user: &Pubkey) -> Result<()> {
    require!(
        account_info.owner == &crate::ID,
        AerospacerProtocolError::Unauthorized
    );
    
    require!(
        account_info.is_writable,
        AerospacerProtocolError::Unauthorized
    );
    
    let account_data = account_info.try_borrow_data()?;
    let user_collateral_amount = UserCollateralAmount::try_from_slice(&account_data)?;
    
    require!(
        user_collateral_amount.owner == *expected_user,
        AerospacerProtocolError::Unauthorized
    );
    
    Ok(())
}

/// Validate LiquidityThreshold account
fn validate_liquidity_threshold_account(account_info: &AccountInfo, expected_user: &Pubkey) -> Result<()> {
    require!(
        account_info.owner == &crate::ID,
        AerospacerProtocolError::Unauthorized
    );
    
    require!(
        account_info.is_writable,
        AerospacerProtocolError::Unauthorized
    );
    
    let account_data = account_info.try_borrow_data()?;
    let liquidity_threshold = LiquidityThreshold::try_from_slice(&account_data)?;
    
    require!(
        liquidity_threshold.owner == *expected_user,
        AerospacerProtocolError::Unauthorized
    );
    
    Ok(())
}

/// Validate TokenAccount
fn validate_token_account(account_info: &AccountInfo, _expected_user: &Pubkey) -> Result<()> {
    require!(
        account_info.owner == &anchor_spl::token::ID,
        AerospacerProtocolError::Unauthorized
    );
    
    Ok(())
}