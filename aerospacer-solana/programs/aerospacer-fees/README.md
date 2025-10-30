# Aerospacer Fees Contract

A comprehensive fee distribution system for the Aerospacer DeFi protocol on Solana, designed to handle protocol fee collection and distribution with flexible configuration options.

## 📋 Overview

The `aerospacer-fees` contract is a production-ready Solana program that manages protocol fee collection and distribution. It supports two distribution modes:

1. **Stability Pool Distribution**: Fees are sent to a designated stability pool contract
2. **Fee Address Distribution**: Fees are split 50/50 between two hardcoded fee addresses

## 🏗️ Architecture

### Program ID
```
AHmGKukQky3mDHLmFyJYcEaFub69vp2QqeSW7EbVpJjZ
```

### Core Components

- **State Management**: `FeeStateAccount` stores contract configuration as a PDA
- **PDA Architecture**: Uses Program Derived Addresses for deterministic state management
- **Error Handling**: Comprehensive error types for all scenarios
- **Security**: Multiple validation layers and authorization checks
- **Flexibility**: Toggle between distribution modes

## 📁 File Structure

```
src/
├── lib.rs                           # Main program entry point
├── state/
│   └── mod.rs                      # Data structures and constants
├── instructions/
│   ├── mod.rs                      # Instruction module exports
│   ├── initialize.rs               # Contract initialization
│   ├── toggle_stake_contract.rs    # Toggle distribution mode
│   ├── set_stake_contract_address.rs # Set stability pool address
│   ├── distribute_fee.rs           # Core fee distribution logic
│   └── get_config.rs               # Configuration query
└── error/
    └── mod.rs                      # Error definitions
```

## 🔧 Instructions

### 1. Initialize
**Purpose**: Initialize the fee distributor contract

**Accounts**:
- `state`: FeeStateAccount (init, PDA with seed "fee_state")
- `admin`: Signer (payer)
- `system_program`: System Program

**Description**: Creates the initial state PDA with admin as the initializer, stake disabled by default, and zero fees collected.

### 2. Toggle Stake Contract
**Purpose**: Toggle between stability pool and fee address distribution modes

**Accounts**:
- `admin`: Signer (must be contract admin)
- `state`: FeeStateAccount (mut, PDA with seed "fee_state")

**Description**: Admin-only function that switches between the two distribution modes.

### 3. Set Stake Contract Address
**Purpose**: Set the stability pool contract address

**Parameters**:
- `address`: String - The stake contract address

**Accounts**:
- `admin`: Signer (must be contract admin)
- `state`: FeeStateAccount (mut, PDA with seed "fee_state")

**Description**: Admin-only function to configure the stability pool address for fee distribution.

### 4. Set Fee Addresses
**Purpose**: Update the fee distribution addresses

**Parameters**:
- `fee_address_1`: String - First fee address (Protocol Treasury)
- `fee_address_2`: String - Second fee address (Validator Rewards)

**Accounts**:
- `admin`: Signer (must be contract admin)
- `state`: FeeStateAccount (mut, PDA with seed "fee_state")

**Description**: Admin-only function to configure the fee distribution addresses. Both addresses must be valid Solana public keys and must be different from each other.

### 5. Distribute Fee
**Purpose**: Distribute protocol fees based on current mode

**Parameters**:
- `fee_amount`: u64 - Amount of fees to distribute

**Accounts**:
- `payer`: Signer
- `state`: FeeStateAccount (mut, PDA with seed "fee_state")
- `payer_token_account`: TokenAccount (mut)
- `stability_pool_token_account`: TokenAccount (mut)
- `fee_address_1_token_account`: TokenAccount (mut)
- `fee_address_2_token_account`: TokenAccount (mut)
- `token_program`: Token Program

**Description**: Core fee distribution logic with comprehensive security validations.

### 6. Get Config
**Purpose**: Query contract configuration

**Accounts**:
- `state`: FeeStateAccount (PDA with seed "fee_state")

**Returns**: `ConfigResponse` with current contract state

**Description**: Read-only function to retrieve current contract configuration.

## 🔒 Security Features

### PDA Architecture
- **Deterministic Addresses**: State account uses PDA with seed "fee_state"
- **Program Ownership**: Only the program can create/modify the state PDA
- **Integration Ready**: Other programs can easily find and reference the state
- **Security**: Prevents unauthorized state account creation

### Authorization
- All admin functions require proper authorization
- Payer must own the source token account
- Comprehensive ownership validation

### Validation
- Token mint consistency across all accounts
- Address format validation
- Overflow protection with `checked_add`
- Input validation for all parameters

### Error Handling
- 12 comprehensive error types
- Clear error messages for debugging
- Proper error propagation

## 📊 State Structure

