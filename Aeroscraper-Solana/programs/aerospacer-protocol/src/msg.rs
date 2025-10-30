use anchor_lang::prelude::*;

// Exact replication of INJECTIVE msg.rs
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InstantiateMsg {
    pub stable_coin_code_id: u64,
    pub oracle_helper_addr: Pubkey, // String in Injective, Pubkey in Solana
    pub fee_distributor_addr: Pubkey, // String in Injective, Pubkey in Solana (aerospacer-fees program ID)
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum ExecuteMsg {
    // Open a trove by depositing collateral
    OpenTrove {
        loan_amount: u64, // Equivalent to Uint256
        prev_node_id: Option<Pubkey>, // String in Injective, Pubkey in Solana
        next_node_id: Option<Pubkey>, // String in Injective, Pubkey in Solana
    },
    // Add collateral to an existing trove
    AddCollateral {
        prev_node_id: Option<Pubkey>,
        next_node_id: Option<Pubkey>,
    },
    // Remove collateral from an existing trove
    RemoveCollateral {
        collateral_amount: u64, // Equivalent to Uint256
        collateral_denom: String,
        prev_node_id: Option<Pubkey>,
        next_node_id: Option<Pubkey>,
    },
    // Borrow stable coin from an existing trove
    BorrowLoan {
        loan_amount: u64, // Equivalent to Uint256
        prev_node_id: Option<Pubkey>,
        next_node_id: Option<Pubkey>,
    },
    // Unstake stable coin
    Unstake {
        amount: u64, // Equivalent to Uint256
    },
    // Liquidate troves
    LiquidateTroves {
        liquidation_list: Vec<Pubkey>, // Vec<String> in Injective, Vec<Pubkey> in Solana
    },
    // Withdraw collateral from liquidation gains
    WithdrawLiquidationGains {},
    // Set the minimum collateral ratio
    SetMinimumCollateralRatio {
        ratio: u8,
    },
    // Set the protocol fee
    SetProtocolFee {
        fee: u8,
    },
    // Receive message for CW20 contract (simulated by a direct instruction in Solana)
    // This variant is removed as Solana handles token transfers differently.
    // Receive(Cw20ReceiveMsg),
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum QueryMsg {
    Config {},
    TotalCollateralAmounts {},
    TotalDebtAmount {},
    // Get current trove for the user
    Trove { user_addr: Pubkey }, // String in Injective, Pubkey in Solana
    // Get the total amount of stablecoin staked
    TotalStakeAmount {},
    // Get current stake for the user
    Stake { user_addr: Pubkey }, // String in Injective, Pubkey in Solana
    // Get liquidation gains
    LiquidationGains { user_addr: Pubkey }, // String in Injective, Pubkey in Solana
    // Linked list messages
    FindSortedTroveInsertPosition {
        icr: u64, // Equivalent to Decimal256
        prev_node_id: Option<Pubkey>, // String in Injective, Pubkey in Solana
        next_node_id: Option<Pubkey>, // String in Injective, Pubkey in Solana
    },
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ConfigResponse {
    pub admin: Pubkey,
    pub oracle_helper_addr: Pubkey,
    pub fee_distributor_addr: Pubkey,
    pub minimum_collateral_ratio: u8,
    pub protocol_fee: u8,
    pub stable_coin_addr: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CollateralAmountResponse {
    pub denom: String,
    pub amount: u64, // Equivalent to Uint256
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TroveResponse {
    pub collateral_amounts: Vec<CollateralAmountResponse>,
    pub debt_amount: u64, // Equivalent to Uint256
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct StakeResponse {
    pub amount: u64, // Equivalent to Uint256
    pub percentage: u64, // Equivalent to Decimal256
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct FindSortedTroveInsertPositionResponse {
    pub prev_node_id: Option<Pubkey>,
    pub next_node_id: Option<Pubkey>,
}