use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, Mint};
use crate::state::*;
use crate::utils::*;
use crate::error::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct WithdrawLiquidationGainsParams {
    pub collateral_denom: String,
}

#[derive(Accounts)]
#[instruction(params: WithdrawLiquidationGainsParams)]
pub struct WithdrawLiquidationGains<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"user_stake_amount", user.key().as_ref()],
        bump,
        constraint = user_stake_amount.owner == user.key() @ AerospacerProtocolError::Unauthorized
    )]
    pub user_stake_amount: Account<'info, UserStakeAmount>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserCollateralSnapshot::LEN,
        seeds = [b"user_collateral_snapshot", user.key().as_ref(), params.collateral_denom.as_bytes()],
        bump
    )]
    pub user_collateral_snapshot: Account<'info, UserCollateralSnapshot>,

    #[account(
        mut,
        seeds = [b"stability_pool_snapshot", params.collateral_denom.as_bytes()],
        bump
    )]
    pub stability_pool_snapshot: Account<'info, StabilityPoolSnapshot>,

    #[account(mut)]
    pub state: Account<'info, StateAccount>,

    #[account(mut)]
    pub user_collateral_account: Account<'info, TokenAccount>,

    /// Collateral mint for validation
    pub collateral_mint: Account<'info, Mint>,

    /// CHECK: Protocol collateral vault PDA (stability pool)
    #[account(
        mut,
        seeds = [b"protocol_collateral_vault", params.collateral_denom.as_bytes()],
        bump
    )]
    pub protocol_collateral_vault: AccountInfo<'info>,

    /// CHECK: Per-denom collateral total PDA
    #[account(
        mut,
        seeds = [b"total_collateral_amount", params.collateral_denom.as_bytes()],
        bump
    )]
    pub total_collateral_amount: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}



pub fn handler(ctx: Context<WithdrawLiquidationGains>, params: WithdrawLiquidationGainsParams) -> Result<()> {
    let user_stake_amount = &mut ctx.accounts.user_stake_amount;
    let user_collateral_snapshot = &mut ctx.accounts.user_collateral_snapshot;
    let stability_pool_snapshot = &ctx.accounts.stability_pool_snapshot;
    let _state = &mut ctx.accounts.state;
    
    // SECURITY: Validate user has stake
    require!(
        user_stake_amount.amount > 0,
        AerospacerProtocolError::InvalidAmount
    );
    
    // SECURITY: Verify stability_pool_snapshot is owned by this program
    require!(
        stability_pool_snapshot.to_account_info().owner == &crate::ID,
        AerospacerProtocolError::InvalidList
    );
    
    // SECURITY: Verify total_collateral_amount PDA is authentic
    let (expected_total_coll_pda, _bump) = Pubkey::find_program_address(
        &[b"total_collateral_amount", params.collateral_denom.as_bytes()],
        &crate::ID,
    );
    require!(
        expected_total_coll_pda == *ctx.accounts.total_collateral_amount.key,
        AerospacerProtocolError::InvalidList
    );
    require!(
        ctx.accounts.total_collateral_amount.owner == &crate::ID,
        AerospacerProtocolError::InvalidList
    );
    
    // SECURITY: Validate user_collateral_account belongs to user and matches collateral mint
    require!(
        ctx.accounts.user_collateral_account.owner == ctx.accounts.user.key(),
        AerospacerProtocolError::Unauthorized
    );
    require!(
        ctx.accounts.user_collateral_account.mint == ctx.accounts.collateral_mint.key(),
        AerospacerProtocolError::InvalidMint
    );
    
    // SNAPSHOT ALGORITHM: Calculate collateral gain using Product-Sum formula
    // gain = initial_deposit × (S_current - S_snapshot) / P_snapshot
    
    // Initialize or validate S snapshot metadata
    let is_first_withdrawal = user_collateral_snapshot.s_snapshot == 0 
        && user_collateral_snapshot.owner == Pubkey::default();
    
    if is_first_withdrawal {
        // First-time initialization
        user_collateral_snapshot.owner = ctx.accounts.user.key();
        user_collateral_snapshot.denom = params.collateral_denom.clone();
        user_collateral_snapshot.pending_collateral_gain = 0;
        msg!("First withdrawal for {} - calculating full accumulated gains", params.collateral_denom);
    } else {
        // SECURITY: Validate existing snapshot belongs to user and matches denom
        require!(
            user_collateral_snapshot.owner == ctx.accounts.user.key(),
            AerospacerProtocolError::Unauthorized
        );
        require!(
            user_collateral_snapshot.denom == params.collateral_denom,
            AerospacerProtocolError::InvalidList
        );
    }
    
    // Calculate collateral gain using helper function
    // If s_snapshot = 0 (first withdrawal), this calculates the full accumulated gain
    let collateral_gain = calculate_collateral_gain(
        user_stake_amount.amount,
        user_collateral_snapshot.s_snapshot, // 0 on first withdrawal = full gain
        stability_pool_snapshot.s_factor,
        user_stake_amount.p_snapshot,
    )?;
    
    // Check if user has any gains
    if collateral_gain == 0 {
        msg!("No collateral gains available for {}", params.collateral_denom);
        return Ok(());
    }
    
    msg!("SNAPSHOT-BASED WITHDRAWAL:");
    msg!("  User deposit: {}", user_stake_amount.amount);
    msg!("  P_snapshot: {}", user_stake_amount.p_snapshot);
    msg!("  S_snapshot ({}): {}", params.collateral_denom, user_collateral_snapshot.s_snapshot);
    msg!("  S_current ({}): {}", params.collateral_denom, stability_pool_snapshot.s_factor);
    msg!("  Calculated gain: {}", collateral_gain);
    
    // SECURITY: Verify protocol vault has sufficient balance before transfer
    let vault_data = ctx.accounts.protocol_collateral_vault.try_borrow_data()?;
    let vault_account = TokenAccount::try_deserialize(&mut &vault_data[..])?;
    require!(
        vault_account.amount >= collateral_gain,
        AerospacerProtocolError::InsufficientCollateral
    );
    drop(vault_data);
    
    // Transfer collateral gain from stability pool vault to user
    let transfer_seeds = &[
        b"protocol_collateral_vault".as_ref(),
        params.collateral_denom.as_bytes(),
        &[ctx.bumps.protocol_collateral_vault],
    ];
    let transfer_signer = &[&transfer_seeds[..]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.protocol_collateral_vault.to_account_info(),
            to: ctx.accounts.user_collateral_account.to_account_info(),
            authority: ctx.accounts.protocol_collateral_vault.to_account_info(),
        },
        transfer_signer,
    );
    anchor_spl::token::transfer(transfer_ctx, collateral_gain)?;

    // Update user's S snapshot to current value (marks gains as claimed)
    user_collateral_snapshot.s_snapshot = stability_pool_snapshot.s_factor;

    // Update per-denom collateral total PDA
    update_total_collateral_from_account_info(
        &ctx.accounts.total_collateral_amount,
        -(collateral_gain as i64),
    )?;

    msg!("Liquidation gains withdrawn successfully (snapshot-based)");
    msg!("Amount: {} {}", collateral_gain, params.collateral_denom);
    msg!("User: {}", ctx.accounts.user.key());
    msg!("S snapshot updated to: {}", stability_pool_snapshot.s_factor);

    Ok(())
}