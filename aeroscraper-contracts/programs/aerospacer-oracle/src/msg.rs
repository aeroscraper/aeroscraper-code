use anchor_lang::prelude::*;

// Initialize message - matches INJECTIVE's InstantiateMsg
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeMsg {
    pub oracle_address: Pubkey,
}

// Execute messages - matches INJECTIVE's ExecuteMsg enum
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateOracleAddressMsg {
    pub oracle_address: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SetDataMsg {
    pub data: CollateralData,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SetDataBatchMsg {
    pub data: Vec<CollateralData>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RemoveDataMsg {
    pub collateral_denom: String,
}

// Pyth-specific message
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdatePythPriceMsg {
    pub denom: String,
}

// Query messages - matches INJECTIVE's QueryMsg enum
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct GetPriceMsg {
    pub denom: String,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct GetConfigMsg {
    // No parameters needed
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct GetAllDenomsMsg {
    // No parameters needed
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct GetPriceIdMsg {
    pub denom: String,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct GetAllPricesMsg {
    // No parameters needed
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CheckDenomMsg {
    pub denom: String,
}

// Import CollateralData from state module
use crate::state::CollateralData;