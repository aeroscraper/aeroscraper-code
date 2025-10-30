use anchor_lang::prelude::*;
use crate::state::FeeStateAccount;
use crate::error::AerospacerFeesError;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SetFeeAddressesParams {
    pub fee_address_1: String,
    pub fee_address_2: String,
}

#[derive(Accounts)]
#[instruction(params: SetFeeAddressesParams)]
pub struct SetFeeAddresses<'info> {
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

pub fn handler(ctx: Context<SetFeeAddresses>, params: SetFeeAddressesParams) -> Result<()> {
    let state = &mut ctx.accounts.state;
    
    // Validate and parse fee address 1
    let fee_address_1 = match Pubkey::try_from(params.fee_address_1.as_str()) {
        Ok(pubkey) => pubkey,
        Err(_) => return Err(AerospacerFeesError::InvalidAddress.into()),
    };
    
    // Validate and parse fee address 2
    let fee_address_2 = match Pubkey::try_from(params.fee_address_2.as_str()) {
        Ok(pubkey) => pubkey,
        Err(_) => return Err(AerospacerFeesError::InvalidAddress.into()),
    };
    
    // Ensure fee addresses are different
    require!(
        fee_address_1 != fee_address_2,
        AerospacerFeesError::InvalidAddress
    );
    
    // Update fee addresses
    state.fee_address_1 = fee_address_1;
    state.fee_address_2 = fee_address_2;
    
    msg!("Fee addresses updated successfully");
    msg!("New Fee Address 1: {}", state.fee_address_1);
    msg!("New Fee Address 2: {}", state.fee_address_2);
    
    Ok(())
}
