#!/bin/bash

# Aerospacer Protocol Deployment Script
# This script deploys all programs to the specified network

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if anchor is installed
    if ! command -v anchor &> /dev/null; then
        print_error "Anchor CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if solana is installed
    if ! command -v solana &> /dev/null; then
        print_error "Solana CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "Anchor.toml" ]; then
        print_error "Anchor.toml not found. Please run this script from the project root."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to build programs
build_programs() {
    print_status "Building programs..."
    
    if anchor build; then
        print_success "Programs built successfully"
    else
        print_error "Build failed"
        exit 1
    fi
}

# Function to deploy to localnet
deploy_localnet() {
    print_status "Deploying to localnet..."
    
    # Start local validator if not running
    if ! pgrep -f "solana-test-validator" > /dev/null; then
        print_warning "Local validator not running. Starting it..."
        solana-test-validator &
        sleep 5
    fi
    
    # Deploy programs
    if anchor deploy; then
        print_success "Deployed to localnet successfully"
    else
        print_error "Localnet deployment failed"
        exit 1
    fi
}

# Function to deploy to devnet
deploy_devnet() {
    print_status "Deploying to devnet..."
    
    # Switch to devnet
    solana config set --url devnet
    
    # Check devnet balance
    balance=$(solana balance)
    print_status "Current devnet balance: $balance"
    
    # Deploy programs
    if anchor deploy --provider.cluster devnet; then
        print_success "Deployed to devnet successfully"
        
        # Update program IDs in Anchor.toml
        update_program_ids
    else
        print_error "Devnet deployment failed"
        exit 1
    fi
}

# Function to deploy to mainnet
deploy_mainnet() {
    print_status "Deploying to mainnet..."
    
    # Confirm mainnet deployment
    read -p "Are you sure you want to deploy to mainnet? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Mainnet deployment cancelled"
        exit 0
    fi
    
    # Switch to mainnet
    solana config set --url mainnet-beta
    
    # Check mainnet balance
    balance=$(solana balance)
    print_status "Current mainnet balance: $balance"
    
    # Deploy programs
    if anchor deploy --provider.cluster mainnet; then
        print_success "Deployed to mainnet successfully"
        
        # Update program IDs in Anchor.toml
        update_program_ids
    else
        print_error "Mainnet deployment failed"
        exit 1
    fi
}

# Function to update program IDs in Anchor.toml
update_program_ids() {
    print_status "Updating program IDs..."
    
    # Get deployed program IDs
    protocol_id=$(solana address -k target/deploy/aerospacer_protocol-keypair.json)
    oracle_id=$(solana address -k target/deploy/aerospacer_oracle-keypair.json)
    fees_id=$(solana address -k target/deploy/aerospacer_fees-keypair.json)
    
    print_status "Program IDs:"
    print_status "  Protocol: $protocol_id"
    print_status "  Oracle: $oracle_id"
    print_status "  Fees: $fees_id"
    
    # Update Anchor.toml with new program IDs
    # This is a simplified version - in production you'd want more robust parsing
    print_warning "Please manually update the program IDs in Anchor.toml"
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    # Check if programs are deployed
    programs=("aerospacer_protocol" "aerospacer_oracle" "aerospacer_fees")
    
    for program in "${programs[@]}"; do
        if solana program show target/deploy/$program.so > /dev/null 2>&1; then
            print_success "$program deployed successfully"
        else
            print_error "$program deployment verification failed"
        fi
    done
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    
    if anchor test; then
        print_success "Tests passed"
    else
        print_error "Tests failed"
        exit 1
    fi
}

# Function to show help
show_help() {
    echo "Aerospacer Protocol Deployment Script"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  localnet    Deploy to localnet"
    echo "  devnet      Deploy to devnet"
    echo "  mainnet     Deploy to mainnet"
    echo "  test        Run tests"
    echo "  build       Build programs"
    echo "  verify      Verify deployment"
    echo "  help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 localnet    # Deploy to localnet"
    echo "  $0 devnet      # Deploy to devnet"
    echo "  $0 test        # Run tests"
}

# Main script logic
main() {
    case "${1:-help}" in
        "localnet")
            check_prerequisites
            build_programs
            deploy_localnet
            verify_deployment
            ;;
        "devnet")
            check_prerequisites
            build_programs
            deploy_devnet
            verify_deployment
            ;;
        "mainnet")
            check_prerequisites
            build_programs
            deploy_mainnet
            verify_deployment
            ;;
        "test")
            run_tests
            ;;
        "build")
            build_programs
            ;;
        "verify")
            verify_deployment
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Run main function with all arguments
main "$@" 