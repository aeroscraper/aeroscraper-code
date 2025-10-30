# Devnet Collateral Setup Guide

## Critical Information for Testing on Devnet

### The Collateral Mint Problem

When testing the Aerospacer Protocol on devnet, you **MUST** use the existing collateral mints that are already associated with the protocol vaults. Creating new collateral mints will cause constraint violations because:

1. The `protocol_collateral_vault` PDA is derived from the collateral denomination (e.g., "SOL")
2. Each vault PDA can only be initialized once with a specific mint
3. Anchor's `token::mint = collateral_mint` constraint enforces that the provided mint matches the vault's mint
4. If you provide a different mint than what's already in the vault, you get error `ConstraintTokenMint` (Error Number: 2014)

### Error Example

```
❌ AnchorError caused by account: protocol_collateral_account. 
Error Code: ConstraintTokenMint. Error Number: 2014. 
Error Message: A token mint constraint was violated.
Program log: Left: Hygyfy8RBxLvoz5b3ffsg9PAvEkT3BJXXdTpVu6ftZYz (existing vault mint)
Program log: Right: BfUm4VuvhC3j5n1XJwibxRmXxZhL1G6wizRQ9KWZpCrE (your new mint)
```

## How to Fetch the Correct Collateral Mint

### Method 1: Fetch from Protocol Vault (Recommended)

```typescript
// Derive the vault PDA for the collateral denomination
const [protocolCollateralVaultPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("protocol_collateral_vault"), Buffer.from("SOL")],
  protocolProgram.programId
);

// Check if vault exists on devnet
const vaultAccountInfo = await provider.connection.getAccountInfo(protocolCollateralVaultPda);
if (vaultAccountInfo) {
  // Vault exists - fetch its mint address
  const vaultAccount = await provider.connection.getParsedAccountInfo(protocolCollateralVaultPda);
  if (vaultAccount.value && 'parsed' in vaultAccount.value.data) {
    collateralMint = new PublicKey(vaultAccount.value.data.parsed.info.mint);
    console.log("✅ Using existing devnet collateral mint:", collateralMint.toString());
  }
} else {
  // Vault doesn't exist - create new mint (localnet scenario)
  collateralMint = await createMint(provider.connection, adminKeypair, admin.publicKey, null, 9);
  console.log("✅ Created new collateral mint for localnet:", collateralMint.toString());
}
```

### Method 2: Query from Oracle Contract

The oracle contract stores price information for each collateral denomination, which includes the mint address.

```typescript
// Query oracle for collateral info
const collateralInfo = await oracleProgram.methods
  .getAllDenoms()
  .accounts({
    state: oracleState,
  })
  .view();

// Find SOL collateral and get its mint
const solCollateral = collateralInfo.find(c => c.denom === "SOL");
if (solCollateral) {
  collateralMint = solCollateral.mint;
}
```

## Devnet Collateral Mints (as of deployment)

The following collateral mints are currently configured on devnet for the Aerospacer Protocol:

### SOL Collateral
- **Denomination**: "SOL"
- **Mint Address**: `Hygyfy8RBxLvoz5b3ffsg9PAvEkT3BJXXdTpVu6ftZYz`
- **Decimals**: 9
- **Vault PDA**: Derived from `["protocol_collateral_vault", "SOL"]`

> **Note**: This mint address is read from the actual devnet vault. If you're testing on a different devnet deployment, use the vault-fetch method above to get the correct mint.

## Test File Updates

### Fixed: `tests/protocol-core.ts`

This test file has been updated to:
1. Derive the `protocol_collateral_vault` PDA for "SOL"
2. Fetch the existing vault account from devnet
3. Parse the vault's mint address
4. Use that mint for all collateral operations
5. Handle the case where we can't mint tokens (devnet vs localnet)

### Working Tests (No Changes Needed)

These test files work correctly because they don't perform trove operations that require matching collateral mints:
- `tests/protocol-simple-test.ts` - Only checks initialization
- `tests/protocol-initialization.ts` - Only verifies protocol state

## Token Minting Considerations

### On Localnet
When testing on localnet with a fresh deployment:
- You create your own collateral mint
- You control the mint authority
- You can mint tokens freely for testing

### On Devnet
When testing on devnet with existing deployments:
- The collateral mint already exists
- You likely DON'T control the mint authority
- You CANNOT mint new tokens
- Users need to obtain tokens through:
  - Airdrops (if mint supports it)
  - Transfers from accounts that have tokens
  - DEX swaps or faucets

The test file now checks mint authority and only attempts to mint if you control it:

```typescript
const mintInfo = await provider.connection.getParsedAccountInfo(collateralMint);
let canMint = false;
if (mintInfo.value && 'parsed' in mintInfo.value.data) {
  const mintAuthority = mintInfo.value.data.parsed.info.mintAuthority;
  canMint = mintAuthority && new PublicKey(mintAuthority).equals(admin.publicKey);
}

if (canMint) {
  // Mint tokens for testing
} else {
  // Check user balances and warn if insufficient
}
```

## Best Practices for Devnet Testing

1. **Always fetch existing mints** - Never assume you can create new mints for existing vaults
2. **Check token balances** - Ensure test users have sufficient collateral before running tests
3. **Handle both scenarios** - Write tests that work on both localnet (fresh) and devnet (existing)
4. **Document mint addresses** - Keep track of which mints are used for which collaterals
5. **Use try-catch blocks** - Handle cases where accounts may or may not exist