### FeeStateAccount
```rust
pub struct FeeStateAccount {
    pub admin: Pubkey,                    // 32 bytes
    pub is_stake_enabled: bool,           // 1 byte
    pub stake_contract_address: Pubkey,   // 32 bytes
    pub fee_address_1: Pubkey,            // 32 bytes - NEW
    pub fee_address_2: Pubkey,            // 32 bytes - NEW
    pub total_fees_collected: u64,        // 8 bytes
}
// Total: 137 bytes + 8 (discriminator) = 145 bytes
```

### Default Fee Addresses (Updateable by Admin)
- **DEFAULT_FEE_ADDR_1**: `8Lv4UrYHTrzvg9jPVVGNmxWyMrMvrZnCQLWucBzfJyyR` (Protocol Treasury)
- **DEFAULT_FEE_ADDR_2**: `GcNwV1nA5bityjNYsWwPLHykpKuuhPzK1AQFBbrPopnX` (Validator Rewards)

**Note**: These are the default values set during initialization. The admin can update them using the `set_fee_addresses` instruction.

## 🚀 Usage Examples

### PDA Derivation
```typescript
// Derive the fee state PDA
const [feeStatePDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("fee_state")],
  program.programId
);
```

### Initialize Contract
```typescript
await program.methods
  .initialize()
  .accounts({
    state: feeStatePDA,
    admin: adminKeypair.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([adminKeypair])
  .rpc();
```

### Toggle Distribution Mode
```typescript
await program.methods
  .toggleStakeContract()
  .accounts({
    admin: adminKeypair.publicKey,
    state: feeStatePDA,
  })
  .signers([adminKeypair])
  .rpc();
```

### Set Fee Addresses
```typescript
await program.methods
  .setFeeAddresses({
    feeAddress1: "NewTreasuryAddress...",
    feeAddress2: "NewValidatorAddress..."
  })
  .accounts({
    admin: adminKeypair.publicKey,
    state: feeStatePDA,
  })
  .signers([adminKeypair])
  .rpc();
```

### Distribute Fees
```typescript
await program.methods
  .distributeFee({ feeAmount: new BN(1000000) })
  .accounts({
    payer: payerKeypair.publicKey,
    state: feeStatePDA,
    payerTokenAccount: payerTokenAccount,
    stabilityPoolTokenAccount: stabilityPoolTokenAccount,
    feeAddress1TokenAccount: feeAddress1TokenAccount,
    feeAddress2TokenAccount: feeAddress2TokenAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .signers([payerKeypair])
  .rpc();
```

## 🔍 Error Codes

| Error | Code | Description |
|-------|------|-------------|
| `Unauthorized` | 6000 | Caller is not authorized |
| `NoFeesToDistribute` | 6001 | Fee amount is zero |
| `Overflow` | 6002 | Arithmetic overflow occurred |
| `InvalidFeeDistribution` | 6003 | Invalid fee distribution |
| `TransferFailed` | 6004 | Token transfer failed |
| `InvalidAddress` | 6005 | Invalid address format |
| `InvalidTokenMint` | 6006 | Token mint mismatch |
| `StakeContractNotSet` | 6007 | Stake contract address not set |
| `InvalidStabilityPoolAccount` | 6008 | Invalid stability pool account |
| `InvalidFeeAddress1` | 6009 | Invalid fee address 1 |
| `InvalidFeeAddress2` | 6010 | Invalid fee address 2 |
| `UnauthorizedTokenAccount` | 6011 | Unauthorized token account |

## 🛠️ Dependencies

- `anchor-lang = "0.31.1"` - Core Anchor framework
- `anchor-spl = "0.31.1"` - SPL token integration
- `spl-token = "4.0.0"` - SPL token standard

## 🧪 Testing

The contract includes comprehensive test coverage for:
- Contract initialization
- Admin function authorization
- Fee distribution in both modes
- Error handling scenarios
- Security validations

## 📈 Production Readiness

### ✅ Completed Features
- [x] Core fee distribution logic
- [x] Security validations
- [x] Error handling
- [x] Admin controls
- [x] Configuration management
- [x] Comprehensive logging
- [x] Token safety measures

### ✅ Security Audits
- [x] Authorization checks
- [x] Input validation
- [x] Overflow protection
- [x] Token account ownership validation
- [x] Address format validation

## 🔄 Integration

This contract integrates with:
- **Aerospacer Protocol**: For fee collection
- **Stability Pool**: For fee distribution when enabled
- **SPL Token Program**: For token transfers
- **System Program**: For account creation

## 📝 License

This project is part of the Aerospacer DeFi protocol suite.

## 🤝 Contributing

Please refer to the main project documentation for contribution guidelines.

---

**Status**: ✅ **Production Ready** | **Version**: 0.1.0 | **Last Updated**: 2024
