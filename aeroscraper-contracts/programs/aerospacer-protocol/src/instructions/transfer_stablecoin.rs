use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, transfer};
use crate::state::StateAccount;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TransferStablecoinParams {
    pub amount: u64,
}

#[derive(Accounts)]
pub struct TransferStablecoin<'info> {
    #[account(mut)]
    pub from: Signer<'info>,
    
    #[account(
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, StateAccount>,
    
    #[account(
        mut,
        constraint = from_account.owner == from.key(),
        constraint = from_account.mint == state.stable_coin_addr
    )]
    pub from_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = to_account.mint == state.stable_coin_addr
    )]
    pub to_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<TransferStablecoin>, params: TransferStablecoinParams) -> Result<()> {
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.from_account.to_account_info(),
            to: ctx.accounts.to_account.to_account_info(),
            authority: ctx.accounts.from.to_account_info(),
        },
    );
    
    transfer(transfer_ctx, params.amount)?;
    
    msg!("Transferred {} stablecoins", params.amount);
    Ok(())
}
