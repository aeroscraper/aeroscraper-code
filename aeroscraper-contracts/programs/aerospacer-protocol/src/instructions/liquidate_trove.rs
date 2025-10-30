use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint, Burn};
use crate::state::*;
use crate::error::*;
use crate::oracle::{self, OracleContext, PriceCalculator};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct LiquidateTroveParams {
    pub target_user: Pubkey,
    pub collateral_denom: String,
}

#[derive(Accounts)]
#[instruction(params: LiquidateTroveParams)]
pub struct LiquidateTrove<'info> {
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

    #[account(
        mut,
        seeds = [b"total_collateral_amount", params.collateral_denom.as_bytes()],
        bump
    )]
    pub total_collateral_amount: Account<'info, TotalCollateralAmount>,

    // Target trove accounts
    #[account(
        mut,
        seeds = [b"user_debt_amount", params.target_user.as_ref()],
        bump,
        constraint = user_debt_amount.owner == params.target_user @ AerospacerProtocolError::Unauthorized
    )]
    pub user_debt_amount: Account<'info, UserDebtAmount>,

    #[account(
        mut,
        seeds = [b"user_collateral_amount", params.target_user.as_ref(), params.collateral_denom.as_bytes()],
        bump,
        constraint = user_collateral_amount.owner == params.target_user @ AerospacerProtocolError::Unauthorized
    )]
    pub user_collateral_amount: Account<'info, UserCollateralAmount>,

    #[account(
        mut,
        seeds = [b"liquidity_threshold", params.target_user.as_ref()],
        bump,
        constraint = liquidity_threshold.owner == params.target_user @ AerospacerProtocolError::Unauthorized
    )]
    pub liquidity_threshold: Account<'info, LiquidityThreshold>,

    // User's ATA for seized collateral (must match denom mint implied by vault)
    #[account(mut)]
    pub user_collateral_token_account: Account<'info, TokenAccount>,

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

    pub clock: Sysvar<'info, Clock>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<LiquidateTrove>, params: LiquidateTroveParams) -> Result<()> {
    // Basic input checks
    require!(!params.collateral_denom.is_empty(), AerospacerProtocolError::InvalidAmount);

    // Build oracle context
    let oracle_ctx = OracleContext {
        oracle_program: ctx.accounts.oracle_program.clone(),
        oracle_state: ctx.accounts.oracle_state.clone(),
        pyth_price_account: ctx.accounts.pyth_price_account.clone(),
        clock: ctx.accounts.clock.to_account_info(),
    };

    // Compute ICR and ensure undercollateralized (ICR < 110)
    let debt_amount = ctx.accounts.user_debt_amount.amount;
    let coll_info = &ctx.accounts.user_collateral_amount;

    // If no debt, nothing to liquidate
    require!(debt_amount > 0, AerospacerProtocolError::TroveDoesNotExist);

    // Require denom match
    require!(coll_info.denom == params.collateral_denom, AerospacerProtocolError::InvalidAmount);

    // Price validation
    let price = oracle_ctx.get_price(&params.collateral_denom)?;
    oracle_ctx.validate_price(&price)?;

    let collateral_value = PriceCalculator::calculate_collateral_value(
        coll_info.amount,
        price.price as u64,
        price.decimal,
    )?;

    let current_icr = PriceCalculator::calculate_collateral_ratio(collateral_value, debt_amount)?;
    // Use micro-percent threshold (110% = 110_000_000)
    require!(current_icr < 110_000_000, AerospacerProtocolError::CollateralBelowMinimum);

    // Burn stablecoin from protocol vault (PDA signer)
    let (_pda, bump) = Pubkey::find_program_address(&[b"protocol_stablecoin_vault"], &crate::ID);
    let vault_seeds: &[&[u8]] = &[b"protocol_stablecoin_vault", &[bump]];
    let signer: &[&[&[u8]]] = &[vault_seeds];

    let burn_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.stable_coin_mint.to_account_info(),
            from: ctx.accounts.protocol_stablecoin_vault.to_account_info(),
            authority: ctx.accounts.protocol_stablecoin_vault.to_account_info(),
        },
        signer,
    );
    anchor_spl::token::burn(burn_ctx, debt_amount)?;

    // Zero user trove data (effectively liquidated)
    ctx.accounts.user_debt_amount.amount = 0;
    ctx.accounts.user_collateral_amount.amount = 0;
    ctx.accounts.liquidity_threshold.ratio = 0;

    // Deplete stability pool stake by burned amount
    ctx.accounts.state.total_stake_amount = ctx
        .accounts
        .state
        .total_stake_amount
        .saturating_sub(debt_amount);

    // Update global state
    ctx.accounts.state.total_debt_amount = ctx
        .accounts
        .state
        .total_debt_amount
        .saturating_sub(debt_amount);

    // NOTE: For minimal version, we do not transfer seized collateral out of protocol vault
    // nor update S snapshot here. That can be added by exposing an optional
    // stability_pool_snapshot account and applying the snapshot algorithm.

    msg!(
        "Single trove liquidated: user={}, denom={}, debt_liquidated={}",
        params.target_user,
        params.collateral_denom,
        debt_amount
    );

    Ok(())
}


