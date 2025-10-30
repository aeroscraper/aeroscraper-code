use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer, Burn};
use crate::state::*;
use crate::error::*;
use crate::fees_integration::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RedeemParams {
    pub amount: u64, // Equivalent to Uint256
    pub collateral_denom: String, // Which collateral to redeem (SOL, ETH, BTC, etc.)
    // NOTE: prev_node_id and next_node_id removed - using off-chain sorted list architecture
}

#[derive(Accounts)]
#[instruction(params: RedeemParams)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub state: Box<Account<'info, StateAccount>>,

    #[account(
        mut,
        seeds = [b"user_debt_amount", user.key().as_ref()],
        bump,
        constraint = user_debt_amount.owner == user.key() @ AerospacerProtocolError::Unauthorized
    )]
    pub user_debt_amount: Box<Account<'info, UserDebtAmount>>,

    #[account(
        mut,
        seeds = [b"liquidity_threshold", user.key().as_ref()],
        bump,
        constraint = liquidity_threshold.owner == user.key() @ AerospacerProtocolError::Unauthorized
    )]
    pub liquidity_threshold: Box<Account<'info, LiquidityThreshold>>,

    #[account(
        mut,
        constraint = user_stablecoin_account.owner == user.key() @ AerospacerProtocolError::Unauthorized
    )]
    pub user_stablecoin_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"user_collateral_amount", user.key().as_ref(), params.collateral_denom.as_bytes()],
        bump,
        constraint = user_collateral_amount.owner == user.key() @ AerospacerProtocolError::Unauthorized
    )]
    pub user_collateral_amount: Box<Account<'info, UserCollateralAmount>>,

    #[account(
        mut,
        constraint = user_collateral_account.owner == user.key() @ AerospacerProtocolError::Unauthorized
    )]
    pub user_collateral_account: Box<Account<'info, TokenAccount>>,

    /// CHECK: Protocol stablecoin vault PDA
    #[account(
        mut,
        seeds = [b"protocol_stablecoin_vault"],
        bump
    )]
    pub protocol_stablecoin_vault: AccountInfo<'info>,

    /// CHECK: Protocol collateral vault PDA
    #[account(
        mut,
        seeds = [b"protocol_collateral_vault", params.collateral_denom.as_bytes()],
        bump
    )]
    pub protocol_collateral_vault: AccountInfo<'info>,

    /// CHECK: This is the stable coin mint account
    #[account(
        mut,
        constraint = stable_coin_mint.key() == state.stable_coin_addr @ AerospacerProtocolError::InvalidMint
    )]
    pub stable_coin_mint: UncheckedAccount<'info>,

    /// CHECK: Per-denom collateral total PDA
    #[account(
        mut,
        seeds = [b"total_collateral_amount", params.collateral_denom.as_bytes()],
        bump
    )]
    pub total_collateral_amount: AccountInfo<'info>,

    // Oracle context - integration with our aerospacer-oracle
    /// CHECK: Our oracle program - validated against state
    #[account(
        mut,
        constraint = oracle_program.key() == state.oracle_helper_addr @ AerospacerProtocolError::Unauthorized
    )]
    pub oracle_program: AccountInfo<'info>,
    
    /// CHECK: Oracle state account - validated against state
    #[account(
        mut,
        constraint = oracle_state.key() == state.oracle_state_addr @ AerospacerProtocolError::Unauthorized
    )]
    pub oracle_state: AccountInfo<'info>,

    // Fee distribution accounts
    /// CHECK: Fees program - validated against state
    #[account(
        constraint = fees_program.key() == state.fee_distributor_addr @ AerospacerProtocolError::Unauthorized
    )]
    pub fees_program: AccountInfo<'info>,
    
    /// CHECK: Fees state account - validated against state
    #[account(
        mut,
        constraint = fees_state.key() == state.fee_state_addr @ AerospacerProtocolError::Unauthorized
    )]
    pub fees_state: AccountInfo<'info>,
    
    /// CHECK: Stability pool token account
    #[account(mut)]
    pub stability_pool_token_account: AccountInfo<'info>,
    
    /// CHECK: Fee address 1 token account
    #[account(mut)]
    pub fee_address_1_token_account: AccountInfo<'info>,
    
    /// CHECK: Fee address 2 token account
    #[account(mut)]
    pub fee_address_2_token_account: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Redeem>, params: RedeemParams) -> Result<()> {
    // PRODUCTION VALIDATION: Input parameter checks
    require!(
        params.amount > 0,
        AerospacerProtocolError::InvalidAmount
    );
    
    require!(
        params.amount >= MINIMUM_LOAN_AMOUNT,
        AerospacerProtocolError::InvalidAmount
    );
    
    require!(
        !params.collateral_denom.is_empty(),
        AerospacerProtocolError::InvalidAmount
    );
    
    // Store protocol fee before creating mutable borrow
    let protocol_fee = ctx.accounts.state.protocol_fee;
    
    let state = &mut ctx.accounts.state;
    
    // Validate redemption amount against total system debt
    require!(
        params.amount <= state.total_debt_amount,
        AerospacerProtocolError::NotEnoughLiquidityForRedeem
    );
    
    // NOTE: Sorted list validation removed - using off-chain sorting architecture
    // Client must provide pre-sorted target list via remainingAccounts
    
    // Validate user has enough stablecoins (including fee)
    require!(
        ctx.accounts.user_stablecoin_account.amount >= params.amount,
        AerospacerProtocolError::InvalidAmount
    );
    
    // Collect redemption fee via CPI to aerospacer-fees
    // This returns the net amount after fee deduction
    let net_redemption_amount = process_protocol_fee(
        params.amount,
        protocol_fee,
        ctx.accounts.fees_program.to_account_info(),
        ctx.accounts.user.to_account_info(),
        ctx.accounts.fees_state.to_account_info(),
        ctx.accounts.user_stablecoin_account.to_account_info(),
        ctx.accounts.stability_pool_token_account.to_account_info(),
        ctx.accounts.fee_address_1_token_account.to_account_info(),
        ctx.accounts.fee_address_2_token_account.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
    )?;
    
    let fee_amount = params.amount.saturating_sub(net_redemption_amount);
    msg!("Redemption fee: {} aUSD ({}%)", fee_amount, protocol_fee);
    msg!("Net redemption amount: {} aUSD", net_redemption_amount);
    
    // Transfer NET redemption amount from user to protocol (after fee deduction)
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_stablecoin_account.to_account_info(),
            to: ctx.accounts.protocol_stablecoin_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    anchor_spl::token::transfer(transfer_ctx, net_redemption_amount)?;

    // Burn NET redemption amount (not including fee)
    // Use invoke_signed for PDA authority
    let burn_seeds = &[
        b"protocol_stablecoin_vault".as_ref(),
        &[ctx.bumps.protocol_stablecoin_vault],
    ];
    let burn_signer = &[&burn_seeds[..]];
    
    let burn_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.stable_coin_mint.to_account_info(),
            from: ctx.accounts.protocol_stablecoin_vault.to_account_info(),
            authority: ctx.accounts.protocol_stablecoin_vault.to_account_info(),
        },
        burn_signer,
    );
    anchor_spl::token::burn(burn_ctx, net_redemption_amount)?;

    // NEW ARCHITECTURE: Core redemption logic using pre-sorted list from remainingAccounts
    // Client provides sorted target troves via remainingAccounts (sorted from riskiest to safest)
    // Each trove has 4 accounts: UserDebtAmount, UserCollateralAmount, LiquidityThreshold, TokenAccount
    
    let mut remaining_amount = net_redemption_amount;
    let mut total_collateral_sent = 0u64;
    let mut troves_redeemed = 0u32;
    
    // Validate remaining_accounts structure (4 accounts per trove)
    require!(
        ctx.remaining_accounts.len() % 4 == 0,
        AerospacerProtocolError::InvalidList
    );
    
    let num_troves = ctx.remaining_accounts.len() / 4;
    msg!("Processing redemption across {} pre-sorted troves", num_troves);
    
    // Iterate through pre-sorted troves provided by client
    for i in 0..num_troves {
        if remaining_amount == 0 {
            break;
        }
        
        let base_idx = i * 4;
        
        // Get accounts for this trove
        let debt_account = &ctx.remaining_accounts[base_idx];
        let collateral_account = &ctx.remaining_accounts[base_idx + 1];
        let _lt_account = &ctx.remaining_accounts[base_idx + 2];
        let token_account = &ctx.remaining_accounts[base_idx + 3];
        
        // Deserialize trove data
        let debt_data = debt_account.try_borrow_data()?;
        let user_debt = UserDebtAmount::try_deserialize(&mut &debt_data[..])?;
        let trove_user = user_debt.owner;
        let debt_amount = user_debt.amount;
        drop(debt_data);
        
        let collateral_data = collateral_account.try_borrow_data()?;
        let user_collateral = UserCollateralAmount::try_deserialize(&mut &collateral_data[..])?;
        let collateral_denom = user_collateral.denom.clone();
        let collateral_amount = user_collateral.amount;
        drop(collateral_data);
        
        // Skip if this trove doesn't have the requested collateral type
        if collateral_denom != params.collateral_denom {
            msg!("Trove {} has {} collateral, not {}, skipping", trove_user, collateral_denom, params.collateral_denom);
            continue;
        }
        
        // Validate token account
        require!(
            token_account.owner == &anchor_spl::token::ID,
            AerospacerProtocolError::Unauthorized
        );
        
        let trove_data = TroveData {
            user: trove_user,
            debt_amount,
            collateral_amounts: vec![(collateral_denom.clone(), collateral_amount)],
            liquidity_ratio: 0, // Not needed for redemption
        };
        
        // Calculate how much to redeem from this trove
        let redeem_from_trove = remaining_amount.min(trove_data.debt_amount);
        
        // Calculate collateral to send (proportional to debt redeemed)
        let collateral_ratio = if trove_data.debt_amount > 0 {
            (redeem_from_trove as f64) / (trove_data.debt_amount as f64)
        } else {
            0.0
        };
        
        let collateral_to_send = ((collateral_amount as f64) * collateral_ratio) as u64;
        
        if collateral_to_send > 0 {
            // Transfer collateral to user
            let collateral_seeds = &[
                b"protocol_collateral_vault".as_ref(),
                params.collateral_denom.as_bytes(),
                &[ctx.bumps.protocol_collateral_vault],
            ];
            let collateral_signer = &[&collateral_seeds[..]];
            
            let collateral_transfer_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.protocol_collateral_vault.to_account_info(),
                    to: ctx.accounts.user_collateral_account.to_account_info(),
                    authority: ctx.accounts.protocol_collateral_vault.to_account_info(),
                },
                collateral_signer,
            );
            anchor_spl::token::transfer(collateral_transfer_ctx, collateral_to_send)?;
            
            // Update UserCollateralAmount to reflect decreased collateral
            let mut coll_data = collateral_account.try_borrow_mut_data()?;
            let mut user_coll = UserCollateralAmount::try_deserialize(&mut &coll_data[..])?;
            user_coll.amount = user_coll.amount.saturating_sub(collateral_to_send);
            user_coll.try_serialize(&mut &mut coll_data[..])?;
            drop(coll_data);
            
            // Update global total_collateral_amount PDA
            let mut total_coll_data = ctx.accounts.total_collateral_amount.try_borrow_mut_data()?;
            let mut total_collateral: TotalCollateralAmount = TotalCollateralAmount::try_deserialize(&mut &total_coll_data[..])?;
            total_collateral.amount = total_collateral.amount.checked_sub(collateral_to_send)
                .ok_or(AerospacerProtocolError::OverflowError)?;
            total_collateral.try_serialize(&mut &mut total_coll_data[..])?;
            drop(total_coll_data);
            
            total_collateral_sent = total_collateral_sent.saturating_add(collateral_to_send);
            msg!("Transferred {} {} to user from trove {}", collateral_to_send, params.collateral_denom, trove_user);
        }
        
        // Update trove debt
        let new_debt = trove_data.debt_amount.saturating_sub(redeem_from_trove);
        
        // Update UserDebtAmount account
        let mut debt_data_mut = debt_account.try_borrow_mut_data()?;
        let mut user_debt_mut = UserDebtAmount::try_deserialize(&mut &debt_data_mut[..])?;
        user_debt_mut.amount = new_debt;
        user_debt_mut.try_serialize(&mut &mut debt_data_mut[..])?;
        drop(debt_data_mut);
        
        if new_debt == 0 {
            msg!("Trove fully redeemed and zeroed: {}", trove_user);
        } else {
            msg!("Trove partially redeemed: user={}, new_debt={}", trove_user, new_debt);
        }
        
        troves_redeemed += 1;
        remaining_amount = remaining_amount.saturating_sub(redeem_from_trove);
    }
    
    // CRITICAL: Require that the FULL redemption amount was processed
    // Since we already burned the stablecoins upfront, we must ensure
    // sufficient collateral was found, otherwise revert the entire transaction
    require!(
        remaining_amount == 0,
        AerospacerProtocolError::InsufficientCollateral // Not enough troves with requested collateral type
    );
    
    // PRODUCTION SAFETY: Update global state with net redeemed amount (which equals net_redemption_amount since remaining is 0)
    state.total_debt_amount = state.total_debt_amount.checked_sub(net_redemption_amount)
        .ok_or(AerospacerProtocolError::OverflowError)?;
    
    msg!("Redeemed successfully");
    msg!("User: {}", ctx.accounts.user.key());
    msg!("Gross amount: {} aUSD", params.amount);
    msg!("Fee: {} aUSD ({}%)", fee_amount, ctx.accounts.state.protocol_fee);
    msg!("Net redemption: {} aUSD", net_redemption_amount);
    msg!("Collateral sent: {} {}", total_collateral_sent, params.collateral_denom);
    msg!("Troves redeemed: {}", troves_redeemed);
    msg!("Remaining amount: {} aUSD", remaining_amount);

    Ok(())
}

// NOTE: Helper functions for sorted list traversal removed - using off-chain sorting architecture

// Trove data structure for redemption
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TroveData {
    pub user: Pubkey,
    pub debt_amount: u64,
    pub collateral_amounts: Vec<(String, u64)>,
    pub liquidity_ratio: u64,
}