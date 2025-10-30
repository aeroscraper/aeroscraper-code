# 🚀 Oracle Contract Devnet Deployment & Testing Guide

This comprehensive guide will walk you through deploying and testing the Aerospacer Oracle contract on Solana devnet.

## 📋 Prerequisites

- Solana CLI installed and configured
- Anchor CLI installed
- Node.js and npm installed
- Sufficient SOL balance on devnet (at least 2-3 SOL)
- Valid Solana keypair

## 🔧 Environment Setup

### 1. Navigate to Project Directory
```bash
cd /home/taha/Documents/Projects/Aeroscraper/aerospacer-solana
```

### 2. Set Environment Variables
```bash
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=~/.config/solana/id.json
```

### 3. Verify Configuration
```bash
# Check Solana configuration
solana config get
solana config set --url http://localhost:8899
solana config set --url https://api.devnet.solana.com
solana config set --url https://api.testnet.solana.com
solana config set --url https://api.mainnet-beta.solana.com

# Check wallet balance
solana balance

# Check Anchor version
anchor --version
```

## 🏗️ Build and Deploy

### 1. Build Oracle Contract
```bash
anchor build --program-name aerospacer-oracle
```

### 2. Verify Build Output
```bash
ls -la target/deploy/
```

### 3. Deploy to Devnet
```bash
anchor deploy --provider.cluster devnet --program-name aerospacer-oracle
```

### 4. Verify Deployment
```bash
solana program show 8zG12srZdYaJPjWzCAJhwyxF7wWTz5spbmehxWpV5Q9M --url devnet
```

## 🚀 Initialize Oracle Contract

### 1. Initialize Oracle State
```bash
npm run init-oracle-devnet
```

**Expected Output:**
- Oracle state account created
- Admin set to your wallet
- Oracle address configured
- Initial configuration complete

### 2. Verify Initialization
```bash
# Check if state account exists
solana account <STATE_ACCOUNT_ADDRESS> --url devnet
```

## 📊 Add Collateral Assets

### 1. Add Supported Assets
```bash
npm run add-assets-devnet
```

**This will add:**
- **SOL** (Solana) - Pyth feed: `J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix`
- **ETH** (Ethereum) - Pyth feed: `EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw`
- **BTC** (Bitcoin) - Pyth feed: `HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J`

### 2. Verify Asset Addition
```bash
# Check oracle state for added assets
solana logs 8zG12srZdYaJPjWzCAJhwyxF7wWTz5spbmehxWpV5Q9M --url devnet
```

## 🔍 Test Price Queries

### 1. Test Real-time Price Queries
```bash
npm run test-prices-devnet
```

**Expected Output:**
- SOL price query
- ETH price query
- BTC price query
- Batch price query
- Error handling tests


## 🧪 Run Comprehensive Tests

### 1. Run All Oracle Tests
```bash
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx ts-mocha -p ./tsconfig.json -t 1000000 'tests/**/oracle-*.ts'
```

### 2. Run Specific Test Suites
```bash
# Admin controls tests
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx ts-mocha -p ./tsconfig.json -t 1000000 'tests/oracle-admin-controls.ts'

# Edge cases tests
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx ts-mocha -p ./tsconfig.json -t 1000000 'tests/oracle-edge-cases.ts'

# Security tests
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx ts-mocha -p ./tsconfig.json -t 1000000 'tests/oracle-security.ts'

# Price query tests
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx ts-mocha -p ./tsconfig.json -t 1000000 'tests/oracle-price-queries.ts'
```

## 📈 Monitor and Verify

### 1. Check Deployment Status
```bash
# Verify program is deployed
solana program show 8zG12srZdYaJPjWzCAJhwyxF7wWTz5spbmehxWpV5Q9M --url devnet

# Check wallet balance
solana balance --url devnet

# List all your programs
solana program show --programs --url devnet
```

