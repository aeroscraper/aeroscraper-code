use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint, Transfer, Burn};
use crate::state::*;
use crate::error::*;

/// Account management utilities for the protocol
/// This module provides clean, type-safe account loading and management

/// Context for managing user trove accounts
#[derive(Accounts)]
pub struct TroveContext<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"user_debt_amount", user.key().as_ref()],
        bump,
        constraint = user_debt_amount.owner == user.key() @ AerospacerProtocolError::Unauthorized
    )]
    pub user_debt_amount: Account<'info, UserDebtAmount>,
    
    #[account(
        mut,
        seeds = [b"liquidity_threshold", user.key().as_ref()],
        bump,
        constraint = liquidity_threshold.owner == user.key() @ AerospacerProtocolError::Unauthorized
    )]
    pub liquidity_threshold: Account<'info, LiquidityThreshold>,
    
    #[account(mut)]
    pub state: Account<'info, StateAccount>,
}

/// Context for managing collateral-specific operations
#[derive(Accounts)]
#[instruction(collateral_denom: String)]
pub struct CollateralContext<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"user_collateral_amount", user.key().as_ref(), collateral_denom.as_bytes()],
        bump,
        constraint = user_collateral_amount.owner == user.key() @ AerospacerProtocolError::Unauthorized
    )]
    pub user_collateral_amount: Account<'info, UserCollateralAmount>,
    
    #[account(mut)]
    pub user_collateral_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub protocol_collateral_account: Account<'info, TokenAccount>,
    
    /// CHECK: Per-denom collateral total PDA
    #[account(
        mut,
        seeds = [b"total_collateral_amount", collateral_denom.as_bytes()],
        bump
    )]
    pub total_collateral_amount: Account<'info, TotalCollateralAmount>,
    
    pub token_program: Program<'info, Token>,
}

// NOTE: SortedTrovesContext removed - using off-chain sorting architecture

/// Context for managing liquidation operations
#[derive(Accounts)]
pub struct LiquidationContext<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,
    
    #[account(mut)]
    pub state: Account<'info, StateAccount>,
    
    #[account(mut)]
    pub stable_coin_mint: Account<'info, Mint>,
    
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
        seeds = [b"protocol_collateral_vault", b"SOL"],
        bump
    )]
    pub protocol_collateral_vault: AccountInfo<'info>,
    
    /// CHECK: Per-denom collateral total PDA
    #[account(
        mut,
        seeds = [b"total_collateral_amount", b"SOL"],
        bump
    )]
    pub total_collateral_amount: Account<'info, TotalCollateralAmount>,
    
    // NOTE: sorted_troves_state removed - using off-chain sorting
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Helper functions for account management
impl<'info> TroveContext<'info> {
    /// Get user's trove information
    pub fn get_trove_info(&self) -> Result<TroveInfo> {
        Ok(TroveInfo {
            user: self.user.key(),
            debt_amount: self.user_debt_amount.amount,
            liquidity_ratio: self.liquidity_threshold.ratio,
        })
    }
    
    /// Update trove debt amount
    pub fn update_debt_amount(&mut self, new_amount: u64) -> Result<()> {
        self.user_debt_amount.amount = new_amount;
        Ok(())
    }
    
    /// Update liquidity threshold
    pub fn update_liquidity_threshold(&mut self, new_ratio: u64) -> Result<()> {
        self.liquidity_threshold.ratio = new_ratio;
        Ok(())
    }
}

/// Trove information structure
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct TroveInfo {
    pub user: Pubkey,
    pub debt_amount: u64,
    pub liquidity_ratio: u64,
}

/// Collateral information structure
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CollateralInfo {
    pub denom: String,
    pub amount: u64,
    pub user_account: Pubkey,
    pub protocol_account: Pubkey,
}

impl<'info> CollateralContext<'info> {
    /// Get collateral information
    pub fn get_collateral_info(&self) -> Result<CollateralInfo> {
        Ok(CollateralInfo {
            denom: self.user_collateral_amount.denom.clone(),
            amount: self.user_collateral_amount.amount,
            user_account: self.user_collateral_account.key(),
            protocol_account: self.protocol_collateral_account.key(),
        })
    }
    
