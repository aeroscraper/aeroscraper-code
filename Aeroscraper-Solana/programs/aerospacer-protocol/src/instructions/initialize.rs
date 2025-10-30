use anchor_lang::prelude::*;
use crate::state::*;
use anchor_spl::token::{Token, SetAuthority, set_authority, spl_token::instruction::AuthorityType};

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeParams {
    pub stable_coin_code_id: u64,
    pub oracle_helper_addr: Pubkey,
    pub oracle_state_addr: Pubkey,
    pub fee_distributor_addr: Pubkey,
    pub fee_state_addr: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: InitializeParams)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + StateAccount::LEN,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, StateAccount>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    /// CHECK: This is the stable coin mint account
    #[account(mut)]
    pub stable_coin_mint: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
    let state = &mut ctx.accounts.state;
    
    // Initialize state exactly like INJECTIVE's instantiate
    state.admin = ctx.accounts.admin.key();
    state.stable_coin_addr = ctx.accounts.stable_coin_mint.key();
    state.oracle_helper_addr = params.oracle_helper_addr;
    state.oracle_state_addr = params.oracle_state_addr;
    state.fee_distributor_addr = params.fee_distributor_addr;
    state.fee_state_addr = params.fee_state_addr;
    state.minimum_collateral_ratio = DEFAULT_MINIMUM_COLLATERAL_RATIO; // 115%
    state.protocol_fee = DEFAULT_PROTOCOL_FEE; // 5%
    state.total_debt_amount = 0;
    state.total_stake_amount = 0;
    
    // SNAPSHOT: Initialize P factor and epoch for Liquity Product-Sum algorithm
    state.p_factor = StateAccount::SCALE_FACTOR; // 10^18
    state.epoch = 0;
    
    // Move mint authority for the stable coin mint to the protocol PDA (protocol_stablecoin_vault)
    // This matches Injective's model where the protocol contract is the minter.
    let (protocol_stablecoin_vault_pda, _bump) = Pubkey::find_program_address(
        &[b"protocol_stablecoin_vault"],
        &crate::ID,
    );

    // Current authority is the admin who created the mint on devnet
    let set_auth_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        SetAuthority {
            account_or_mint: ctx.accounts.stable_coin_mint.to_account_info(),
            current_authority: ctx.accounts.admin.to_account_info(),
        },
    );
    set_authority(
        set_auth_ctx,
        AuthorityType::MintTokens,
        Some(protocol_stablecoin_vault_pda),
    )?;

    msg!("Stablecoin mint authority set to protocol PDA: {}", protocol_stablecoin_vault_pda);
    
    msg!("Aerospacer Protocol initialized successfully");
    msg!("Admin: {}", state.admin);
    msg!("Stable Coin: {}", state.stable_coin_addr);
    msg!("Oracle Helper: {}", state.oracle_helper_addr);
    msg!("Oracle State: {}", state.oracle_state_addr);
    msg!("Fee Distributor: {}", state.fee_distributor_addr);
    msg!("Fee State: {}", state.fee_state_addr);
    msg!("Minimum Collateral Ratio: {}%", state.minimum_collateral_ratio);
    msg!("Protocol Fee: {}%", state.protocol_fee);
    msg!("P factor initialized: {}", state.p_factor);
    msg!("Epoch initialized: {}", state.epoch);
    
    Ok(())
} 