### 2. Monitor Transactions
```bash
# View recent transactions
solana transaction-history --url devnet

# Check specific transaction
solana confirm <TRANSACTION_SIGNATURE> --url devnet

# View program logs
solana logs 8zG12srZdYaJPjWzCAJhwyxF7wWTz5spbmehxWpV5Q9M --url devnet
```

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Deployment Failures
```bash
# Check Solana CLI version
solana --version

# Update Solana CLI if needed
sh -c "$(curl -sSfL https://release.solana.com/v1.18.4/install)"

# Check Anchor version
anchor --version

# Update Anchor if needed
npm install -g @coral-xyz/anchor-cli@latest
```

#### 2. Test Failures
```bash
# Check TypeScript compilation
npx tsc --noEmit

# Check for linting errors
npm run lint

# Run tests with verbose output
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx ts-mocha -p ./tsconfig.json -t 1000000 'tests/**/oracle-*.ts' --reporter spec
```

#### 3. Price Query Failures
```bash
# Check devnet status
curl -s https://api.devnet.solana.com | jq

# Verify Pyth price feeds are active
# SOL: J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix
# ETH: EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw
# BTC: HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J
```

#### 4. Insufficient Funds
```bash
# Request SOL from devnet faucet
solana airdrop 2 --url devnet

# Check balance
solana balance --url devnet
```

## 📊 Expected Results

### Successful Deployment Indicators
- ✅ **Oracle Program Deployed**: `8zG12srZdYaJPjWzCAJhwyxF7wWTz5spbmehxWpV5Q9M`
- ✅ **State Account Initialized**: With admin and oracle address
- ✅ **3 Assets Configured**: SOL, ETH, BTC with Pyth feeds
- ✅ **Price Queries Working**: Real-time prices from Pyth devnet
- ✅ **All Tests Passing**: 60+ tests should pass
- ✅ **Mock Data Fallback**: If Pyth feeds are unavailable

### Test Coverage
- **Admin Controls**: 10+ tests
- **Edge Cases**: 15+ tests
- **Info Queries**: 8+ tests
- **Initialization**: 5+ tests
- **Integration**: 10+ tests
- **Security**: 12+ tests
- **Price Queries**: 15+ tests

## 🎯 Complete Command Sequence

Here's the complete sequence you can copy and paste:

```bash
# Navigate to project
cd /home/taha/Documents/Projects/Aeroscraper/aerospacer-solana

# Set environment
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=~/.config/solana/id.json

# Check wallet
solana config get
solana balance

# Build oracle
anchor build --program-name aerospacer-oracle

# Deploy to devnet
anchor deploy --provider.cluster devnet --program-name aerospacer-oracle

# Verify deployment
solana program show 8zG12srZdYaJPjWzCAJhwyxF7wWTz5spbmehxWpV5Q9M --url devnet

# Initialize oracle
npm run init-oracle-devnet

# Add assets
npm run add-assets-devnet

# Test prices
npm run test-prices-devnet

# Run all tests
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com npx ts-mocha -p ./tsconfig.json -t 1000000 'tests/**/oracle-*.ts'

# Check final status
solana balance --url devnet
solana program show --programs --url devnet
```

## 📝 Notes

- **Pyth Integration**: The oracle uses Pyth Network for real-time price feeds
- **Mock Data**: If Pyth feeds are unavailable, mock data will be used for testing
- **Error Handling**: Comprehensive error handling for various failure scenarios
- **Security**: Admin-only functions for critical operations
- **Scalability**: Supports batch operations for multiple assets

## 🆘 Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Verify your environment setup
3. Ensure sufficient SOL balance
4. Check devnet status and Pyth feed availability
5. Review program logs for detailed error messages

---

**Last Updated**: January 2025  
**Oracle Program ID**: `8zG12srZdYaJPjWzCAJhwyxF7wWTz5spbmehxWpV5Q9M`  
**Network**: Solana Devnet