    /// Update collateral amount
    pub fn update_collateral_amount(&mut self, new_amount: u64) -> Result<()> {
        self.user_collateral_amount.amount = new_amount;
        Ok(())
    }
    
    /// Transfer collateral from user to protocol
    pub fn transfer_to_protocol(&self, amount: u64) -> Result<()> {
        let transfer_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.user_collateral_account.to_account_info(),
                to: self.protocol_collateral_account.to_account_info(),
                authority: self.user.to_account_info(),
            },
        );
        anchor_spl::token::transfer(transfer_ctx, amount)?;
        Ok(())
    }
    
    /// Transfer collateral from protocol to user
    pub fn transfer_to_user(&self, amount: u64, collateral_denom: &str, bump: u8) -> Result<()> {
        // Derive the PDA seeds for the protocol_collateral_account
        let transfer_seeds = &[
            b"protocol_collateral_vault".as_ref(),
            collateral_denom.as_bytes(),
            &[bump],  // ← Use the passed bump instead of trying to access .bumps
        ];
        let transfer_signer = &[&transfer_seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            Transfer {
                from: self.protocol_collateral_account.to_account_info(),
                to: self.user_collateral_account.to_account_info(),
                authority: self.protocol_collateral_account.to_account_info(),
            },
            transfer_signer,
        );
        anchor_spl::token::transfer(transfer_ctx, amount)?;
        Ok(())
    }
}

// NOTE: SortedTrovesContext implementation removed - using off-chain sorting architecture

/// Liquidation management
impl<'info> LiquidationContext<'info> {
    /// Process liquidation for a single trove
    pub fn liquidate_trove(
        &mut self,
        user: Pubkey,
        debt_amount: u64,
        collateral_amounts: Vec<(String, u64)>,
    ) -> Result<()> {
        // Calculate liquidation gains
        let mut total_collateral_gain = 0u64;
        for (_denom, amount) in &collateral_amounts {
            total_collateral_gain = total_collateral_gain.saturating_add(*amount);
        }
        
        // Update global state
        self.state.total_debt_amount = self.state.total_debt_amount.saturating_sub(debt_amount);
        
        // Update total collateral amounts for each denomination
        for (denom, amount) in &collateral_amounts {
            self.update_total_collateral_amount(denom, *amount)?;
        }
        
        // Burn stablecoins from protocol vault (PDA signer)
        let burn_seeds = &[
            b"protocol_stablecoin_vault".as_ref(),
            &[Pubkey::find_program_address(&[b"protocol_stablecoin_vault"], &crate::ID).1],
        ];
        let burn_signer = &[&burn_seeds[..]];

        let burn_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            Burn {
                mint: self.stable_coin_mint.to_account_info(),
                from: self.protocol_stablecoin_vault.to_account_info(),
                authority: self.protocol_stablecoin_vault.to_account_info(),
            },
            burn_signer,
        );
        anchor_spl::token::burn(burn_ctx, debt_amount)?;
        
        // Distribute liquidation gains to stakers
        self.distribute_liquidation_gains(collateral_amounts)?;
        
        msg!("Trove liquidated: user={}, debt={}, collateral_gain={}", 
             user, debt_amount, total_collateral_gain);
        
        Ok(())
    }
    
    /// Update total collateral amount for a specific denomination
    fn update_total_collateral_amount(&mut self, denom: &str, amount: u64) -> Result<()> {
        // In a full implementation, this would update the total_collateral_amount PDA
        // For now, we'll just log the update
        msg!("Updated total collateral for {}: +{}", denom, amount);
        Ok(())
    }
    
    /// Distribute liquidation gains to stakers
    fn distribute_liquidation_gains(&mut self, collateral_amounts: Vec<(String, u64)>) -> Result<()> {
        // In a full implementation, this would:
        // 1. Calculate total stake amount
        // 2. Distribute collateral proportionally to stakers
        // 3. Update staker accounts
        
        for (denom, amount) in &collateral_amounts {
            msg!("Distributing liquidation gains: {} {} to stakers", amount, denom);
        }
        
        Ok(())
    }
}

// NOTE: SortedTrovesManager removed - using off-chain sorting architecture
// All sorted list management logic has been moved to the client side
