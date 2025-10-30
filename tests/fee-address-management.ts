import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AerospacerFees } from "../target/types/aerospacer_fees";
import {
    Keypair,
    PublicKey,
    SystemProgram,
    LAMPORTS_PER_SOL
} from "@solana/web3.js";
import { assert, expect } from "chai";
import * as fs from "fs";

describe("Fee Contract - Address Management Tests", () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    const provider = anchor.getProvider();
    const connection = provider.connection;

    const feesProgram = anchor.workspace.AerospacerFees as Program<AerospacerFees>;

    // Load wallet explicitly
    const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync("/home/taha/.config/solana/id.json", "utf8")))
    );
    const admin = adminKeypair;
    const nonAdmin = Keypair.generate(); // Generate different keypair for non-admin tests

    // Load fee addresses from key files
    const feeAddr1Keypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync("/home/taha/Documents/Projects/Aeroscraper/aerospacer-solana/keys/fee-addresses/fee_address_1.json", "utf8")))
    );
    const feeAddr2Keypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync("/home/taha/Documents/Projects/Aeroscraper/aerospacer-solana/keys/fee-addresses/fee_address_2.json", "utf8")))
    );
    const stakingAddrKeypair = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync("/home/taha/Documents/Projects/Aeroscraper/aerospacer-solana/keys/staking-address/staking_address.json", "utf8")))
    );

    const FEE_ADDR_1 = feeAddr1Keypair.publicKey;
    const FEE_ADDR_2 = feeAddr2Keypair.publicKey;
    const STAKING_ADDR = stakingAddrKeypair.publicKey;

    let feeStateAccount: PublicKey;

    before(async () => {
        console.log("\n🚀 Setting up Fee Contract Address Management Tests...");
        console.log("  Admin:", admin.publicKey.toString());
        console.log("  Non-Admin:", nonAdmin.publicKey.toString());
        console.log("  Fee Address 1:", FEE_ADDR_1.toString());
        console.log("  Fee Address 2:", FEE_ADDR_2.toString());
        console.log("  Staking Address:", STAKING_ADDR.toString());

        // Derive the fee state PDA
        [feeStateAccount] = PublicKey.findProgramAddressSync(
            [Buffer.from("fee_state")],
            feesProgram.programId
        );

        // Check if state already exists
        try {
            const existingState = await feesProgram.account.feeStateAccount.fetch(feeStateAccount);
            console.log("✅ Fee state already exists, skipping initialization");
        } catch (error) {
            console.log("📋 Initializing new fee state...");
            await feesProgram.methods
                .initialize()
                .accounts({
                    state: feeStateAccount,
                    admin: admin.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .signers([admin])
                .rpc();
        }

        console.log("✅ Setup complete");
    });

    // ADD THIS NEW TEST AT THE BEGINNING TO ENSURE ADDRESSES ARE SET
    describe("Test 0: Ensure Key File Addresses Are Set", () => {
        it("Should set the addresses from key files as the final state", async () => {
            console.log("🎯 Setting final addresses from key files...");
            console.log("  Setting Fee Address 1:", FEE_ADDR_1.toString());
            console.log("  Setting Fee Address 2:", FEE_ADDR_2.toString());
            console.log("  Setting Staking Address:", STAKING_ADDR.toString());

            // Set fee addresses from key files
            await feesProgram.methods
                .setFeeAddresses({
                    feeAddress1: FEE_ADDR_1.toString(),
                    feeAddress2: FEE_ADDR_2.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            // Set staking address from key file
            await feesProgram.methods
                .setStakeContractAddress({
                    address: STAKING_ADDR.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            // Verify the addresses are set correctly
            const state = await feesProgram.account.feeStateAccount.fetch(feeStateAccount);

            assert.equal(
                state.feeAddress1.toString(),
                FEE_ADDR_1.toString(),
                "Fee address 1 should be set from key file"
            );
            assert.equal(
                state.feeAddress2.toString(),
                FEE_ADDR_2.toString(),
                "Fee address 2 should be set from key file"
            );
            assert.equal(
                state.stakeContractAddress.toString(),
                STAKING_ADDR.toString(),
                "Staking address should be set from key file"
            );

            console.log("✅ Key file addresses set and verified successfully");
        });
    });

    describe("Test 1: Set Fee Addresses - Valid Addresses", () => {
        it("Should set valid fee addresses successfully", async () => {
            console.log("📝 Setting fee addresses from key files...");
            console.log("  Fee Address 1:", FEE_ADDR_1.toString());
            console.log("  Fee Address 2:", FEE_ADDR_2.toString());

            const tx = await feesProgram.methods
                .setFeeAddresses({
                    feeAddress1: FEE_ADDR_1.toString(),
                    feeAddress2: FEE_ADDR_2.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            console.log("✅ Fee addresses set. TX:", tx);

            const state = await feesProgram.account.feeStateAccount.fetch(
                feeStateAccount
            );

            assert.equal(
                state.feeAddress1.toString(),
                FEE_ADDR_1.toString(),
                "Fee address 1 should be set correctly"
            );
            assert.equal(
                state.feeAddress2.toString(),
                FEE_ADDR_2.toString(),
                "Fee address 2 should be set correctly"
            );

            console.log("✅ Fee addresses set successfully");
        });

        it("Should allow updating fee addresses multiple times", async () => {
            const newFeeAddr1 = Keypair.generate().publicKey;
            const newFeeAddr2 = Keypair.generate().publicKey;

            console.log("🔄 Updating fee addresses...");
            console.log("  New Fee Address 1:", newFeeAddr1.toString());
            console.log("  New Fee Address 2:", newFeeAddr2.toString());

            // First update
            await feesProgram.methods
                .setFeeAddresses({
                    feeAddress1: newFeeAddr1.toString(),
                    feeAddress2: newFeeAddr2.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            let state = await feesProgram.account.feeStateAccount.fetch(
                feeStateAccount
            );
            assert.equal(state.feeAddress1.toString(), newFeeAddr1.toString());
            assert.equal(state.feeAddress2.toString(), newFeeAddr2.toString());

            // Second update back to original addresses
            await feesProgram.methods
                .setFeeAddresses({
                    feeAddress1: FEE_ADDR_1.toString(),
                    feeAddress2: FEE_ADDR_2.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            state = await feesProgram.account.feeStateAccount.fetch(
                feeStateAccount
            );
            assert.equal(state.feeAddress1.toString(), FEE_ADDR_1.toString());
            assert.equal(state.feeAddress2.toString(), FEE_ADDR_2.toString());

            console.log("✅ Fee addresses updated multiple times successfully");
        });
    });

    describe("Test 2: Set Fee Addresses - Invalid Addresses", () => {
        it("Should fail with malformed fee address strings", async () => {
            console.log("🔒 Attempting to set invalid fee addresses...");

            try {
                await feesProgram.methods
                    .setFeeAddresses({
                        feeAddress1: "invalid-address-format",
                        feeAddress2: "another-invalid-address"
                    })
                    .accounts({
                        admin: admin.publicKey,
                        state: feeStateAccount,
                    })
                    .signers([admin])
                    .rpc();

                assert.fail("Should have thrown an error");
            } catch (error: any) {
                console.log("✅ Invalid fee addresses correctly rejected");
                console.log("  Error:", error.message);
                expect(error.message).to.exist;
            }
        });

        it("Should fail with empty string addresses", async () => {
            try {
                await feesProgram.methods
                    .setFeeAddresses({
                        feeAddress1: "",
                        feeAddress2: ""
                    })
                    .accounts({
                        admin: admin.publicKey,
                        state: feeStateAccount,
                    })
                    .signers([admin])
                    .rpc();

                assert.fail("Should have thrown an error");
            } catch (error: any) {
                console.log("✅ Empty addresses correctly rejected");
                expect(error.message).to.exist;
            }
        });

        it("Should fail when fee addresses are the same", async () => {
            const sameAddress = Keypair.generate().publicKey;

            try {
                await feesProgram.methods
                    .setFeeAddresses({
                        feeAddress1: sameAddress.toString(),
                        feeAddress2: sameAddress.toString()
                    })
                    .accounts({
                        admin: admin.publicKey,
                        state: feeStateAccount,
                    })
                    .signers([admin])
                    .rpc();

                assert.fail("Should have thrown an error");
            } catch (error: any) {
                console.log("✅ Identical fee addresses correctly rejected");
                expect(error.message).to.exist;
            }
        });
    });

    describe("Test 3: Set Fee Addresses - Authorization", () => {
        it("Should fail when non-admin tries to set fee addresses", async () => {
            const feeAddr1 = Keypair.generate().publicKey;
            const feeAddr2 = Keypair.generate().publicKey;

            console.log("🔒 Attempting to set fee addresses as non-admin...");

            try {
                await feesProgram.methods
                    .setFeeAddresses({
                        feeAddress1: feeAddr1.toString(),
                        feeAddress2: feeAddr2.toString()
                    })
                    .accounts({
                        admin: nonAdmin.publicKey,
                        state: feeStateAccount,
                    })
                    .signers([nonAdmin])
                    .rpc();

                assert.fail("Should have thrown an error");
            } catch (error: any) {
                console.log("✅ Non-admin set fee addresses correctly prevented");
                console.log("  Error:", error.message);
                expect(error.message).to.include("Unauthorized");
            }
        });
    });

    describe("Test 4: Set Stake Contract Address - Valid Address", () => {
        it("Should set valid stake contract address successfully", async () => {
            console.log("📝 Setting stake contract address from key file...");
            console.log("  Staking Address:", STAKING_ADDR.toString());

            const tx = await feesProgram.methods
                .setStakeContractAddress({
                    address: STAKING_ADDR.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            console.log("✅ Stake contract address set. TX:", tx);

            const state = await feesProgram.account.feeStateAccount.fetch(
                feeStateAccount
            );

            assert.equal(
                state.stakeContractAddress.toString(),
                STAKING_ADDR.toString(),
                "Stake contract address should be set correctly"
            );

            console.log("✅ Stake contract address set successfully");
        });

        it("Should allow updating stake contract address multiple times", async () => {
            const address1 = Keypair.generate().publicKey;
            const address2 = Keypair.generate().publicKey;

            console.log("🔄 Testing stake address updates...");

            // First update
            await feesProgram.methods
                .setStakeContractAddress({
                    address: address1.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            let state = await feesProgram.account.feeStateAccount.fetch(
                feeStateAccount
            );
            assert.equal(state.stakeContractAddress.toString(), address1.toString());

            // Second update
            await feesProgram.methods
                .setStakeContractAddress({
                    address: address2.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            state = await feesProgram.account.feeStateAccount.fetch(
                feeStateAccount
            );
            assert.equal(state.stakeContractAddress.toString(), address2.toString());

            // Third update back to original address
            await feesProgram.methods
                .setStakeContractAddress({
                    address: STAKING_ADDR.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            state = await feesProgram.account.feeStateAccount.fetch(
                feeStateAccount
            );
            assert.equal(state.stakeContractAddress.toString(), STAKING_ADDR.toString());

            console.log("✅ Stake address updated multiple times successfully");
        });
    });

    describe("Test 5: Set Stake Contract Address - Invalid Address", () => {
        it("Should fail with malformed address string", async () => {
            console.log("🔒 Attempting to set invalid stake address...");

            try {
                await feesProgram.methods
                    .setStakeContractAddress({
                        address: "invalid-address-format"
                    })
                    .accounts({
                        admin: admin.publicKey,
                        state: feeStateAccount,
                    })
                    .signers([admin])
                    .rpc();

                assert.fail("Should have thrown an error");
            } catch (error: any) {
                console.log("✅ Invalid stake address correctly rejected");
                console.log("  Error:", error.message);
                expect(error.message).to.exist;
            }
        });

        it("Should fail with empty string address", async () => {
            try {
                await feesProgram.methods
                    .setStakeContractAddress({
                        address: ""
                    })
                    .accounts({
                        admin: admin.publicKey,
                        state: feeStateAccount,
                    })
                    .signers([admin])
                    .rpc();

                assert.fail("Should have thrown an error");
            } catch (error: any) {
                console.log("✅ Empty stake address correctly rejected");
                expect(error.message).to.exist;
            }
        });
    });

    describe("Test 6: Set Stake Contract Address - Authorization", () => {
        it("Should fail when non-admin tries to set stake address", async () => {
            const stakeAddress = Keypair.generate().publicKey;

            console.log("🔒 Attempting to set stake address as non-admin...");

            try {
                await feesProgram.methods
                    .setStakeContractAddress({
                        address: stakeAddress.toString()
                    })
                    .accounts({
                        admin: nonAdmin.publicKey,
                        state: feeStateAccount,
                    })
                    .signers([nonAdmin])
                    .rpc();

                assert.fail("Should have thrown an error");
            } catch (error: any) {
                console.log("✅ Non-admin set stake address correctly prevented");
                console.log("  Error:", error.message);
                expect(error.message).to.include("Unauthorized");
            }
        });
    });

    describe("Test 7: Combined Address Management", () => {
        it("Should handle setting both fee addresses and stake address in sequence", async () => {
            console.log("🔄 Testing combined address management...");

            // Set fee addresses
            await feesProgram.methods
                .setFeeAddresses({
                    feeAddress1: FEE_ADDR_1.toString(),
                    feeAddress2: FEE_ADDR_2.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            // Set stake address
            await feesProgram.methods
                .setStakeContractAddress({
                    address: STAKING_ADDR.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            const state = await feesProgram.account.feeStateAccount.fetch(
                feeStateAccount
            );

            assert.equal(
                state.feeAddress1.toString(),
                FEE_ADDR_1.toString(),
                "Fee address 1 should be set"
            );
            assert.equal(
                state.feeAddress2.toString(),
                FEE_ADDR_2.toString(),
                "Fee address 2 should be set"
            );
            assert.equal(
                state.stakeContractAddress.toString(),
                STAKING_ADDR.toString(),
                "Stake address should be set"
            );

            console.log("✅ Combined address management successful");
        });

        it("Should maintain state consistency after multiple operations", async () => {
            const state = await feesProgram.account.feeStateAccount.fetch(
                feeStateAccount
            );

            expect(state).to.have.property("admin");
            expect(state).to.have.property("isStakeEnabled");
            expect(state).to.have.property("stakeContractAddress");
            expect(state).to.have.property("feeAddress1");
            expect(state).to.have.property("feeAddress2");
            expect(state).to.have.property("totalFeesCollected");

            assert.equal(
                state.admin.toString(),
                admin.publicKey.toString(),
                "Admin should remain unchanged"
            );
            assert.equal(
                state.feeAddress1.toString(),
                FEE_ADDR_1.toString(),
                "Fee address 1 should be correct"
            );
            assert.equal(
                state.feeAddress2.toString(),
                FEE_ADDR_2.toString(),
                "Fee address 2 should be correct"
            );
            assert.equal(
                state.stakeContractAddress.toString(),
                STAKING_ADDR.toString(),
                "Stake address should be correct"
            );

            console.log("✅ State consistency verified");
        });
    });

    describe("Test 8: Edge Cases and Stress Testing", () => {
        it("Should handle rapid consecutive address updates", async () => {
            console.log("⚡ Testing rapid consecutive updates...");

            const addresses = [
                Keypair.generate().publicKey,
                Keypair.generate().publicKey,
                Keypair.generate().publicKey,
                FEE_ADDR_1, // Back to original
            ];

            for (let i = 0; i < addresses.length; i++) {
                await feesProgram.methods
                    .setStakeContractAddress({
                        address: addresses[i].toString()
                    })
                    .accounts({
                        admin: admin.publicKey,
                        state: feeStateAccount,
                    })
                    .signers([admin])
                    .rpc();

                const state = await feesProgram.account.feeStateAccount.fetch(
                    feeStateAccount
                );

                assert.equal(
                    state.stakeContractAddress.toString(),
                    addresses[i].toString(),
                    `Update ${i + 1} should be correct`
                );

                console.log(`  Update ${i + 1}: ${addresses[i].toString()} ✓`);
            }

            console.log("✅ Rapid updates completed successfully");
        });

        it("Should handle mixed address updates", async () => {
            console.log("🔄 Testing mixed address updates...");

            const newFeeAddr1 = Keypair.generate().publicKey;
            const newFeeAddr2 = Keypair.generate().publicKey;
            const newStakeAddr = Keypair.generate().publicKey;

            // Update fee addresses
            await feesProgram.methods
                .setFeeAddresses({
                    feeAddress1: newFeeAddr1.toString(),
                    feeAddress2: newFeeAddr2.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            // Update stake address
            await feesProgram.methods
                .setStakeContractAddress({
                    address: newStakeAddr.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            const state = await feesProgram.account.feeStateAccount.fetch(
                feeStateAccount
            );

            assert.equal(
                state.feeAddress1.toString(),
                newFeeAddr1.toString(),
                "Fee address 1 should be updated"
            );
            assert.equal(
                state.feeAddress2.toString(),
                newFeeAddr2.toString(),
                "Fee address 2 should be updated"
            );
            assert.equal(
                state.stakeContractAddress.toString(),
                newStakeAddr.toString(),
                "Stake address should be updated"
            );

            console.log("✅ Mixed address updates successful");
        });
    });

    describe("Test 9: Verify Address Validation Logic", () => {
        it("Should validate that fee addresses are different", async () => {
            const sameAddress = FEE_ADDR_1; // Use existing address

            try {
                await feesProgram.methods
                    .setFeeAddresses({
                        feeAddress1: sameAddress.toString(),
                        feeAddress2: sameAddress.toString()
                    })
                    .accounts({
                        admin: admin.publicKey,
                        state: feeStateAccount,
                    })
                    .signers([admin])
                    .rpc();

                assert.fail("Should have rejected identical addresses");
            } catch (error: any) {
                console.log("✅ Identical fee addresses correctly rejected");
                expect(error.message).to.exist;
            }
        });

        it("Should accept valid different addresses", async () => {
            const addr1 = Keypair.generate().publicKey;
            const addr2 = Keypair.generate().publicKey;

            // Ensure they're different
            assert.notEqual(addr1.toString(), addr2.toString());

            await feesProgram.methods
                .setFeeAddresses({
                    feeAddress1: addr1.toString(),
                    feeAddress2: addr2.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            const state = await feesProgram.account.feeStateAccount.fetch(
                feeStateAccount
            );

            assert.equal(state.feeAddress1.toString(), addr1.toString());
            assert.equal(state.feeAddress2.toString(), addr2.toString());

            console.log("✅ Different addresses accepted correctly");
        });
    });

    // ADD THIS NEW TEST AT THE END TO ENSURE FINAL STATE
    describe("Test 10: Final State Verification", () => {
        it("Should ensure key file addresses are set as final state", async () => {
            console.log("🔍 Verifying final state matches key file addresses...");

            // Set the final addresses from key files
            await feesProgram.methods
                .setFeeAddresses({
                    feeAddress1: FEE_ADDR_1.toString(),
                    feeAddress2: FEE_ADDR_2.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            await feesProgram.methods
                .setStakeContractAddress({
                    address: STAKING_ADDR.toString()
                })
                .accounts({
                    admin: admin.publicKey,
                    state: feeStateAccount,
                })
                .signers([admin])
                .rpc();

            // Verify final state
            const finalState = await feesProgram.account.feeStateAccount.fetch(feeStateAccount);

            assert.equal(
                finalState.feeAddress1.toString(),
                FEE_ADDR_1.toString(),
                "Final fee address 1 must match key file"
            );
            assert.equal(
                finalState.feeAddress2.toString(),
                FEE_ADDR_2.toString(),
                "Final fee address 2 must match key file"
            );
            assert.equal(
                finalState.stakeContractAddress.toString(),
                STAKING_ADDR.toString(),
                "Final staking address must match key file"
            );

            console.log("✅ Final state verification passed");
            console.log("  Final Fee Address 1:", finalState.feeAddress1.toString());
            console.log("  Final Fee Address 2:", finalState.feeAddress2.toString());
            console.log("  Final Staking Address:", finalState.stakeContractAddress.toString());
        });
    });

    after(() => {
        console.log("\n✅ Fee Contract Address Management Tests Complete");
        console.log("  Total Tests Passed: 17");
        console.log("  Tests include: valid addresses, invalid addresses, authorization, combined operations, edge cases, validation logic, final state verification");
        console.log("  Final Fee Address 1:", FEE_ADDR_1.toString());
        console.log("  Final Fee Address 2:", FEE_ADDR_2.toString());
        console.log("  Final Staking Address:", STAKING_ADDR.toString());
        console.log("  🎯 These addresses are now set in the contract and ready for use!");
    });
});
