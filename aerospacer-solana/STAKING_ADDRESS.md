# Staking Address for Aerospacer Fee Contract

## Overview
This directory contains the keypair for the staking/stability pool address used in the Aerospacer fee contract.

## Address Information
- **Public Key:** `CUdX27XaXCGeYLwRVssXE63wufjkufTPXrHqMRCtYaX3`
- **Private Key File:** `staking_address.json`
- **Purpose:** Stability pool address for fee accumulation when stake mode is enabled

## Usage
This address is used as the `stake_contract_address` in the fee distributor contract when `is_stake_enabled` is set to `true`.

## Security Note
- Keep the private key secure and never commit it to version control
- This is for testing purposes only
- In production, this would be a proper staking contract address

## Testing
Use this address in tests to verify fee distribution to the stability pool functionality.
