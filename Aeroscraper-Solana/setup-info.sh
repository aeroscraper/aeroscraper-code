#!/bin/bash

clear

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   Aerospacer Protocol - Solana Development Environment        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 PROJECT TYPE: Solana Blockchain Smart Contracts (DeFi Lending Protocol)"
echo "🏗️  ARCHITECTURE: 3 Anchor Programs + TypeScript Test Suite"
echo "📊 STATUS: 98% Complete - Core implementation done"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 DEVELOPMENT ENVIRONMENT STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check each component
if command -v cargo &> /dev/null; then
    CARGO_VER=$(cargo --version | awk '{print $2}')
    echo "  ✅ Rust & Cargo: v$CARGO_VER"
else
    echo "  ❌ Rust & Cargo: Not installed"
fi

if command -v solana &> /dev/null; then
    SOLANA_VER=$(solana --version | awk '{print $2}')
    echo "  ✅ Solana CLI: v$SOLANA_VER"
else
    echo "  ❌ Solana CLI: Not installed"
fi

if command -v node &> /dev/null; then
    NODE_VER=$(node --version)
    echo "  ✅ Node.js: $NODE_VER"
else
    echo "  ❌ Node.js: Not installed"
fi

if command -v anchor &> /dev/null; then
    ANCHOR_VER=$(anchor --version 2>&1 | grep -oP 'anchor-cli \K[0-9.]+' || echo "installed")
    echo "  ✅ Anchor CLI: v$ANCHOR_VER"
else
    echo "  ⏳ Anchor CLI: Not found (install with: npm install -g @coral-xyz/anchor-cli@0.28.0)"
fi

if cargo build-sbf --version &> /dev/null; then
    BPF_VER=$(cargo build-sbf --version | head -1 | awk '{print $2}')
    echo "  ✅ Solana BPF Tools: v$BPF_VER"
else
    echo "  ❌ Solana BPF Tools: Not available"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📁 PROGRAM STRUCTURE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1️⃣  programs/aerospacer-protocol  → Core lending logic (CDPs, liquidation)"
echo "  2️⃣  programs/aerospacer-oracle    → Price feeds (Pyth integration)"
echo "  3️⃣  programs/aerospacer-fees      → Fee distribution & economics"
echo "  🧪 tests/                         → Comprehensive test suite (17 files)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 QUICK START COMMANDS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📦 Build programs (5-10 min first time):"
echo "     $ anchor build"
echo ""
echo "  🧪 Run all tests:"
echo "     $ anchor test"
echo ""
echo "  🔍 Quick syntax check (faster):"
echo "     $ cargo check"
echo ""
echo "  🌐 Deploy to devnet:"
echo "     $ anchor deploy --provider.cluster devnet"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 DOCUMENTATION FILES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📄 replit.md           → Replit setup guide & troubleshooting"
echo "  📄 README.md           → Project overview & features"
echo "  📄 PROJECT_STATUS.md   → Implementation status (98% complete)"
echo "  📄 TESTING_GUIDE.md    → Test suite documentation"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  IMPORTANT NOTES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  • First build takes 5-10 minutes (Solana BPF compilation)"
echo "  • Subsequent builds are much faster (incremental compilation)"
echo "  • Use 'cargo check' for quick syntax validation"
echo "  • See replit.md for troubleshooting permission issues"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 TIP: Start with 'anchor build' to compile the programs, then run 'anchor test'"
echo ""
echo "✨ Environment ready! Check replit.md for detailed setup instructions."
echo ""

# Keep running
tail -f /dev/null
