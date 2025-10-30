use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;
pub mod msg;

use instructions::*;
use crate::state::{PriceResponse, ConfigResponse, OracleStateAccount};

declare_id!("8zG12srZdYaJPjWzCAJhwyxF7wWTz5spbmehxWpV5Q9M");

/// Aerospacer Oracle Program
/// 
/// This program provides real-time price feeds for collateral assets in the Aeroscraper protocol.
/// It integrates with Pyth Network to fetch accurate, up-to-date price data and manages
/// collateral asset configuration for the lending protocol.
/// 
/// This program completely replicates the INJECTIVE oracle contract functionality for Solana
/// with full Pyth Network integration using the official SDK.
#[program]
pub mod aerospacer_oracle {
    use super::*;

    /// Initialize the oracle program with admin and oracle provider address
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize::handler(ctx, params)
    }

    /// Update the external oracle provider address (admin only)
    pub fn update_oracle_address(ctx: Context<UpdateOracleAddress>, params: UpdateOracleAddressParams) -> Result<()> {
        instructions::update_oracle_address::handler(ctx, params)
    }

    /// Set configuration for a single collateral asset (admin only)
    pub fn set_data(ctx: Context<SetData>, params: SetDataParams) -> Result<()> {
        instructions::set_data::handler(ctx, params)
    }

    /// Set configuration for multiple collateral assets in batch (admin only)
    pub fn set_data_batch(ctx: Context<SetDataBatch>, params: SetDataBatchParams) -> Result<()> {
        instructions::set_data_batch::handler(ctx, params)
    }

    /// Remove support for a collateral asset (admin only)
    pub fn remove_data(ctx: Context<RemoveData>, params: RemoveDataParams) -> Result<()> {
        instructions::remove_data::handler(ctx, params)
    }

    /// Get real-time price for a specific collateral asset using Pyth SDK
    pub fn get_price(ctx: Context<GetPrice>, params: GetPriceParams) -> Result<PriceResponse> {
        instructions::get_price::handler(ctx, params)
    }

    /// Get configuration information (admin, oracle address, asset count, last update)
    pub fn get_config(ctx: Context<GetConfig>, params: GetConfigParams) -> Result<ConfigResponse> {
        instructions::get_config::handler(ctx, params)
    }

    /// Get all supported asset denominations
    pub fn get_all_denoms(ctx: Context<GetAllDenoms>, params: GetAllDenomsParams) -> Result<Vec<String>> {
        instructions::get_all_denoms::handler(ctx, params)
    }

    /// Get price ID for a specific asset denomination
    pub fn get_price_id(ctx: Context<GetPriceId>, params: GetPriceIdParams) -> Result<String> {
        instructions::get_price_id::handler(ctx, params)
    }

    /// Get real-time prices for ALL supported collateral assets using Pyth SDK
    pub fn get_all_prices(ctx: Context<GetAllPrices>, params: GetAllPricesParams) -> Result<Vec<PriceResponse>> {
        instructions::get_all_prices::handler(ctx, params)
    }

    /// Check if a specific asset denomination is supported
    pub fn check_denom(ctx: Context<CheckDenom>, params: CheckDenomParams) -> Result<bool> {
        instructions::check_denom::handler(ctx, params)
    }

    /// Update Pyth price feed for a specific asset (admin only)
    pub fn update_pyth_price(ctx: Context<UpdatePythPrice>, params: UpdatePythPriceParams) -> Result<()> {
        instructions::update_pyth_price::handler(ctx, params)
    }
}

/// Helper functions for PDA derivation
pub mod utils {
    use super::*;
    
    /// Get the oracle state PDA
    pub fn get_oracle_state_pda() -> (Pubkey, u8) {
        OracleStateAccount::get_pda(&crate::ID)
    }
    
    /// Get the oracle state PDA seeds
    pub fn get_oracle_state_seeds() -> [&'static [u8]; 1] {
        OracleStateAccount::seeds()
    }
}