use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
pub struct GetConfig<'info> {
    #[account(
        seeds = [b"fee_state"],
        bump
    )]
    pub state: Account<'info, FeeStateAccount>,
}

pub fn handler(ctx: Context<GetConfig>) -> Result<ConfigResponse> {
    let state = &ctx.accounts.state;
    
    let response = ConfigResponse {
        admin: state.admin,
        is_stake_enabled: state.is_stake_enabled,
        stake_contract_address: state.stake_contract_address,
        fee_address_1: state.fee_address_1,
        fee_address_2: state.fee_address_2,
        total_fees_collected: state.total_fees_collected,
    };
    
    msg!("Fee distributor config retrieved successfully");
    msg!("Admin: {}", response.admin);
    msg!("Stake enabled: {}", response.is_stake_enabled);
    msg!("Fee Address 1: {}", response.fee_address_1);
    msg!("Fee Address 2: {}", response.fee_address_2);
    msg!("Total fees collected: {}", response.total_fees_collected);
    
    Ok(response)
} 