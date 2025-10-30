# Fee Addresses Documentation

## Overview
These are the hardcoded fee addresses for the Aerospacer Solana protocol, following the same implementation pattern as the INJECTIVE project.

## Fee Address 1 - Protocol Treasury/Development Fund
- **Public Key**: `8Lv4UrYHTrzvg9jPVVGNmxWyMrMvrZnCQLWucBzfJyyR`
- **Purpose**: Protocol treasury and development fund
- **File**: `fee_address_1.json`

## Fee Address 2 - Validator Rewards/Staking Pool
- **Public Key**: `GcNwV1nA5bityjNYsWwPLHykpKuuhPzK1AQFBbrPopnX`
- **Purpose**: Validator rewards and staking pool
- **File**: `fee_address_2.json`

## Fee Distribution
- **50/50 Split**: Fees are distributed equally between both addresses
- **Hardcoded**: Following INJECTIVE project pattern for consistency and security
- **Immutable**: Cannot be changed without contract redeployment

## Security Notes
- Keep these private keys secure
- Store seed phrases in a safe location
- These addresses will receive protocol fees automatically
- Backup both keypairs for recovery purposes

## Usage
These addresses are used in the fee distribution logic:
```rust
// 50/50 split to fee addresses
let half_amount = fee_amount / 2;
let remaining_amount = fee_amount - half_amount;

// Transfer to FEE_ADDR_1
transfer(transfer_ctx_1, half_amount)?;

// Transfer to FEE_ADDR_2  
transfer(transfer_ctx_2, remaining_amount)?;
```
