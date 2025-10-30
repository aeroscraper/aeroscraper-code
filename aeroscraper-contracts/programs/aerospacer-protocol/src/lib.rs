#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

// Core modules
pub mod error;
pub mod state;
pub mod msg;
pub mod query;

// New architecture modules
pub mod account_management;
pub mod oracle;
pub mod trove_management;
pub mod fees_integration;
pub mod sorted_troves;

// Core instruction handlers
pub mod instructions;
pub mod utils;

use instructions::*;

declare_id!("9sk8X11GWtZjzXWfkcLMRD6tmuhmiBKgMXsmx9bEh5YQ");

#[program]
pub mod aerospacer_protocol {
    use super::*;

    // Initialize the protocol (equivalent to INJECTIVE's instantiate)
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    // Update protocol addresses (admin only)
    pub fn update_protocol_addresses(ctx: Context<UpdateProtocolAddresses>, params: UpdateProtocolAddressesParams) -> Result<()> {
        instructions::update_protocol_addresses::handler(ctx, params)
    }

    // Transfer stablecoins between accounts
    pub fn transfer_stablecoin(ctx: Context<TransferStablecoin>, params: TransferStablecoinParams) -> Result<()> {
        instructions::transfer_stablecoin::handler(ctx, params)
    }

    // Open a trove by depositing collateral (equivalent to INJECTIVE's open_trove)
    pub fn open_trove(ctx: Context<OpenTrove>, params: OpenTroveParams) -> Result<()> {
        instructions::open_trove::handler(ctx, params)
    }

    // Add collateral to an existing trove (equivalent to INJECTIVE's add_collateral)
    pub fn add_collateral(ctx: Context<AddCollateral>, params: AddCollateralParams) -> Result<()> {
        instructions::add_collateral::handler(ctx, params)
    }

    // Remove collateral from an existing trove (equivalent to INJECTIVE's remove_collateral)
    pub fn remove_collateral(ctx: Context<RemoveCollateral>, params: RemoveCollateralParams) -> Result<()> {
        instructions::remove_collateral::handler(ctx, params)
    }

    // Borrow stablecoin from an existing trove (equivalent to INJECTIVE's borrow_loan)
    pub fn borrow_loan(ctx: Context<BorrowLoan>, params: BorrowLoanParams) -> Result<()> {
        instructions::borrow_loan::handler(ctx, params)
    }

    // Repay stablecoin to an existing trove (equivalent to INJECTIVE's repay_loan)
    pub fn repay_loan(ctx: Context<RepayLoan>, params: RepayLoanParams) -> Result<()> {
        instructions::repay_loan::handler(ctx, params)
    }

    // Close trove by repaying all debt and withdrawing all collateral (equivalent to INJECTIVE's close_trove)
    pub fn close_trove(ctx: Context<CloseTrove>, params: CloseTroveParams) -> Result<()> {
        instructions::close_trove::handler(ctx, params)
    }

    // Liquidate undercollateralized troves (equivalent to INJECTIVE's liquidate_troves)
    pub fn liquidate_troves(ctx: Context<LiquidateTroves>, params: LiquidateTrovesParams) -> Result<()> {
        instructions::liquidate_troves::handler(ctx, params)
    }

    // Liquidate a single undercollateralized trove (no remaining_accounts)
    pub fn liquidate_trove(ctx: Context<LiquidateTrove>, params: LiquidateTroveParams) -> Result<()> {
        instructions::liquidate_trove::handler(ctx, params)
    }

    // Query liquidatable troves (read-only helper for finding troves with ICR < threshold)
    pub fn query_liquidatable_troves(ctx: Context<QueryLiquidatableTroves>, params: QueryLiquidatableTrovesParams) -> Result<()> {
        instructions::query_liquidatable_troves::handler(ctx, params)
    }

    // Stake stablecoin to earn liquidation gains (equivalent to INJECTIVE's stake)
    pub fn stake(ctx: Context<Stake>, params: StakeParams) -> Result<()> {
        instructions::stake::handler(ctx, params)
    }

    // Unstake stablecoin (equivalent to INJECTIVE's unstake)
    pub fn unstake(ctx: Context<Unstake>, params: UnstakeParams) -> Result<()> {
        instructions::unstake::handler(ctx, params)
    }

    // Withdraw collateral from liquidation gains (equivalent to INJECTIVE's withdraw_liquidation_gains)
    pub fn withdraw_liquidation_gains(ctx: Context<WithdrawLiquidationGains>, params: WithdrawLiquidationGainsParams) -> Result<()> {
        instructions::withdraw_liquidation_gains::handler(ctx, params)
    }

    // Swap stablecoin for collateral (equivalent to INJECTIVE's redeem)
    pub fn redeem(ctx: Context<Redeem>, params: RedeemParams) -> Result<()> {
        instructions::redeem::handler(ctx, params)
    }

    // NOTE: ADMIN functions removed - obsolete with off-chain sorting architecture
    // - reset_sorted_troves: No longer needed (no sorted list state to reset)
    // - close_node: No longer needed (no Node accounts to close)
}