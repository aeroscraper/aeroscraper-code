# Aerospacer Protocol - Solana Implementation

A decentralized lending protocol built on Solana, featuring collateralized debt positions (CDPs), stablecoin minting, liquidation mechanisms, and a stability pool.

## 🚀 Overview

Aerospacer Protocol is a complete DeFi lending solution that allows users to:
- **Open Troves**: Create collateralized debt positions
- **Mint Stablecoins**: Borrow aUSD against collateral
- **Manage Risk**: Automatic liquidation of undercollateralized positions
- **Stake**: Participate in the stability pool for rewards
- **Redeem**: Exchange stablecoins for collateral from risky positions

## 🏗️ Architecture

The protocol consists of three main programs:

### 1. **Protocol Program** (`aerospacer-protocol`)
Core lending logic including:
- Trove management (open, add/remove collateral, borrow/repay)
- Liquidation system
- Stability pool operations
- Fee distribution

### 2. **Oracle Program** (`aerospacer-oracle`)
Price feed management:
- Collateral price data
- Pyth Network integration
- Price validation

### 3. **Fees Program** (`aerospacer-fees`)
Economic model:
- Protocol fee collection
- Fee distribution to stakeholders
- Economic parameter management

## 📋 Features

### Core Lending Features
- ✅ **Collateralized Debt Positions (CDPs)**
- ✅ **Stablecoin (aUSD) Minting**
- ✅ **Dynamic Collateral Management**
- ✅ **Automatic Liquidation System**
- ✅ **Stability Pool**
- ✅ **Fee Distribution Mechanism**

### Technical Features
- ✅ **Cross-Program Communication (CPI)**
- ✅ **Safe Math Operations**
- ✅ **Comprehensive Error Handling**
- ✅ **Real Token Operations (SPL)**
- ✅ **Oracle Integration**
- ✅ **Production-Ready Security**

## 🛠️ Installation

### Prerequisites
- Rust 1.70+
- Solana CLI 1.16+
- Anchor 0.28+
- Node.js 18+
- Yarn

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd aerospacer-solana

# Install dependencies
yarn install

# Build programs
anchor build

# Generate types
anchor build
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
anchor test

# Run specific test file
anchor test tests/aerospacer-solana.ts

# Run with verbose output
anchor test --verbose
```

### Test Coverage
The test suite covers:
- ✅ **Oracle Program**: Initialization, data setting, price queries
- ✅ **Fees Program**: Initialization, configuration
- ✅ **Protocol Program**: All lending operations
- ✅ **Error Handling**: Invalid operations, edge cases
- ✅ **Integration**: Cross-program communication

## 🚀 Deployment

### Local Development
```bash
# Start local validator
solana-test-validator

# Deploy to localnet
anchor deploy
```

### Devnet Deployment
```bash
# Switch to devnet
solana config set --url devnet

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Mainnet Deployment
```bash
# Switch to mainnet
solana config set --url mainnet-beta

# Deploy to mainnet
anchor deploy --provider.cluster mainnet
```

## 📊 Program Structure

```
aerospacer-solana/
├── programs/
│   ├── aerospacer-protocol/     # Core lending logic
│   ├── aerospacer-oracle/       # Price feed management
│   └── aerospacer-fees/         # Fee distribution
├── libs/
│   └── aerospacer-utils/        # Shared utilities
├── tests/                       # Test suite
├── migrations/                  # Deployment scripts
└── app/                        # Frontend application
```

## 🔧 Configuration

### Environment Variables
```bash
# Solana cluster
SOLANA_CLUSTER=devnet

# Program IDs (auto-generated)
PROTOCOL_PROGRAM_ID=<program-id>
ORACLE_PROGRAM_ID=<program-id>
FEES_PROGRAM_ID=<program-id>
```

### Protocol Parameters
- **Minimum Collateral Ratio**: 150%
- **Protocol Fee**: 0.5%
- **Liquidation Reward**: 0.5%
- **Minimum Loan Amount**: 100 aUSD

## 🔒 Security

### Security Features
- ✅ **Safe Math Operations**: Overflow protection
- ✅ **Access Control**: Admin-only functions
- ✅ **Input Validation**: Comprehensive parameter checks
- ✅ **Error Handling**: Graceful failure modes
- ✅ **State Consistency**: Atomic operations

### Audit Status
- 🔄 **Internal Review**: Complete
- 🔄 **External Audit**: Pending
- 🔄 **Formal Verification**: Planned

## 📈 Performance

### Gas Optimization
- **Efficient Storage**: Optimized account structures
- **Minimal CPI Calls**: Reduced cross-program invocations
- **Batch Operations**: Grouped transactions where possible

### Scalability
- **Horizontal Scaling**: Multiple programs
- **Modular Design**: Independent program updates
- **Upgradeable**: Program upgrade mechanisms

## 🤝 Contributing

### Development Workflow
1. **Fork** the repository
2. **Create** a feature branch
3. **Implement** changes with tests
4. **Submit** a pull request

### Code Standards
- **Rust**: Follow Rust conventions
- **Anchor**: Use Anchor best practices
- **Testing**: 100% test coverage
- **Documentation**: Comprehensive comments

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [Protocol Documentation](docs/protocol.md)
- [API Reference](docs/api.md)
- [Deployment Guide](docs/deployment.md)

### Community
- **Discord**: [Aerospacer Community](https://discord.gg/aerospacer)
- **Telegram**: [Aerospacer Protocol](https://t.me/aerospacer)
- **Twitter**: [@AerospacerProtocol](https://twitter.com/AerospacerProtocol)

### Issues
- **Bug Reports**: [GitHub Issues](https://github.com/aerospacer/aerospacer-solana/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/aerospacer/aerospacer-solana/discussions)

## 🎯 Roadmap

### Phase 1: Core Protocol ✅
- [x] Basic lending functionality
- [x] Oracle integration
- [x] Fee distribution
- [x] Testing framework

### Phase 2: Advanced Features 🔄
- [ ] Multi-collateral support
- [ ] Advanced liquidation mechanisms
- [ ] Governance system
- [ ] Frontend application

### Phase 3: Ecosystem Integration 📋
- [ ] DEX integration
- [ ] Yield farming
- [ ] Cross-chain bridges
- [ ] Mobile application

## 🙏 Acknowledgments

- **Solana Foundation** for the blockchain infrastructure
- **Anchor Framework** for the development framework
- **Pyth Network** for price feed services
- **Community Contributors** for feedback and testing

---

**Built with ❤️ for the Solana ecosystem** 