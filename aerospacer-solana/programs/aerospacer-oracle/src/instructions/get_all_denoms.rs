use anchor_lang::prelude::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct GetAllDenomsParams {
    // No parameters needed for all denoms query
}

#[derive(Accounts)]
#[instruction(params: GetAllDenomsParams)]
pub struct GetAllDenoms<'info> {
    #[account(
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, OracleStateAccount>,
}

pub fn handler(ctx: Context<GetAllDenoms>, _params: GetAllDenomsParams) -> Result<Vec<String>> {
    let state = &ctx.accounts.state;
    
    // Extract all denoms from collateral data, matching INJECTIVE's structure
    let denoms: Vec<String> = state.collateral_data
        .iter()
        .map(|data| data.denom.clone())
        .collect();
    
    msg!("All denoms query successful");
    msg!("Found {} supported assets", denoms.len());
    for denom in &denoms {
        msg!("- {}", denom);
    }
    
    Ok(denoms)
}