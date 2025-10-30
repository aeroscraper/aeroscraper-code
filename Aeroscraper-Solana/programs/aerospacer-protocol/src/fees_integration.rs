use anchor_lang::prelude::*;
use crate::utils::*;
use crate::error::*;

/// Process protocol fee collection and distribution via CPI to aerospacer-fees
/// This function handles the complete fee flow:
/// 1. Calculate fee amount
/// 2. Call distribute_fee instruction via CPI (which handles token transfers)
/// 3. Return net amount after fee
pub fn process_protocol_fee<'info>(
    operation_amount: u64,
    protocol_fee_percentage: u8,
    fees_program: AccountInfo<'info>,
    payer: AccountInfo<'info>,
    fees_state: AccountInfo<'info>,
    payer_token_account: AccountInfo<'info>,
    stability_pool_token_account: AccountInfo<'info>,
    fee_address_1_token_account: AccountInfo<'info>,
    fee_address_2_token_account: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
) -> Result<u64> {
    // Calculate fee amount
    let fee_amount = calculate_protocol_fee(operation_amount, protocol_fee_percentage)?;
    
    if fee_amount == 0 {
        return Ok(operation_amount);
    }
    
    msg!("Processing protocol fee: {} aUSD ({}%)", fee_amount, protocol_fee_percentage);
    msg!("Operation amount: {} aUSD", operation_amount);
    
    // Call distribute_fee instruction via CPI
    // The fee contract will handle transferring tokens from payer_token_account
    // to the appropriate destinations (stability pool or fee addresses)
    distribute_fee_via_cpi(
        &fees_program,
        &payer,
        &fees_state,
        &payer_token_account,
        &stability_pool_token_account,
        &fee_address_1_token_account,
        &fee_address_2_token_account,
        &token_program,
        fee_amount,
    )?;
    
    msg!("Fee distributed successfully: {} aUSD", fee_amount);
    
    // Return net amount after fee
    calculate_net_amount_after_fee(operation_amount, protocol_fee_percentage)
}

/// Validate fees contract accounts
pub fn validate_fees_accounts<'info>(
    fees_program: &AccountInfo<'info>,
    fees_state: &AccountInfo<'info>,
    payer_token_account: &AccountInfo<'info>,
    stability_pool_token_account: &AccountInfo<'info>,
    fee_address_1_token_account: &AccountInfo<'info>,
    fee_address_2_token_account: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
) -> Result<()> {
    // Validate fees program
    require!(
        fees_program.executable,
        AerospacerProtocolError::Unauthorized
    );
    
    // Validate fees state account
    require!(
        *fees_state.owner == fees_program.key(),
        AerospacerProtocolError::Unauthorized
    );
    
    // Validate token accounts
    require!(
        *payer_token_account.owner == token_program.key(),
        AerospacerProtocolError::Unauthorized
    );
    
    require!(
        *stability_pool_token_account.owner == token_program.key(),
        AerospacerProtocolError::Unauthorized
    );
    
    require!(
        *fee_address_1_token_account.owner == token_program.key(),
        AerospacerProtocolError::Unauthorized
    );
    
    require!(
        *fee_address_2_token_account.owner == token_program.key(),
        AerospacerProtocolError::Unauthorized
    );
    
    msg!("All fees contract accounts validated successfully");
    Ok(())
}

