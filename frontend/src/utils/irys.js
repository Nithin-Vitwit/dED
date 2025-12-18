import { WebIrys } from "@irys/sdk";

export const getIrys = async (wallet, connection) => {
    const network = "devnet"; // "mainnet" or "devnet"
    const token = "solana";

    // Get RPC endpoint from connection or use default
    const rpcUrl = connection?._rpcEndpoint || "https://api.devnet.solana.com";

    // Custom provider to adapt Solana Wallet Adapter to Irys
    console.log("Creating Irys provider for wallet:", wallet.publicKey.toString());
    const provider = {
        name: "solana",
        publicKey: wallet.publicKey,
        getPublicKey: async () => {
            return wallet.publicKey;
        },
        signMessage: async (message) => {
            const signed = await wallet.signMessage(message);
            return signed;
        },
        signTransaction: async (tx) => {
            const signed = await wallet.signTransaction(tx);
            return signed;
        },
        sendTransaction: async (tx) => {
            // Pass connection to sendTransaction for funding
            return await wallet.sendTransaction(tx, connection);
        }
    };

    const irys = new WebIrys({
        network,
        token,
        wallet: {
            provider: provider,
            rpcUrl: rpcUrl
        },
        config: {
            providerUrl: rpcUrl,
            timeout: 600000 // Global timeout: 10 minutes
        }
    });

    await irys.ready();
    return irys;
};

export const uploadToArweave = async (irys, data, tags = []) => {
    try {
        // Set a longer timeout for large file uploads (10 minutes)
        const uploadOptions = {
            tags,
            timeout: 600000 // 10 minutes in milliseconds
        };

        console.log(`Uploading ${(data.length / 1024 / 1024).toFixed(2)} MB to Irys...`);
        console.log("Upload options:", uploadOptions);
        const receipt = await irys.upload(data, uploadOptions);

        console.log("Irys Upload Receipt:", receipt);
        if (!receipt || !receipt.id) {
            console.error("Irys receipt missing ID!", receipt);
            throw new Error("Upload succeeded but no ID was returned");
        }
        return receipt.id;
    } catch (e) {
        console.error("Full Irys upload error:", e);

        // Provide more helpful error messages
        if (e.message && e.message.includes('timeout')) {
            throw new Error(`Upload timed out. File may be too large or network too slow. Try a smaller file or check your connection.`);
        } else if (e.message && e.message.includes('insufficient funds')) {
            throw new Error(`Insufficient funds in Irys wallet. Please fund your account.`);
        } else {
            throw new Error("Irys Upload Error: " + (e.message || 'Unknown error'));
        }
    }
};
