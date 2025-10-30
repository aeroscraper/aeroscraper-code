use anchor_lang::prelude::*;

#[error_code]
pub enum AerospacerOracleError {
    #[msg("Unauthorized access - admin only")]
    Unauthorized,
    
    #[msg("Price feed not found for the specified denom")]
    PriceFeedNotFound,
    
    #[msg("Invalid price data format or corrupted data")]
    InvalidPriceData,
    
    #[msg("Price data is too old (exceeds staleness threshold)")]
    PriceTooOld,
    
    #[msg("Invalid price ID format")]
    InvalidPriceId,
    
    #[msg("Price feed not available")]
    PriceFeedUnavailable,
    
    #[msg("Invalid price status")]
    InvalidPriceStatus,
    
    #[msg("Price validation failed")]
    PriceValidationFailed,
    
    #[msg("Oracle query failed")]
    OracleQueryFailed,
    
    #[msg("Invalid collateral data")]
    InvalidCollateralData,
    
    #[msg("Batch data validation failed")]
    InvalidBatchData,
    
    #[msg("Collateral data not found for removal")]
    CollateralDataNotFound,
    
    #[msg("Pyth price feed loading failed")]
    PythPriceFeedLoadFailed,
    
    #[msg("Pyth price data validation failed")]
    PythPriceValidationFailed,
    
    #[msg("Pyth account data corrupted")]
    PythAccountDataCorrupted,
    
    #[msg("Pyth price account validation failed")]
    PythPriceAccountValidationFailed,
}