/// Call distribute_fee instruction on aerospacer-fees contract via CPI
/// The fee contract will transfer tokens from payer to destinations directly
fn distribute_fee_via_cpi<'info>(
    fees_program: &AccountInfo<'info>,
    payer: &AccountInfo<'info>,
    fees_state: &AccountInfo<'info>,
    payer_token_account: &AccountInfo<'info>,
    stability_pool_token_account: &AccountInfo<'info>,
    fee_address_1_token_account: &AccountInfo<'info>,
    fee_address_2_token_account: &AccountInfo<'info>,
    token_program: &AccountInfo<'info>,
    fee_amount: u64,
) -> Result<()> {
    use anchor_lang::solana_program::instruction::Instruction;
    use anchor_lang::solana_program::program::invoke;
    use anchor_lang::solana_program::hash::hash;
    
    msg!("Distributing fee via aerospacer-fees contract CPI");
    msg!("Fee amount: {} aUSD", fee_amount);
    msg!("Fees program: {}", fees_program.key());
    msg!("Fees state: {}", fees_state.key());
    
    // Build DistributeFeeParams
    #[derive(AnchorSerialize)]
    struct DistributeFeeParams {
        fee_amount: u64,
    }
    
    let params = DistributeFeeParams { fee_amount };
    
    // Calculate instruction discriminator: first 8 bytes of SHA256("global:distribute_fee")
    let preimage = b"global:distribute_fee";
    let hash_result = hash(preimage);
    let mut discriminator = [0u8; 8];
    discriminator.copy_from_slice(&hash_result.to_bytes()[..8]);
    
    // Serialize full instruction data: discriminator + params
    let mut instruction_data = Vec::new();
    instruction_data.extend_from_slice(&discriminator);
    params.serialize(&mut instruction_data)?;
    
    // Build account metas for distribute_fee instruction
    let account_metas = vec![
        anchor_lang::solana_program::instruction::AccountMeta::new(*payer.key, true),           // ✅ payer as signer
        anchor_lang::solana_program::instruction::AccountMeta::new(*fees_state.key, false),    // ✅ fees_state as writable, not signer
        anchor_lang::solana_program::instruction::AccountMeta::new(*payer_token_account.key, false),     // ✅ payer_token_account as writable, not signer
        anchor_lang::solana_program::instruction::AccountMeta::new(*stability_pool_token_account.key, false), // ✅ stability_pool_token_account as writable, not signer
        anchor_lang::solana_program::instruction::AccountMeta::new(*fee_address_1_token_account.key, false),   // ✅ fee_address_1_token_account as writable, not signer
        anchor_lang::solana_program::instruction::AccountMeta::new(*fee_address_2_token_account.key, false),   // ✅ fee_address_2_token_account as writable, not signer
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(*token_program.key, false),       // ✅ token_program as readonly
    ];
    
    // Create instruction
    let ix = Instruction {
        program_id: *fees_program.key,
        accounts: account_metas,
        data: instruction_data,
    };
    
    // Execute CPI
    // Note: fees_program must be included for Solana runtime
    let account_infos = vec![
        fees_program.to_account_info(),
        payer.to_account_info(),
        fees_state.to_account_info(),
        payer_token_account.to_account_info(),
        stability_pool_token_account.to_account_info(),
        fee_address_1_token_account.to_account_info(),
        fee_address_2_token_account.to_account_info(),
        token_program.to_account_info(),
    ];
    
    invoke(&ix, &account_infos)?;
    
    msg!("Fee distribution CPI completed successfully");
    Ok(())
}

