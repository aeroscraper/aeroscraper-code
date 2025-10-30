use anchor_lang::prelude::*;

// Default fee addresses for Solana (following INJECTIVE project pattern)
// FEE_ADDR_1: Protocol Treasury/Development Fund
// FEE_ADDR_2: Validator Rewards/Staking Pool
pub const DEFAULT_FEE_ADDR_1: &str = "8Lv4UrYHTrzvg9jPVVGNmxWyMrMvrZnCQLWucBzfJyyR";
pub const DEFAULT_FEE_ADDR_2: &str = "GcNwV1nA5bityjNYsWwPLHykpKuuhPzK1AQFBbrPopnX";

#[account]
pub struct FeeStateAccount {
    pub admin: Pubkey,                    // 32 bytes
    pub is_stake_enabled: bool,           // 1 byte
    pub stake_contract_address: Pubkey,   // 32 bytes
    pub fee_address_1: Pubkey,            // 32 bytes - NEW
    pub fee_address_2: Pubkey,            // 32 bytes - NEW
    pub total_fees_collected: u64,        // 8 bytes
}

impl FeeStateAccount {
    pub const LEN: usize = 32 + 1 + 32 + 32 + 32 + 8; // Updated to include fee addresses
    
    /// Get the seeds for the fee state PDA
    pub fn seeds() -> [&'static [u8]; 1] {
        [b"fee_state"]
    }
    
    /// Derive the fee state PDA
    pub fn get_pda(program_id: &Pubkey) -> (Pubkey, u8) {
        Pubkey::find_program_address(&Self::seeds(), program_id)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ConfigResponse {
    pub admin: Pubkey,
    pub is_stake_enabled: bool,
    pub stake_contract_address: Pubkey,
    pub fee_address_1: Pubkey,            // NEW
    pub fee_address_2: Pubkey,            // NEW
    pub total_fees_collected: u64,
} 