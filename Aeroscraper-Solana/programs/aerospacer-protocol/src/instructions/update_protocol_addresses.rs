use anchor_lang::prelude::*;
use crate::state::StateAccount;
use crate::error::AerospacerProtocolError;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct UpdateProtocolAddressesParams {
    pub oracle_helper_addr: Option<Pubkey>,
    pub oracle_state_addr: Option<Pubkey>,
    pub fee_distributor_addr: Option<Pubkey>,
    pub fee_state_addr: Option<Pubkey>,
}

#[derive(Accounts)]
pub struct UpdateProtocolAddresses<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"state"],
        bump,
        constraint = state.admin == admin.key() @ AerospacerProtocolError::Unauthorized
    )]
    pub state: Account<'info, StateAccount>,
}

pub fn handler(ctx: Context<UpdateProtocolAddresses>, params: UpdateProtocolAddressesParams) -> Result<()> {
    let state = &mut ctx.accounts.state;
    
    if let Some(addr) = params.oracle_helper_addr {
        state.oracle_helper_addr = addr;
        msg!("Oracle helper address updated: {}", addr);
    }
    
    if let Some(addr) = params.oracle_state_addr {
        state.oracle_state_addr = addr;
        msg!("Oracle state address updated: {}", addr);
    }
    
    if let Some(addr) = params.fee_distributor_addr {
        state.fee_distributor_addr = addr;
        msg!("Fee distributor address updated: {}", addr);
    }
    
    if let Some(addr) = params.fee_state_addr {
        state.fee_state_addr = addr;
        msg!("Fee state address updated: {}", addr);
    }
    
    Ok(())
}