## Troubleshooting

### Error: `ConstraintTokenMint` (2014)
**Cause**: Providing a different collateral mint than what's stored in the vault  
**Solution**: Fetch the mint from the existing vault PDA (see Method 1 above)

### Error: `AccountNotInitialized` (3012) for `user_debt_amount`
**Cause**: Trying to add collateral or borrow before opening a trove  
**Solution**: Ensure `openTrove` is called successfully first

### Error: `InsufficientCollateral` (6013)
**Cause**: User doesn't have enough collateral tokens in their account  
**Solution**: Ensure users have tokens before running tests (mint on localnet, or transfer on devnet)

### Error: `AccountDiscriminatorMismatch` (3002) on `Node` account
**Cause**: Devnet's sorted troves state is corrupted - SortedTrovesState.size > 0 but Node accounts have wrong discriminators  
**Solution**: Use the cleanup script to fix devnet state! See **Fixing Corrupted Sorted Troves State** section below.  
**Options**:
1. **Fix devnet state** (recommended for Pyth integration): Run `scripts/close-sorted-troves-devnet.ts` after redeploying
2. **Run on localnet** instead: `solana-test-validator` → `anchor deploy` → `anchor test`
3. **Redeploy protocol** to a fresh devnet instance with clean state
**Technical Detail**: Account discriminators (first 8 bytes) identify account types. Corrupted discriminators mean accounts were reused or overwritten, making the sorted list untraversable.

### Warning: Cannot mint tokens on devnet
**Cause**: The collateral mint authority is not your test admin  
**Solution**: This is expected on devnet. Ensure test users are pre-funded with collateral tokens

## Critical Fix: Sorted Troves Traversal

When opening a trove on devnet where the sorted troves list already contains existing troves, you **MUST** provide those existing trove accounts via `.remainingAccounts()`. The smart contract's `find_insert_position` function needs to traverse the list to find where to insert the new trove based on ICR (Individual Collateral Ratio).

### The Problem

Error you see:
```
AnchorError: Error Code: InvalidList. Error Number: 6016.
```

This happens at line 541 in `sorted_troves.rs`:
```rust
require!(
    account_idx + 1 < remaining_accounts.len(),
    AerospacerProtocolError::InvalidList
);
```

The contract expects accounts to traverse the list, but if you don't provide them, it fails immediately.

### The Solution

```typescript
// 1. Fetch existing troves from the sorted list
const existingTrovesAccounts = await getExistingTrovesAccounts(
  provider,
  protocolProgram,
  sortedTrovesStatePDA
);

// 2. Pass them when opening a new trove
await protocolProgram.methods
  .openTrove({ ... })
  .accounts({ ... })
  .remainingAccounts(existingTrovesAccounts)  // ← CRITICAL!
  .rpc();
```

### Helper Function

The test file includes a `getExistingTrovesAccounts` helper that:
1. Checks if SortedTrovesState exists and has size > 0
2. Traverses the linked list starting from `head`
3. For each trove, fetches its `Node` and `LiquidityThreshold` accounts
4. **Validates account discriminators** to ensure accounts are actually valid (not corrupted)
5. Returns them in the order expected by the contract: `[node1, lt1, node2, lt2, ...]`
6. **Throws error if corruption detected** - tests will fail with clear instructions to reset devnet state or switch to localnet

## Fixing Corrupted Sorted Troves State

**⚠️ OBSOLETE (2025-01-24):** This section is no longer applicable with the new off-chain sorting architecture.

The protocol now uses **off-chain sorting** with on-chain validation only. There are no longer any `SortedTrovesState` or `Node` accounts to manage or reset. All trove ordering is handled client-side by fetching troves via RPC, sorting by ICR, and passing only neighbor hints for validation.

If you need to clean up old accounts from before the architecture migration, you can manually close them using `solana program close-account` command.

---

### ~~Step 1: Redeploy Program with Reset Instruction~~ (OBSOLETE)

~~The program now includes a `reset_sorted_troves` admin instruction. Build and deploy it:~~

```bash
# Build the program
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### ~~Step 2: Run the Cleanup Script~~ (OBSOLETE)

~~This will close the corrupted SortedTrovesState account:~~

```bash
# OBSOLETE - Script no longer exists
# npx ts-node scripts/close-sorted-troves-devnet.ts
```

~~**What this does:**~~
- ~~Calls the `reset_sorted_troves` instruction~~
- ~~Closes the corrupted SortedTrovesState account (lamports refunded to admin)~~
- ~~Next `openTrove` call will automatically reinitialize fresh state~~

### ~~Step 3: Run Your Tests~~ (OBSOLETE)

~~After cleanup, the sorted troves state is fresh and ready~~

~~The first `openTrove` in your tests will create a clean SortedTrovesState, and all subsequent troves will be inserted correctly.~~

### ~~Verification~~ (OBSOLETE)

~~After running the cleanup script, you can verify the account is closed~~

## Summary

The key takeaways for devnet testing:

1. **Collateral mints are immutable** - Always fetch from existing vault, never create new
2. **Off-chain sorting architecture** - Client fetches and sorts troves, passing only neighbor hints for validation
3. **Token balances required** - Users need sufficient collateral tokens before testing
4. **Mint authority detection** - Check carefully if you control the mint before attempting to mint tokens
