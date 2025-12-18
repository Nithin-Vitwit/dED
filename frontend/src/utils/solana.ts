import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { Buffer } from "buffer";

// Program ID from lib.rs
const PROGRAM_ID = new anchor.web3.PublicKey("EHfsAqymJNvS2WY27PppSxXCnX6tJsCifCr3hAi7r5fb");

// IDL (interface definition) - matches the Rust contract
const IDL = {
    "version": "0.1.0",
    "name": "anchor",
    "address": PROGRAM_ID.toString(),
    "instructions": [
        {
            "name": "initAsset",
            "discriminator": [133, 1, 51, 41, 37, 45, 8, 38],
            "accounts": [
                { "name": "asset", "isMut": true, "isSigner": false },
                { "name": "creator", "isMut": true, "isSigner": true },
                { "name": "systemProgram", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "price", "type": "u64" },
                { "name": "arweaveId", "type": "string" }
            ]
        },
        {
            "name": "buyAsset",
            "discriminator": [197, 37, 177, 1, 180, 23, 175, 98],
            "accounts": [
                { "name": "accessState", "isMut": true, "isSigner": false },
                { "name": "asset", "isMut": true, "isSigner": false },
                { "name": "buyer", "isMut": true, "isSigner": true },
                { "name": "creator", "isMut": true, "isSigner": false },
                { "name": "systemProgram", "isMut": false, "isSigner": false }
            ],
            "args": []
        }
    ],
    "accounts": [
        {
            "name": "Asset",
            "discriminator": [234, 180, 241, 252, 139, 224, 160, 8]
        },
        {
            "name": "AccessState",
            "discriminator": [15, 106, 137, 31, 27, 231, 254, 21]
        }
    ],
    "types": [
        {
            "name": "Asset",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "owner", "type": "pubkey" },
                    { "name": "price", "type": "u64" },
                    { "name": "arweaveId", "type": "string" },
                    { "name": "bump", "type": "u8" }
                ]
            }
        },
        {
            "name": "AccessState",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "asset", "type": "pubkey" },
                    { "name": "user", "type": "pubkey" },
                    { "name": "bump", "type": "u8" }
                ]
            }
        }
    ]
};

export const getProgram = (walletAdapter: any, connection: anchor.web3.Connection) => {
    if (!walletAdapter || !walletAdapter.publicKey) {
        throw new Error("Wallet not connected. Please ensure your wallet is connected and try again.");
    }

    // Use the wallet adapter's built-in AnchorWallet compatibility
    const provider = new AnchorProvider(
        connection,
        walletAdapter as AnchorWallet,
        { commitment: "confirmed" }
    );

    console.log("Initializing Program with:");
    console.log("IDL:", IDL);
    console.log("PROGRAM_ID:", PROGRAM_ID.toString());
    console.log("Provider:", provider);

    return new Program(IDL as any, provider);
};

export const initAssetOnChainV2 = async (
    walletAdapter: any,
    connection: anchor.web3.Connection,
    arweaveId: string,
    priceInSol: number
) => {
    console.log("initAssetOnChain called with:", { arweaveId, priceInSol, walletDefined: !!walletAdapter });
    if (!arweaveId) {
        console.error("initAssetOnChain: arweaveId is undefined!");
        throw new Error("initAssetOnChain: arweaveId is missing");
    }

    const program = getProgram(walletAdapter, connection);
    const priceInLamports = new anchor.BN(priceInSol * LAMPORTS_PER_SOL);

    console.log("Preparing to call initAsset:", {
        priceInSol,
        priceInLamports: priceInLamports.toString(),
        arweaveId,
        arweaveIdType: typeof arweaveId,
        programId: program.programId.toString()
    });

    if (isNaN(priceInSol)) {
        throw new Error("Invalid price: NaN");
    }

    // Derive PDA for asset
    const [assetPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("asset"),
            walletAdapter.publicKey.toBuffer(),
            Buffer.from(String(arweaveId)).subarray(0, 32),
        ],
        program.programId
    );

    try {
        const tx = await program.methods
            .initAsset(priceInLamports, arweaveId)
            .accounts({
                asset: assetPDA,
                creator: walletAdapter.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .rpc();

        return { tx, assetPDA: assetPDA.toString() };
    } catch (err: any) {
        console.error("Transaction Error in initAssetOnChainV2:", err);
        if (err.logs) {
            console.error("Transaction Simulation Logs:", err.logs);
        } else if (err.transactionLogs) {
            console.error("Transaction Logs:", err.transactionLogs);
        }
        throw err;
    }
};

export const initAssetOnChainManual = async (
    walletAdapter: any,
    connection: anchor.web3.Connection,
    arweaveId: string,
    priceInSol: number
) => {
    console.log("initAssetOnChainManual called");
    const provider = new AnchorProvider(connection, walletAdapter as AnchorWallet, { commitment: "confirmed" });
    const programId = PROGRAM_ID;

    // 1. Derive PDA
    const [assetPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("asset"),
            walletAdapter.publicKey.toBuffer(),
            Buffer.from(String(arweaveId)).subarray(0, 32),
        ],
        programId
    );
    console.log("Calculated Asset PDA:", assetPDA.toString());

    // 2. Construct Data Buffer manually
    // Layout: Discriminator (8) + Price (8) + ArweaveId (4 + len)
    const discriminator = Buffer.from([133, 1, 51, 41, 37, 45, 8, 38]);

    const priceBN = new anchor.BN(priceInSol * LAMPORTS_PER_SOL);
    const priceBuffer = Buffer.alloc(8);
    // BN toBuffer is BigEndian by default, usually Anchor uses LittleEndian for u64
    // We can use toBuffer('le', 8)
    const priceBytes = priceBN.toArrayLike(Buffer, 'le', 8);

    const idString = String(arweaveId);
    const idBytes = Buffer.from(idString);
    const lenBuffer = Buffer.alloc(4);
    lenBuffer.writeUInt32LE(idBytes.length, 0);

    const data = Buffer.concat([
        discriminator,
        priceBytes,
        lenBuffer,
        idBytes
    ]);

    // 3. Construct Instruction manually
    const ix = new anchor.web3.TransactionInstruction({
        programId: programId,
        keys: [
            { pubkey: assetPDA, isSigner: false, isWritable: true },      // asset (Mut)
            { pubkey: walletAdapter.publicKey, isSigner: true, isWritable: true }, // creator (Mut, Signer)
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // systemProgram
        ],
        data: data
    });

    console.log("Sending manual transaction...");
    try {
        const tx = await provider.sendAndConfirm(
            new anchor.web3.Transaction().add(ix)
        );
        return { tx, assetPDA: assetPDA.toString() };
    } catch (err: any) {
        console.error("Manual Transaction Error:", err);
        if (err.logs) console.error("Logs:", err.logs);
        throw err;
    }
};

