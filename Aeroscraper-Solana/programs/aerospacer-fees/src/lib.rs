use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

use instructions::*;
use crate::state::{ConfigResponse, FeeStateAccount};
use crate::instructions::distribute_fee::DistributeFeeParams;
use crate::instructions::set_fee_addresses::SetFeeAddressesParams;

declare_id!("AHmGKukQky3mDHLmFyJYcEaFub69vp2QqeSW7EbVpJjZ");

#[program]
pub mod aerospacer_fees {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    pub fn toggle_stake_contract(ctx: Context<ToggleStakeContract>) -> Result<()> {
        instructions::toggle_stake_contract::handler(ctx)
    }

    pub fn set_stake_contract_address(ctx: Context<SetStakeContractAddress>, params: SetStakeContractAddressParams) -> Result<()> {
        instructions::set_stake_contract_address::handler(ctx, params)
    }

    pub fn set_fee_addresses(ctx: Context<SetFeeAddresses>, params: SetFeeAddressesParams) -> Result<()> {
        instructions::set_fee_addresses::handler(ctx, params)
    }

    pub fn distribute_fee(ctx: Context<DistributeFee>, params: DistributeFeeParams) -> Result<()> {
        instructions::distribute_fee::handler(ctx, params)
    }

    pub fn get_config(ctx: Context<GetConfig>) -> Result<ConfigResponse> {
        instructions::get_config::handler(ctx)
    }
}

/// Helper functions for PDA derivation
pub mod utils {
    use super::*;
    
    /// Get the fee state PDA
    pub fn get_fee_state_pda() -> (Pubkey, u8) {
        FeeStateAccount::get_pda(&crate::ID)
    }
    
    /// Get the fee state PDA seeds
    pub fn get_fee_state_seeds() -> [&'static [u8]; 1] {
        FeeStateAccount::seeds()
    }
} 