/// Initialize fees contract if needed
pub fn initialize_fees_contract_if_needed<'info>(
    fees_program: &AccountInfo<'info>,
    admin: &AccountInfo<'info>,
    fees_state: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
) -> Result<()> {
    use anchor_lang::solana_program::instruction::Instruction;
    use anchor_lang::solana_program::program::invoke;
    use anchor_lang::solana_program::hash::hash;
    
    // Check if fees state account is already initialized
    if fees_state.data_is_empty() {
        msg!("Initializing aerospacer-fees contract via CPI...");
        msg!("Fees program: {}", fees_program.key());
        msg!("Admin: {}", admin.key());
        msg!("Fees state: {}", fees_state.key());
        
        // Calculate instruction discriminator: first 8 bytes of SHA256("global:initialize")
        let preimage = b"global:initialize";
        let hash_result = hash(preimage);
        let mut discriminator = [0u8; 8];
        discriminator.copy_from_slice(&hash_result.to_bytes()[..8]);
        
        // Initialize instruction has no params, just discriminator
        let instruction_data = discriminator.to_vec();
        
        // Build account metas for initialize instruction
        let account_metas = vec![
            anchor_lang::solana_program::instruction::AccountMeta::new(*fees_state.key, false),
            anchor_lang::solana_program::instruction::AccountMeta::new(*admin.key, true),
            anchor_lang::solana_program::instruction::AccountMeta::new_readonly(*system_program.key, false),
        ];
        
        // Create instruction
        let ix = Instruction {
            program_id: *fees_program.key,
            accounts: account_metas,
            data: instruction_data,
        };
        
        // Execute CPI
        // Note: fees_program must be included for Solana runtime
        let account_infos = vec![
            fees_program.to_account_info(),
            fees_state.to_account_info(),
            admin.to_account_info(),
            system_program.to_account_info(),
        ];
        
        invoke(&ix, &account_infos)?;
        
        msg!("Fees contract initialization CPI completed successfully");
    } else {
        msg!("Fees contract already initialized");
    }
    
    Ok(())
}

/// Get fees contract configuration via CPI
pub fn get_fees_config<'info>(
    fees_program: &AccountInfo<'info>,
    fees_state: &AccountInfo<'info>,
) -> Result<FeesConfigResponse> {
    msg!("Getting fees contract configuration via CPI...");
    msg!("Fees program: {}", fees_program.key());
    msg!("Fees state: {}", fees_state.key());
    
    // Build CPI instruction for get_config
    use anchor_lang::solana_program::instruction::Instruction;
    use anchor_lang::solana_program::program::invoke;
    use anchor_lang::solana_program::hash::hash;
    
    // Calculate instruction discriminator: first 8 bytes of SHA256("global:get_config")
    let preimage = b"global:get_config";
    let hash_result = hash(preimage);
    let discriminator = &hash_result.to_bytes()[..8];
    
    // get_config has no params, just the discriminator
    let instruction_data = discriminator.to_vec();
    
    // Build account metas
    let account_metas = vec![
        anchor_lang::solana_program::instruction::AccountMeta::new_readonly(*fees_state.key, false),
    ];
    
    // Create instruction
    let ix = Instruction {
        program_id: *fees_program.key,
        accounts: account_metas,
        data: instruction_data,
    };
    
    // Execute CPI
    let account_infos = vec![
        fees_state.clone(),
        fees_program.clone(),
    ];
    
    invoke(&ix, &account_infos)?;
    
    // Parse return data from fees program
    let return_data = anchor_lang::solana_program::program::get_return_data()
        .ok_or(AerospacerProtocolError::InvalidAmount)?;
    
    // Verify the return data is from the fees program
    require!(
        return_data.0 == *fees_program.key,
        AerospacerProtocolError::Unauthorized
    );
    
    // Deserialize ConfigResponse from fees contract
    #[derive(AnchorSerialize, AnchorDeserialize)]
    struct FeeConfigResponse {
        admin: Pubkey,
        is_stake_enabled: bool,
        stake_contract_address: Pubkey,
        total_fees_collected: u64,
    }
    
    let config: FeeConfigResponse = FeeConfigResponse::deserialize(&mut &return_data.1[..])?;
    
    msg!("Fees config retrieved successfully:");
    msg!("  Admin: {}", config.admin);
    msg!("  Stake enabled: {}", config.is_stake_enabled);
    msg!("  Total fees collected: {}", config.total_fees_collected);
    
    // Convert to our local response type
    Ok(FeesConfigResponse {
        admin: config.admin,
        is_stake_enabled: config.is_stake_enabled,
        stake_contract_address: config.stake_contract_address,
        total_fees_collected: config.total_fees_collected,
    })
}

/// Fees configuration response structure
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct FeesConfigResponse {
    pub admin: Pubkey,
    pub is_stake_enabled: bool,
    pub stake_contract_address: Pubkey,
    pub total_fees_collected: u64,
}
