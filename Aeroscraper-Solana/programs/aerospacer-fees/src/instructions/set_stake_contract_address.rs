use anchor_lang::prelude::*;
use crate::state::FeeStateAccount;
use crate::error::AerospacerFeesError;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SetStakeContractAddressParams {
    pub address: String,
}

#[derive(Accounts)]
#[instruction(params: SetStakeContractAddressParams)]
pub struct SetStakeContractAddress<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"fee_state"],
        bump,
        constraint = state.admin == admin.key() @ AerospacerFeesError::Unauthorized
    )]
    pub state: Account<'info, FeeStateAccount>,
}

pub fn handler(ctx: Context<SetStakeContractAddress>, params: SetStakeContractAddressParams) -> Result<()> {
    let state = &mut ctx.accounts.state;
    
    let stake_contract_address = match Pubkey::try_from(params.address.as_str()) {
        Ok(pubkey) => pubkey,
        Err(_) => return Err(AerospacerFeesError::InvalidAddress.into()),
    };
    
    state.stake_contract_address = stake_contract_address;
    
    msg!("Stake contract address set successfully");
    msg!("New address: {}", stake_contract_address);
    
    Ok(())
}
