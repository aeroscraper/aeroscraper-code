'use client';

import { useState } from 'react';
import { Transaction, PublicKey } from '@solana/web3.js';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { useAppKitConnection } from '@reown/appkit-adapter-solana/react';
import { buildOpenTroveInstruction } from '@/lib/solana/buildInstructions';
import { getNeighborHints } from '@/lib/solana/getNeighborHints';
import { useProtocolState } from './useProtocolState';

interface SolanaWalletProvider {
    publicKey: PublicKey;
    signAndSendTransaction(transaction: Transaction): Promise<string>;
}

export function useSolanaProtocol() {
    const { address, isConnected } = useAppKitAccount();
    const { connection } = useAppKitConnection();
    const { walletProvider } = useAppKitProvider('solana') as { walletProvider?: SolanaWalletProvider };

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { protocolState, loading: stateLoading } = useProtocolState();

    const openTrove = async (params: {
        collateralAmount: number; // SOL in lamports
        loanAmount: string; // aUSD as string
    }) => {
        if (!isConnected || !walletProvider || !address) {
            throw new Error('Wallet not connected');
        }

        if (!connection) {
            throw new Error('Connection not available');
        }

        if (!protocolState) {
            throw new Error('Protocol state not loaded');
        }

        try {
            setLoading(true);
            setError(null);

            const userPublicKey = new PublicKey(address);
            const {
                stablecoinMint,
                collateralMint,
                oracleProgramId,
                oracleState,
                feesProgramId,
                feesState,
            } = protocolState;

            const neighborHints = await getNeighborHints(
                connection,
                userPublicKey,
                params.collateralAmount,
                params.loanAmount,
                'SOL' // collateral denom
            );

            console.log('📊 Neighbor hints:', neighborHints.length, 'accounts');

            // Validate token accounts exist (for collateral SPL token, not native SOL)
            console.log('🔍 Validating collateral token account exists...');
            const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');

            const userCollateralATA = await getAssociatedTokenAddress(collateralMint, userPublicKey);
            const userStablecoinATA = await getAssociatedTokenAddress(stablecoinMint, userPublicKey);

            console.log('📝 User Collateral ATA:', userCollateralATA.toBase58());
            console.log('📝 User Stablecoin ATA:', userStablecoinATA.toBase58());
            console.log('📝 Collateral Mint:', collateralMint.toBase58());

            try {
                const userCollateralAccount = await getAccount(connection, userCollateralATA);
                console.log('✅ User collateral token account exists');
                console.log('💰 Collateral token balance:', userCollateralAccount.amount.toString());

                // Check if user has sufficient collateral tokens
                if (userCollateralAccount.amount < BigInt(params.collateralAmount)) {
                    throw new Error(`Insufficient collateral tokens. Required: ${params.collateralAmount / 1e9}, Available: ${userCollateralAccount.amount.toString()}`);
                }
                console.log('✅ User has sufficient collateral tokens');
            } catch (error: any) {
                if (error.code === 2002) { // TokenAccountNotFoundError
                    throw new Error('Collateral token account does not exist. User needs to receive collateral tokens first. Please contact protocol admin for test tokens.');
                }
                throw error;
            }

            // Check if user stablecoin account exists, create if it doesn't
            console.log('🔍 Checking if user stablecoin account exists...');
            let needsCreateStablecoinAccount = false;
            try {
                const userStablecoinAccountInfo = await getAccount(connection, userStablecoinATA);
                console.log('✅ User stablecoin account exists');
            } catch (error: any) {
                if (error.name === 'TokenAccountNotFoundError' || error.code === 2002) {
                    console.log('⚠️  User stablecoin account does not exist - will create in transaction');
                    needsCreateStablecoinAccount = true;
                } else {
                    throw error;
                }
            }

            // Build instruction WITH neighbor hints
            console.log('🚀 Starting instruction build...');
            console.log('📋 Open Trove Parameters:');
            console.log('  - User:', userPublicKey.toBase58());
            console.log('  - Collateral Amount:', params.collateralAmount, 'lamports');
            console.log('  - Loan Amount:', params.loanAmount, 'aUSD');
            console.log('  - Collateral Denom: SOL');
            console.log('  - Collateral Mint:', collateralMint.toBase58());
            console.log('  - Stablecoin Mint:', stablecoinMint.toBase58());
            console.log('  - Oracle Program:', oracleProgramId.toBase58());
            console.log('  - Oracle State:', oracleState.toBase58());
            console.log('  - Fees Program:', feesProgramId.toBase58());
            console.log('  - Fees State:', feesState.toBase58());
            console.log('  - Neighbor Hints:', neighborHints.length, 'accounts');

            const { instruction } = await buildOpenTroveInstruction(
                userPublicKey,
                collateralMint,
                stablecoinMint,
                oracleProgramId,
                oracleState,
                feesProgramId,
                feesState,
                params.collateralAmount,
                params.loanAmount,
                'SOL',
                neighborHints // Pass to instruction builder
            );
            console.log('✅ Instruction built, creating transaction...');

            // Build transaction
            const tx = new Transaction();

            // Add ATA creation instruction if needed (BEFORE open_trove)
            if (needsCreateStablecoinAccount) {
                console.log('➕ Adding stablecoin ATA creation instruction...');
                const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
                const createATAInstruction = createAssociatedTokenAccountInstruction(
                    walletProvider.publicKey, // payer (will be fee payer)
                    userStablecoinATA, // ATA address to create
                    userPublicKey, // owner of the ATA
                    stablecoinMint // mint
                );
                tx.add(createATAInstruction);
                console.log('✅ Added stablecoin ATA creation instruction');
            }

            // Add open_trove instruction
            tx.add(instruction);
            tx.feePayer = walletProvider.publicKey;
            console.log('📝 Fee payer:', walletProvider.publicKey.toBase58());
            console.log('📦 Transaction details:');
            console.log('  - Instruction count:', tx.instructions.length);
            console.log('  - First instruction data length:', tx.instructions[0]?.data.length || 0);
            console.log('  - First instruction accounts:', tx.instructions[0]?.keys.length || 0);

            console.log('🔄 Getting latest blockhash...');
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            console.log('✅ Got blockhash:', blockhash);

            tx.recentBlockhash = blockhash;

            // Sign and send
            console.log('✍️  Signing and sending transaction...');
            console.log('📋 Final transaction summary:');
            console.log('  - Blockhash:', blockhash);
            console.log('  - Last valid block height:', lastValidBlockHeight);
            console.log('  - Fee payer:', walletProvider.publicKey.toBase58());
            console.log('  - All accounts in instruction:', instruction.keys.length);

            // Simulate transaction FIRST to catch errors before wallet signing
            console.log('🔍 Simulating transaction...');
            try {
                const simulationResult = await connection.simulateTransaction(tx);
                console.log('📊 Simulation result:');
                console.log('  - Error:', simulationResult.value.err);
                console.log('  - Logs:', simulationResult.value.logs || 'No logs');
                console.log('  - Units consumed:', simulationResult.value.unitsConsumed);

                if (simulationResult.value.err) {
                    console.error('❌ Transaction simulation failed with error:', simulationResult.value.err);
                    throw new Error(`Transaction simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
                }
                console.log('✅ Simulation passed - transaction is valid');
            } catch (simError: any) {
                console.error('❌ Simulation error:', simError);
                throw new Error(`Transaction would fail: ${simError.message}`);
            }

            console.log('✍️  Sending transaction to wallet for signing...');
            const signature = await walletProvider.signAndSendTransaction(tx);
            console.log('✅ Transaction sent, signature:', signature);

            // Wait for confirmation
            console.log('⏳ Waiting for confirmation...');
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight,
            });
            console.log('✅ Transaction confirmed!');

            return signature;
        } catch (err: any) {
            // Enhanced error logging for debugging
            console.error('❌ FULL ERROR DETAILS:');
            console.error('Error object:', err);
            console.error('Error code:', err.code);
            console.error('Error name:', err.name);
            console.error('Error message:', err.message);
            console.error('Stack trace:', err.stack);

            // Try to extract program logs
            if (err.logs && Array.isArray(err.logs)) {
                console.error('📋 All logs:', err.logs);
                const programLogs = err.logs.filter((log: string) => log.includes('Program'));
                console.error('🔍 Program logs:', programLogs);
                const errorLogs = err.logs.filter((log: string) => log.includes('Error') || log.includes('failed'));
                console.error('🚨 Error logs:', errorLogs);
            }

            // Check for transaction errors
            if (err.transaction) {
                console.error('💾 Transaction:', err.transaction);
            }

            const errorMessage = err.message || 'Failed to open trove';
            setError(errorMessage);

            // Re-throw original error to preserve details
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const addCollateral = async (params: {
        collateralAmount: number; // SOL in lamports
    }) => {
        if (!isConnected || !walletProvider || !address) {
            throw new Error('Wallet not connected');
        }

        if (!connection) {
            throw new Error('Connection not available');
        }

        if (!protocolState) {
            throw new Error('Protocol state not loaded');
        }

        try {
            setLoading(true);
            setError(null);

            const userPublicKey = new PublicKey(address);
            const { collateralMint, oracleProgramId, oracleState } = protocolState;

            // 1. Fetch current trove state
            const { fetchUserTroveState } = await import('@/lib/solana/fetchTroveState');
            const currentTrove = await fetchUserTroveState(connection, userPublicKey, 'SOL');

            if (!currentTrove) {
                throw new Error('Trove does not exist. Please open a trove first.');
            }

            // 2. Calculate new total collateral
            const newTotalCollateral = Number(currentTrove.collateralAmount) + params.collateralAmount;
            const currentDebt = currentTrove.debt.toString();

            // 3. Get neighbor hints with new collateral amount
            const neighborHints = await getNeighborHints(
                connection,
                userPublicKey,
                newTotalCollateral,
                currentDebt,
                'SOL'
            );

            console.log('📊 Add Collateral Parameters:');
            console.log('  - Current Collateral:', currentTrove.collateralAmount.toString());
            console.log('  - Adding:', params.collateralAmount);
            console.log('  - New Total:', newTotalCollateral);
            console.log('  - Current Debt:', currentDebt);
            console.log('  - Neighbor Hints:', neighborHints.length);

            // 4. Validate collateral token account and balance
            const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');
            const userCollateralATA = await getAssociatedTokenAddress(collateralMint, userPublicKey);

            const userCollateralAccount = await getAccount(connection, userCollateralATA);
            if (userCollateralAccount.amount < BigInt(params.collateralAmount)) {
                throw new Error(`Insufficient collateral tokens. Required: ${params.collateralAmount / 1e9}, Available: ${userCollateralAccount.amount.toString()}`);
            }

            // 5. Build instruction
            const { buildAddCollateralInstruction } = await import('@/lib/solana/buildInstructions');
            const { instruction } = await buildAddCollateralInstruction(
                userPublicKey,
                collateralMint,
                oracleProgramId,
                oracleState,
                params.collateralAmount,
                'SOL',
                neighborHints
            );

            console.log('✅ Instruction built, creating transaction...');

            // 6. Build and send transaction
            const tx = new Transaction();
            tx.add(instruction);
            tx.feePayer = walletProvider.publicKey;

            console.log('📝 Fee payer:', walletProvider.publicKey.toBase58());
            console.log('📦 Transaction details:');
            console.log('  - Instruction count:', tx.instructions.length);
            console.log('  - First instruction data length:', tx.instructions[0]?.data.length || 0);
            console.log('  - First instruction accounts:', tx.instructions[0]?.keys.length || 0);

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            tx.recentBlockhash = blockhash;

            console.log('🔄 Getting latest blockhash...');
            console.log('✅ Got blockhash:', blockhash);

            // Simulate first
            console.log('🔍 Simulating add_collateral transaction...');
            const simulationResult = await connection.simulateTransaction(tx);
            console.log('📊 Simulation result:');
            console.log('  - Error:', simulationResult.value.err);
            console.log('  - Logs:', simulationResult.value.logs || 'No logs');
            console.log('  - Units consumed:', simulationResult.value.unitsConsumed);

            if (simulationResult.value.err) {
                console.error('❌ Simulation failed with error:', simulationResult.value.err);
                throw new Error(`Transaction simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
            }

            console.log('✅ Simulation passed - transaction is valid');

            // Sign and send
            console.log('✍️  Sending transaction to wallet for signing...');
            const signature = await walletProvider.signAndSendTransaction(tx);
            console.log('✅ Transaction sent, signature:', signature);

            // Wait for confirmation
            console.log('⏳ Waiting for confirmation...');
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight,
            });
            console.log('✅ Transaction confirmed!');

            return signature;
        } catch (err: any) {
            console.error('❌ Add collateral error:', err);
            setError(err.message || 'Failed to add collateral');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const removeCollateral = async (params: {
        collateralAmount: number; // SOL in lamports
    }) => {
        if (!isConnected || !walletProvider || !address) {
            throw new Error('Wallet not connected');
        }

        if (!connection) {
            throw new Error('Connection not available');
        }

        if (!protocolState) {
            throw new Error('Protocol state not loaded');
        }

        try {
            setLoading(true);
            setError(null);

            const userPublicKey = new PublicKey(address);
            const { collateralMint, oracleProgramId, oracleState } = protocolState;

            // 1. Fetch current trove state
            const { fetchUserTroveState } = await import('@/lib/solana/fetchTroveState');
            const currentTrove = await fetchUserTroveState(connection, userPublicKey, 'SOL');

            if (!currentTrove) {
                throw new Error('Trove does not exist. Please open a trove first.');
            }

            // 2. Validate sufficient collateral
            if (currentTrove.collateralAmount < BigInt(params.collateralAmount)) {
                throw new Error(`Insufficient collateral in trove. Available: ${Number(currentTrove.collateralAmount) / 1e9} SOL`);
            }

            // 3. Calculate new collateral amount after removal
            const newTotalCollateral = Number(currentTrove.collateralAmount) - params.collateralAmount;
            const currentDebt = currentTrove.debt.toString();

            // 4. Validate new ICR won't drop below minimum (115%)
            const MINIMUM_ICR = 115; // 115%
            const estimatedPrice = 140; // Conservative SOL price estimate in USD
            const collateralValueUSD = (newTotalCollateral / 1e9) * estimatedPrice;
            const debtValueUSD = Number(currentDebt) / 1e18;
            const newICR = (collateralValueUSD / debtValueUSD) * 100;

            console.log('📊 Remove Collateral Validation:');
            console.log('  - Current Collateral:', currentTrove.collateralAmount.toString());
            console.log('  - Removing:', params.collateralAmount);
            console.log('  - New Total:', newTotalCollateral);
            console.log('  - Current Debt:', currentDebt);
            console.log('  - Estimated New ICR:', newICR.toFixed(2), '%');
            console.log('  - Minimum ICR Required:', MINIMUM_ICR, '%');

            if (newICR < MINIMUM_ICR) {
                throw new Error(`Removing this collateral would drop ICR below minimum (${MINIMUM_ICR}%). New ICR would be ${newICR.toFixed(2)}%. Risk of liquidation.`);
            }

            // 5. Get neighbor hints with new collateral amount
            const neighborHints = await getNeighborHints(
                connection,
                userPublicKey,
                newTotalCollateral,
                currentDebt,
                'SOL'
            );

            console.log('  - Neighbor Hints:', neighborHints.length);

            // 6. Build instruction
            const { buildRemoveCollateralInstruction } = await import('@/lib/solana/buildInstructions');
            const { instruction } = await buildRemoveCollateralInstruction(
                userPublicKey,
                collateralMint,
                oracleProgramId,
                oracleState,
                params.collateralAmount,
                'SOL',
                neighborHints
            );

            console.log('✅ Instruction built, creating transaction...');

            // 7. Build and send transaction
            const tx = new Transaction();
            tx.add(instruction);
            tx.feePayer = walletProvider.publicKey;

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            tx.recentBlockhash = blockhash;

            // Simulate first
            console.log('🔍 Simulating remove_collateral transaction...');
            const simulationResult = await connection.simulateTransaction(tx);
            console.log('📊 Simulation result:');
            console.log('  - Error:', simulationResult.value.err);
            console.log('  - Logs:', simulationResult.value.logs || 'No logs');
            console.log('  - Units consumed:', simulationResult.value.unitsConsumed);

            if (simulationResult.value.err) {
                console.error('❌ Simulation failed:', simulationResult.value.err);
                throw new Error(`Transaction simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
            }

            console.log('✅ Simulation passed - transaction is valid');

            // Sign and send
            console.log('✍️  Sending transaction to wallet for signing...');
            const signature = await walletProvider.signAndSendTransaction(tx);
            console.log('✅ Transaction sent, signature:', signature);

            // Wait for confirmation
            console.log('⏳ Waiting for confirmation...');
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight,
            });
            console.log('✅ Transaction confirmed!');

            return signature;
        } catch (err: any) {
            console.error('❌ Remove collateral error:', err);
            setError(err.message || 'Failed to remove collateral');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const borrowLoan = async (params: {
        loanAmount: number; // aUSD amount in smallest unit (1e18)
    }) => {
        if (!isConnected || !walletProvider || !address) {
            throw new Error('Wallet not connected');
        }

        if (!connection) {
            throw new Error('Connection not available');
        }

        if (!protocolState) {
            throw new Error('Protocol state not loaded');
        }

        try {
            setLoading(true);
            setError(null);

            const userPublicKey = new PublicKey(address);
            const { collateralMint, stablecoinMint, oracleProgramId, oracleState, feesProgramId, feesState } = protocolState;

            // 1. Fetch current trove state
            const { fetchUserTroveState } = await import('@/lib/solana/fetchTroveState');
            const currentTrove = await fetchUserTroveState(connection, userPublicKey, 'SOL');

            if (!currentTrove) {
                throw new Error('Trove does not exist. Please open a trove first.');
            }

            // 2. Validate loan amount is above minimum
            const MINIMUM_LOAN_AMOUNT = 1_000_000_000_000_000; // 0.001 aUSD in smallest unit
            if (params.loanAmount < MINIMUM_LOAN_AMOUNT) {
                throw new Error(`Loan amount must be at least ${MINIMUM_LOAN_AMOUNT / 1e18} aUSD`);
            }

            // 3. Calculate new debt after borrowing (including fee)
            const PROTOCOL_FEE = 0.05; // 5%
            const feeAmount = Math.floor(params.loanAmount * PROTOCOL_FEE);
            const netLoanAmount = params.loanAmount - feeAmount;
            const newTotalDebt = Number(currentTrove.debt) + params.loanAmount;
            const currentCollateral = Number(currentTrove.collateralAmount);

            // 4. Validate new ICR stays above minimum (115%)
            const MINIMUM_ICR = 115; // 115%
            const estimatedPrice = 140; // Conservative SOL price estimate in USD
            const collateralValueUSD = (currentCollateral / 1e9) * estimatedPrice;
            const newDebtValueUSD = newTotalDebt / 1e18;
            const newICR = (collateralValueUSD / newDebtValueUSD) * 100;

            console.log('📊 Borrow Loan Validation:');
            console.log('  - Current Collateral:', currentCollateral);
            console.log('  - Current Debt:', currentTrove.debt.toString());
            console.log('  - Borrowing Amount:', params.loanAmount);
            console.log('  - Fee Amount:', feeAmount);
            console.log('  - Net Loan Amount:', netLoanAmount);
            console.log('  - New Total Debt:', newTotalDebt);
            console.log('  - Estimated New ICR:', newICR.toFixed(2), '%');
            console.log('  - Minimum ICR Required:', MINIMUM_ICR, '%');

            if (newICR < MINIMUM_ICR) {
                throw new Error(`Borrowing this amount would drop ICR below minimum (${MINIMUM_ICR}%). New ICR would be ${newICR.toFixed(2)}%. Cannot borrow.`);
            }

            // 5. Get neighbor hints with new debt
            const neighborHints = await getNeighborHints(
                connection,
                userPublicKey,
                currentCollateral,
                newTotalDebt.toString(),
                'SOL'
            );

            console.log('  - Neighbor Hints:', neighborHints.length);

            // 6. Build instruction
            const { buildBorrowLoanInstruction } = await import('@/lib/solana/buildInstructions');
            const { instruction } = await buildBorrowLoanInstruction(
                userPublicKey,
                collateralMint,
                stablecoinMint,
                oracleProgramId,
                oracleState,
                feesProgramId,
                feesState,
                params.loanAmount,
                'SOL',
                neighborHints
            );

            console.log('✅ Instruction built, creating transaction...');

            // 7. Build and send transaction
            const tx = new Transaction();
            tx.add(instruction);
            tx.feePayer = walletProvider.publicKey;

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            tx.recentBlockhash = blockhash;

            // Simulate first
            console.log('🔍 Simulating borrow_loan transaction...');
            const simulationResult = await connection.simulateTransaction(tx);
            console.log('📊 Simulation result:');
            console.log('  - Error:', simulationResult.value.err);
            console.log('  - Logs:', simulationResult.value.logs || 'No logs');
            console.log('  - Units consumed:', simulationResult.value.unitsConsumed);

            if (simulationResult.value.err) {
                console.error('❌ Simulation failed:', simulationResult.value.err);
                throw new Error(`Transaction simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
            }

            console.log('✅ Simulation passed - transaction is valid');

            // Sign and send
            console.log('✍️  Sending transaction to wallet for signing...');
            const signature = await walletProvider.signAndSendTransaction(tx);
            console.log('✅ Transaction sent, signature:', signature);

            // Wait for confirmation
            console.log('⏳ Waiting for confirmation...');
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight,
            });
            console.log('✅ Transaction confirmed!');

            return signature;
        } catch (err: any) {
            console.error('❌ Borrow loan error:', err);
            setError(err.message || 'Failed to borrow loan');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const repayLoan = async (params: {
        repayAmount: number; // aUSD amount in smallest unit (1e18)
    }) => {
        if (!isConnected || !walletProvider || !address) {
            throw new Error('Wallet not connected');
        }

        if (!connection) {
            throw new Error('Connection not available');
        }

        if (!protocolState) {
            throw new Error('Protocol state not loaded');
        }

        try {
            setLoading(true);
            setError(null);

            const userPublicKey = new PublicKey(address);
            const { collateralMint, stablecoinMint, oracleProgramId, oracleState } = protocolState;

            // 1. Fetch current trove state
            const { fetchUserTroveState } = await import('@/lib/solana/fetchTroveState');
            const currentTrove = await fetchUserTroveState(connection, userPublicKey, 'SOL');

            if (!currentTrove) {
                throw new Error('Trove does not exist. Please open a trove first.');
            }

            // 2. Validate repayment amount
            if (params.repayAmount <= 0) {
                throw new Error('Repayment amount must be greater than zero');
            }

            const currentDebt = Number(currentTrove.debt);

            if (params.repayAmount > currentDebt) {
                throw new Error(`Repayment amount (${params.repayAmount / 1e18} aUSD) exceeds current debt (${currentDebt / 1e18} aUSD)`);
            }

            // 3. Check user stablecoin balance
            const { getAccount, getAssociatedTokenAddress } = await import('@solana/spl-token');
            const userStablecoinAccount = await getAssociatedTokenAddress(stablecoinMint, userPublicKey);

            try {
                const stablecoinAccountInfo = await getAccount(connection, userStablecoinAccount);
                const userBalance = Number(stablecoinAccountInfo.amount);

                if (params.repayAmount > userBalance) {
                    throw new Error(`Insufficient aUSD balance. You have ${userBalance / 1e18} aUSD but need ${params.repayAmount / 1e18} aUSD`);
                }
            } catch (err: any) {
                if (err.message?.includes('could not find account')) {
                    throw new Error('You do not have any aUSD tokens to repay');
                }
                throw err;
            }

            // 4. Calculate new debt after repayment
            const newDebt = currentDebt - params.repayAmount;
            const currentCollateral = Number(currentTrove.collateralAmount);

            // 5. Validate partial repayment leaves debt above minimum
            const MINIMUM_LOAN_AMOUNT = 1_000_000_000_000_000; // 0.001 aUSD
            if (newDebt > 0 && newDebt < MINIMUM_LOAN_AMOUNT) {
                throw new Error(
                    `Partial repayment would leave debt (${newDebt / 1e18} aUSD) below minimum (${MINIMUM_LOAN_AMOUNT / 1e18} aUSD). ` +
                    `Either repay less to stay above minimum, or repay full amount (${currentDebt / 1e18} aUSD) to close the trove.`
                );
            }

            console.log('📊 Repay Loan Validation:');
            console.log('  - Current Collateral:', currentCollateral);
            console.log('  - Current Debt:', currentDebt);
            console.log('  - Repaying Amount:', params.repayAmount);
            console.log('  - New Debt:', newDebt);
            console.log('  - Full Repayment:', newDebt === 0 ? 'Yes' : 'No');

            // 6. Get neighbor hints with new debt (if not fully repaying)
            let neighborHints: PublicKey[] = [];
            if (newDebt > 0) {
                neighborHints = await getNeighborHints(
                    connection,
                    userPublicKey,
                    currentCollateral,
                    newDebt.toString(),
                    'SOL'
                );
                console.log('  - Neighbor Hints:', neighborHints.length, '(partial repayment)');
            } else {
                console.log('  - Neighbor Hints: 0 (full repayment - trove will be removed from list)');
            }

            // 7. Build instruction
            const { buildRepayLoanInstruction } = await import('@/lib/solana/buildInstructions');
            const { instruction } = await buildRepayLoanInstruction(
                userPublicKey,
                collateralMint,
                stablecoinMint,
                oracleProgramId,
                oracleState,
                params.repayAmount,
                'SOL',
                neighborHints
            );

            console.log('✅ Instruction built, creating transaction...');

            // 8. Build and send transaction
            const tx = new Transaction();
            tx.add(instruction);
            tx.feePayer = walletProvider.publicKey;

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            tx.recentBlockhash = blockhash;

            // Simulate first
            console.log('🔍 Simulating repay_loan transaction...');
            const simulationResult = await connection.simulateTransaction(tx);
            console.log('📊 Simulation result:');
            console.log('  - Error:', simulationResult.value.err);
            console.log('  - Logs:', simulationResult.value.logs || 'No logs');
            console.log('  - Units consumed:', simulationResult.value.unitsConsumed);

            if (simulationResult.value.err) {
                console.error('❌ Simulation failed:', simulationResult.value.err);
                throw new Error(`Transaction simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
            }

            console.log('✅ Simulation passed - transaction is valid');

            // Sign and send
            console.log('✍️  Sending transaction to wallet for signing...');
            const signature = await walletProvider.signAndSendTransaction(tx);
            console.log('✅ Transaction sent, signature:', signature);

            // Wait for confirmation
            console.log('⏳ Waiting for confirmation...');
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight,
            });
            console.log('✅ Transaction confirmed!');

            return signature;
        } catch (err: any) {
            console.error('❌ Repay loan error:', err);
            setError(err.message || 'Failed to repay loan');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const stake = async (params: {
        stakeAmount: number; // aUSD in smallest unit (1e18)
    }) => {
        if (!isConnected || !walletProvider || !address) {
            throw new Error('Wallet not connected');
        }

        if (!connection) {
            throw new Error('Connection not available');
        }

        if (!protocolState) {
            throw new Error('Protocol state not loaded');
        }

        try {
            setLoading(true);
            setError(null);

            const userPublicKey = new PublicKey(address);
            const { stablecoinMint } = protocolState;

            console.log('🚀 Starting stake transaction...');
            console.log('📊 Stake amount:', params.stakeAmount);

            // Check if user has sufficient stablecoins
            console.log('🔍 Validating user stablecoin balance...');
            const { getAccount, getAssociatedTokenAddress } = await import('@solana/spl-token');
            const userStablecoinATA = await getAssociatedTokenAddress(stablecoinMint, userPublicKey);

            try {
                const userStablecoinAccount = await getAccount(connection, userStablecoinATA);
                console.log('✅ User stablecoin account exists');
                console.log('💰 Balance:', userStablecoinAccount.amount.toString());

                if (userStablecoinAccount.amount < BigInt(params.stakeAmount)) {
                    throw new Error(`Insufficient stablecoins. Required: ${params.stakeAmount}, Available: ${userStablecoinAccount.amount.toString()}`);
                }
            } catch (error: any) {
                if (error.code === 2002) { // TokenAccountNotFoundError
                    throw new Error('Stablecoin token account does not exist. Please receive some aUSD tokens first.');
                }
                throw error;
            }

            // Build instruction
            console.log('🔨 Building stake instruction...');
            const { buildStakeInstruction } = await import('@/lib/solana/buildInstructions');
            const { instruction } = await buildStakeInstruction(
                userPublicKey,
                stablecoinMint,
                params.stakeAmount
            );

            console.log('✅ Instruction built, creating transaction...');

            // Create transaction
            const tx = new Transaction();
            tx.add(instruction);

            // Set fee payer
            console.log('💳 Setting fee payer...');
            tx.feePayer = walletProvider.publicKey;

            // Get recent blockhash
            console.log('📡 Getting recent blockhash...');
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            tx.recentBlockhash = blockhash;

            console.log('🔍 Simulating stake transaction...');
            const simulation = await connection.simulateTransaction(tx);
            console.log('📊 Simulation result:');
            console.log('  - Error:', simulation.value.err);
            console.log('  - Logs:', simulation.value.logs);
            console.log('  - Units consumed:', simulation.value.unitsConsumed);

            if (simulation.value.err) {
                console.error('❌ Simulation failed:', simulation.value.err);
                throw new Error('Transaction simulation failed');
            }

            console.log('✅ Simulation passed - transaction is valid');

            // Sign and send transaction
            console.log('✍️ Sending transaction to wallet for signing...');
            const signature = await walletProvider.signAndSendTransaction(tx);
            console.log('✅ Transaction sent, signature:', signature);

            // Wait for confirmation
            console.log('⏳ Waiting for confirmation...');
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight,
            });
            console.log('✅ Transaction confirmed!');

            return signature;
        } catch (err: any) {
            console.error('❌ Stake error:', err);
            setError(err.message || 'Failed to stake');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const unstake = async (params: {
        unstakeAmount: number; // aUSD in smallest unit
    }) => {
        if (!isConnected || !walletProvider || !address) {
            throw new Error('Wallet not connected');
        }

        if (!connection) {
            throw new Error('Connection not available');
        }

        if (!protocolState) {
            throw new Error('Protocol state not loaded');
        }

        try {
            setLoading(true);
            setError(null);

            const userPublicKey = new PublicKey(address);
            const { stablecoinMint } = protocolState;

            console.log('🔓 Starting unstake...');
            console.log('📊 Unstake amount:', params.unstakeAmount, 'aUSD (smallest unit)');

            // Fetch current compounded stake to validate
            const { fetchUserStakeState } = await import('@/lib/solana/fetchStakeState');
            const stakeState = await fetchUserStakeState(connection, userPublicKey);

            if (!stakeState) {
                throw new Error('No stake found');
            }

            console.log('📊 Current compounded stake:', stakeState.compounded_stake.toString());

            // Validate unstake amount
            if (params.unstakeAmount <= 0) {
                throw new Error('Unstake amount must be greater than 0');
            }

            const MINIMUM_LOAN_AMOUNT = 10_000_000_000_000_000; // 0.01 aUSD (from contract)
            if (params.unstakeAmount < MINIMUM_LOAN_AMOUNT) {
                throw new Error('Unstake amount below minimum (0.01 aUSD)');
            }

            // Check sufficient compounded stake
            if (BigInt(params.unstakeAmount) > stakeState.compounded_stake) {
                throw new Error(`Insufficient compounded stake. Available: ${stakeState.compounded_stake}, Requested: ${params.unstakeAmount}`);
            }

            console.log('✅ Validation passed');

            // Build unstake instruction
            const { buildUnstakeInstruction } = await import('@/lib/solana/buildInstructions');
            const { instruction } = await buildUnstakeInstruction(
                userPublicKey,
                stablecoinMint,
                params.unstakeAmount
            );

            console.log('✅ Instruction built, creating transaction...');

            // Create and send transaction
            const tx = new Transaction().add(instruction);
            tx.feePayer = walletProvider.publicKey;
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            console.log('🔍 Simulating unstake transaction...');
            const simulation = await connection.simulateTransaction(tx);
            console.log('📊 Simulation result:');
            console.log('- Error:', simulation.value.err);
            console.log('- Logs:', simulation.value.logs);
            console.log('- Units consumed:', simulation.value.unitsConsumed);

            if (simulation.value.err) {
                throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
            }

            console.log('✅ Simulation passed - transaction is valid');
            console.log('✍️ Sending transaction to wallet for signing...');

            const signature = await walletProvider.signAndSendTransaction(tx);

            console.log('✅ Unstake transaction sent!');
            console.log('📝 Signature:', signature);

            setLoading(false);
            return signature;
        } catch (err: any) {
            console.error('❌ Unstake error:', err);
            setLoading(false);
            setError(err.message || 'Failed to unstake');
            throw err;
        }
    };

    const liquidateTroves = async (params: {
        troveOwners: PublicKey[];
    }) => {
        if (!isConnected || !walletProvider || !address) {
            throw new Error('Wallet not connected');
        }

        if (!connection) {
            throw new Error('Connection not available');
        }

        if (!protocolState) {
            throw new Error('Protocol state not loaded');
        }

        try {
            setLoading(true);
            setError(null);

            // Validate input
            if (!params.troveOwners || params.troveOwners.length === 0) {
                throw new Error('At least one trove must be specified for liquidation');
            }

            const MAX_LIQUIDATION_BATCH_SIZE = 50;
            if (params.troveOwners.length > MAX_LIQUIDATION_BATCH_SIZE) {
                throw new Error(`Maximum ${MAX_LIQUIDATION_BATCH_SIZE} troves can be liquidated in a single transaction`);
            }

            const userPublicKey = new PublicKey(address);
            const { collateralMint, stablecoinMint, oracleProgramId, oracleState } = protocolState;

            console.log('🔨 Starting liquidation transaction...');
            console.log('Trove owners to liquidate:', params.troveOwners.map(p => p.toBase58()));

            // Build instruction
            const { buildLiquidateTrovesInstruction } = await import('@/lib/solana/buildInstructions');
            const { instruction } = await buildLiquidateTrovesInstruction(
                userPublicKey,
                params.troveOwners,
                'SOL', // collateral denom
                collateralMint,
                stablecoinMint,
                oracleProgramId,
                oracleState
            );

            console.log('✅ Instruction built, creating transaction...');

            // Create and send transaction
            const tx = new Transaction().add(instruction);
            tx.feePayer = walletProvider.publicKey;
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            console.log('🔍 Simulating liquidation transaction...');
            const simulation = await connection.simulateTransaction(tx);
            console.log('📊 Simulation result:');
            console.log('- Error:', simulation.value.err);
            console.log('- Logs:', simulation.value.logs);
            console.log('- Units consumed:', simulation.value.unitsConsumed);

            if (simulation.value.err) {
                throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
            }

            console.log('✅ Simulation passed - transaction is valid');
            console.log('✍️ Sending transaction to wallet for signing...');

            const signature = await walletProvider.signAndSendTransaction(tx);

            console.log('✅ Liquidation transaction sent!');
            console.log('📝 Signature:', signature);

            return signature;
        } catch (err: any) {
            console.error('❌ Liquidate troves error:', err);
            setLoading(false);
            setError(err.message || 'Failed to liquidate troves');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const liquidateTrove = async (targetUser: PublicKey) => {
        if (!isConnected || !walletProvider || !address) {
            throw new Error('Wallet not connected');
        }
        if (!connection) {
            throw new Error('Connection not available');
        }
        if (!protocolState) {
            throw new Error('Protocol state not loaded');
        }

        try {
            setLoading(true);
            setError(null);

            const userPublicKey = new PublicKey(address);
            const { collateralMint, stablecoinMint, oracleProgramId, oracleState } = protocolState;

            console.log('🔨 Building single liquidate_trove for', targetUser.toBase58());

            const { buildLiquidateTroveInstruction } = await import('@/lib/solana/buildInstructions');
            const { instruction } = await buildLiquidateTroveInstruction(
                userPublicKey,
                targetUser,
                'SOL',
                collateralMint,
                stablecoinMint,
                oracleProgramId,
                oracleState,
            );

            const tx = new Transaction().add(instruction);
            tx.feePayer = walletProvider.publicKey;
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            console.log('🔍 Simulating liquidate_trove transaction...');
            const simulation = await connection.simulateTransaction(tx);
            console.log('📊 Simulation result:');
            console.log('- Error:', simulation.value.err);
            console.log('- Logs:', simulation.value.logs);
            console.log('- Units consumed:', simulation.value.unitsConsumed);
            if (simulation.value.err) {
                throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
            }

            const signature = await walletProvider.signAndSendTransaction(tx);
            console.log('✅ Single liquidate transaction sent:', signature);
            return signature;
        } catch (err: any) {
            console.error('❌ Liquidate trove error:', err);
            setError(err.message || 'Failed to liquidate trove');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const redeem = async (params: {
        redeemAmount: number;
    }) => {
        if (!isConnected || !walletProvider || !address) {
            throw new Error('Wallet not connected');
        }

        if (!connection) {
            throw new Error('Connection not available');
        }

        if (!protocolState) {
            throw new Error('Protocol state not loaded');
        }

        try {
            setLoading(true);
            setError(null);

            // Validate input
            if (!params.redeemAmount || params.redeemAmount <= 0) {
                throw new Error('Redemption amount must be greater than 0');
            }

            if (params.redeemAmount > 999) {
                throw new Error('Redemption amount cannot exceed 999 aUSD');
            }

            const userPublicKey = new PublicKey(address);
            const { collateralMint, stablecoinMint, oracleProgramId, oracleState, feesProgramId, feesState } = protocolState;

            console.log('🔨 Starting redemption transaction...');
            console.log('Redeem amount:', params.redeemAmount, 'aUSD');

            // Convert aUSD to smallest unit (18 decimals)
            const redeemAmountInSmallestUnit = BigInt(Math.floor(params.redeemAmount * 1e18));

            // 1. Fetch all troves from devnet
            console.log('📋 Fetching all troves from devnet...');
            const { fetchAllTroves } = await import('@/lib/solana/fetchTroves');
            const allTroves = await fetchAllTroves(connection, 'SOL');
            console.log(`Found ${allTroves.length} total troves`);

            // 2. Sort troves by ICR (ascending - lowest first)
            const sortedTroves = allTroves.sort((a, b) => {
                if (a.icr < b.icr) return -1;
                if (a.icr > b.icr) return 1;
                return 0;
            });

            console.log('📊 Sorted troves by ICR (ascending):');
            sortedTroves.slice(0, 5).forEach((trove, idx) => {
                const icrDisplay = Number(trove.icr) / 1_000_000;
                console.log(`  ${idx + 1}. ${trove.owner.toBase58()} - ICR: ${icrDisplay.toFixed(2)}%, Debt: ${Number(trove.debt) / 1e18} aUSD`);
            });

            // 3. Select troves to redeem from (maximum 3 troves) and validate against NET amount after protocol fee
            const MAX_TROVES_PER_REDEMPTION = 3;
            const selectedTroves: PublicKey[] = [];

            // Determine fee percent (fallback to 5%)
            const feePercent = 0.05;
            const netRequested = redeemAmountInSmallestUnit - BigInt(
                Math.floor(Number(redeemAmountInSmallestUnit) * feePercent)
            );

            let coveredNet = BigInt(0);
            let remainingNet = netRequested;

            for (const trove of sortedTroves) {
                if (selectedTroves.length >= MAX_TROVES_PER_REDEMPTION) break;
                if (trove.debt > BigInt(0)) {
                    selectedTroves.push(trove.owner);
                    const take = remainingNet < trove.debt ? remainingNet : trove.debt;
                    coveredNet += take;
                    remainingNet -= take;
                    console.log(`Selected trove: ${trove.owner.toBase58()}, Debt: ${Number(trove.debt) / 1e18} aUSD`);
                    if (remainingNet <= BigInt(0)) break;
                }
            }

            // 4. Validate we have enough liquidity (compare NET)
            if (coveredNet < netRequested) {
                throw new Error(
                    `Insufficient liquidity (3 lowest-ICR troves). Available net: ${Number(coveredNet) / 1e18} aUSD, Required net: ${Number(netRequested) / 1e18} aUSD`
                );
            }

            console.log(`Selected ${selectedTroves.length} troves for redemption`);

            // 5. Validate user has enough aUSD balance
            const { getAccount, getAssociatedTokenAddress: getATA } = await import('@solana/spl-token');
            const userStablecoinATA = await getATA(stablecoinMint, userPublicKey);

            try {
                const userStablecoinAccount = await getAccount(connection, userStablecoinATA);
                const userBalance = userStablecoinAccount.amount;

                if (userBalance < redeemAmountInSmallestUnit) {
                    throw new Error(`Insufficient aUSD balance. Available: ${Number(userBalance) / 1e18} aUSD, Required: ${params.redeemAmount} aUSD`);
                }

                console.log(`User aUSD balance: ${Number(userBalance) / 1e18} aUSD`);
            } catch (err) {
                throw new Error('User aUSD account not found or has insufficient balance');
            }

            // 6. Derive required token accounts
            const { getAssociatedTokenAddress: getATA2 } = await import('@solana/spl-token');
            const { STABILITY_POOL_OWNER, FEE_ADDRESS_1, FEE_ADDRESS_2 } = await import('@/lib/constants/solana');

            const stabilityPoolTokenAccount = await getATA2(stablecoinMint, STABILITY_POOL_OWNER);
            const feeAddress1TokenAccount = await getATA2(stablecoinMint, FEE_ADDRESS_1);
            const feeAddress2TokenAccount = await getATA2(stablecoinMint, FEE_ADDRESS_2);

            // 7. Build instruction
            const { buildRedeemInstruction } = await import('@/lib/solana/buildInstructions');
            const { instruction } = await buildRedeemInstruction(
                userPublicKey,
                redeemAmountInSmallestUnit,
                'SOL',
                collateralMint,
                stablecoinMint,
                oracleProgramId,
                oracleState,
                feesProgramId,
                feesState,
                stabilityPoolTokenAccount,
                feeAddress1TokenAccount,
                feeAddress2TokenAccount,
                selectedTroves
            );

            console.log('✅ Instruction built, creating transaction...');

            // 7. Create and send transaction
            const tx = new Transaction().add(instruction);
            tx.feePayer = walletProvider.publicKey;
            tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

            console.log('🔍 Simulating redemption transaction...');
            const simulation = await connection.simulateTransaction(tx);
            console.log('📊 Simulation result:');
            console.log('- Error:', simulation.value.err);
            console.log('- Logs:', simulation.value.logs);
            console.log('- Units consumed:', simulation.value.unitsConsumed);

            if (simulation.value.err) {
                throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
            }

            console.log('✅ Simulation passed - transaction is valid');
            console.log('✍️ Sending transaction to wallet for signing...');

            const signature = await walletProvider.signAndSendTransaction(tx);

            console.log('✅ Redemption transaction sent!');
            console.log('📝 Signature:', signature);

            return signature;
        } catch (err: any) {
            console.error('❌ Redeem error:', err);
            setLoading(false);
            setError(err.message || 'Failed to redeem aUSD');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const withdrawLiquidationGains = async (params: {
        collateralDenom?: string; // Default: "SOL"
    }) => {
        if (!isConnected || !walletProvider || !address) {
            throw new Error('Wallet not connected');
        }

        if (!connection) {
            throw new Error('Connection not available');
        }

        if (!protocolState) {
            throw new Error('Protocol state not loaded');
        }

        try {
            setLoading(true);
            setError(null);

            const userPublicKey = new PublicKey(address);
            const { collateralMint, stablecoinMint } = protocolState;
            const collateralDenom = params.collateralDenom || 'SOL';

            console.log('💰 Starting withdraw_liquidation_gains...');
            console.log('📊 Collateral denom:', collateralDenom);

            // Check user has stake (required for withdrawal)
            const { fetchUserStakeState } = await import('@/lib/solana/fetchStakeState');
            const stakeState = await fetchUserStakeState(connection, userPublicKey);

            if (!stakeState || stakeState.amount === BigInt(0)) {
                throw new Error('No stake found. You must have staked aUSD in the stability pool to claim liquidation gains.');
            }

            console.log('✅ User has stake:', stakeState.amount.toString());

            // Build instruction
            const { buildWithdrawLiquidationGainsInstruction } = await import('@/lib/solana/buildInstructions');
            const { instruction } = await buildWithdrawLiquidationGainsInstruction(
                userPublicKey,
                collateralDenom,
                collateralMint,
                stablecoinMint
            );

            console.log('✅ Instruction built, creating transaction...');

            // Create and send transaction
            const tx = new Transaction().add(instruction);
            tx.feePayer = walletProvider.publicKey;

            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
            tx.recentBlockhash = blockhash;

            console.log('🔍 Simulating withdraw_liquidation_gains transaction...');
            const simulation = await connection.simulateTransaction(tx);
            console.log('📊 Simulation result:');
            console.log('- Error:', simulation.value.err);
            console.log('- Logs:', simulation.value.logs);
            console.log('- Units consumed:', simulation.value.unitsConsumed);

            if (simulation.value.err) {
                throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
            }

            console.log('✅ Simulation passed - transaction is valid');
            console.log('✍️ Sending transaction to wallet for signing...');

            const signature = await walletProvider.signAndSendTransaction(tx);

            console.log('✅ Withdraw liquidation gains transaction sent!');
            console.log('📝 Signature:', signature);

            // Wait for confirmation
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight,
            });
            console.log('✅ Transaction confirmed!');

            return signature;
        } catch (err: any) {
            console.error('❌ Withdraw liquidation gains error:', err);
            setError(err.message || 'Failed to withdraw liquidation gains');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        openTrove,
        addCollateral,
        removeCollateral,
        borrowLoan,
        repayLoan,
        stake,
        unstake,
        liquidateTroves,
        liquidateTrove,
        redeem,
        withdrawLiquidationGains,
        loading,
        error,
    };
}