export const buyAssetOnChainManual = async (
    walletAdapter: any,
    connection: anchor.web3.Connection,
    assetPDA: string,
    creatorPublicKey: string
) => {
    console.log("buyAssetOnChainManual called");
    const provider = new AnchorProvider(connection, walletAdapter as AnchorWallet, { commitment: "confirmed" });
    const programId = PROGRAM_ID;
    const assetPubkey = new PublicKey(assetPDA);
    const creatorPubkey = new PublicKey(creatorPublicKey);

    // 1. Derive PDA for access state
    const [accessStatePDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("access"),
            assetPubkey.toBuffer(),
            walletAdapter.publicKey.toBuffer(),
        ],
        programId
    );

    // 2. Construct Data
    // buy_asset instruction has no arguments, only discriminator
    const discriminator = Buffer.from([197, 37, 177, 1, 180, 23, 175, 98]);

    // 3. Construct Instruction
    const ix = new anchor.web3.TransactionInstruction({
        programId: programId,
        keys: [
            { pubkey: accessStatePDA, isSigner: false, isWritable: true },  // accessState (Init)
            { pubkey: assetPubkey, isSigner: false, isWritable: true },     // asset (Mut)
            { pubkey: walletAdapter.publicKey, isSigner: true, isWritable: true }, // buyer (Mut, Signer)
            { pubkey: creatorPubkey, isSigner: false, isWritable: true },   // creator (Mut)
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // systemProgram
        ],
        data: discriminator
    });

    // Verify Asset exists and Owner matches Creator
    const assetAccountInfo = await connection.getAccountInfo(assetPubkey);
    if (!assetAccountInfo) {
        console.error("Asset Account not found on chain:", assetPDA);
        throw new Error("Asset account not found. It may not have been created correctly.");
    }

    // Decode Asset: Discriminator(8) + Owner(32) ...
    // Verify Discriminator first
    const assetDisc = Buffer.from(assetAccountInfo.data).subarray(0, 8);
    const expectedAssetDisc = Buffer.from([234, 180, 241, 252, 139, 224, 160, 8]);
    if (!assetDisc.equals(expectedAssetDisc)) {
        console.error("Asset discriminator mismatch. Not an Asset account.");
        throw new Error("Invalid Asset account data");
    }

    const onChainOwner = new PublicKey(assetAccountInfo.data.subarray(8, 40));
    console.log("Verification:", {
        passedCreator: creatorPubkey.toString(),
        onChainOwner: onChainOwner.toString(),
        match: onChainOwner.equals(creatorPubkey),
        assetBytes: assetAccountInfo.data.length
    });

    if (!onChainOwner.equals(creatorPubkey)) {
        throw new Error(`Creator mismatch! Frontend: ${creatorPubkey.toString()}, OnChain: ${onChainOwner.toString()}`);
    }

    console.log("Sending manual buy transaction...");
    try {
        const tx = await provider.sendAndConfirm(
            new anchor.web3.Transaction().add(ix)
        );
        return { tx, accessStatePDA: accessStatePDA.toString() };
    } catch (err: any) {
        console.error("Manual Buy Transaction Error:", err);
        console.error("Full Error Object:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        if (err.logs) console.error("Logs:", err.logs);
        throw err;
    }
};

export const buyAssetOnChain = async (
    walletAdapter: any,
    connection: anchor.web3.Connection,
    assetPDA: string,
    creatorPublicKey: string
) => {

};

export const checkAccess = async (
    walletAdapter: any,
    connection: anchor.web3.Connection,
    assetPDA: string
) => {
    const program = getProgram(walletAdapter, connection);
    const assetPubkey = new PublicKey(assetPDA);

    // Derive PDA for access state
    const [accessStatePDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from("access"),
            assetPubkey.toBuffer(),
            walletAdapter.publicKey.toBuffer(),
        ],
        program.programId
    );

    try {
        const accessState = await (program.account as any).accessState.fetch(accessStatePDA);
        return !!accessState; // If exists, user has access
    } catch (e) {
        return false; // PDA doesn't exist = no access
    }
};
