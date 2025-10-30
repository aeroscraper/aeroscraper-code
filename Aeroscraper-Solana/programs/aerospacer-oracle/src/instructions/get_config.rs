use anchor_lang::prelude::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct GetConfigParams {
    // No parameters needed for config query
}

#[derive(Accounts)]
#[instruction(params: GetConfigParams)]
pub struct GetConfig<'info> {
    #[account(
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, OracleStateAccount>,
}

pub fn handler(ctx: Context<GetConfig>, _params: GetConfigParams) -> Result<ConfigResponse> {
    let state = &ctx.accounts.state;
    
    // Create config response matching INJECTIVE's structure
    let config_response = ConfigResponse {
        admin: state.admin,
        oracle_address: state.oracle_address,
        asset_count: state.collateral_data.len() as u32,
        last_update: state.last_update,
    };
    
    msg!("Config query successful");
    msg!("Admin: {}", state.admin);
    msg!("Oracle Address: {}", state.oracle_address);
    msg!("Asset Count: {}", config_response.asset_count);
    msg!("Last Update: {}", config_response.last_update);
    msg!("Pyth Configuration: Hardcoded (60s staleness, 1000 confidence)");
    
    Ok(config_response)
}