import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { encryptString, decryptToString } from "@lit-protocol/encryption";

const client = new LitJsSdk.LitNodeClient({
    litNetwork: "datil-dev",
});

export const connectLit = async () => {
    await client.connect();
    return client;
}

export const encryptKey = async (authSig, keyBytes) => {
    // Basic Access Control: Anyone can decrypt for now (Simulating Public Access Pass)
    // In real app, we check if user owns the Anchor PDA
    // Simplification: We will use a permissive condition for testing flow if needed, 
    // or strictly lock to creator for now until Smart Contract PDA check is fully wired.
    // Let's use: User must hold at least 0.000001 SOL (Proof of existence)
    const accessControlConditionsTesting = [
        {
            conditionType: "solRpc",
            method: "getBalance",
            params: [":userAddress"],
            pdaInterface: { offset: 0, fields: {} },
            pdaKey: "",
            chain: "solanaDevnet",
            returnValueTest: {
                key: "",
                comparator: ">=",
                value: "0",
            },
        },
    ];

    const { ciphertext, dataToEncryptHash } = await encryptString(
        {
            solRpcConditions: accessControlConditionsTesting,
            authSig,
            chain: 'solana',
            dataToEncrypt: Buffer.from(keyBytes).toString('hex'), // Encrypt the Hex Rep of the Key
        },
        client
    );

    return {
        ciphertext,
        dataToEncryptHash,
        accessControlConditions: accessControlConditionsTesting
    };
};

export const decryptKey = async (authSig, ciphertext, dataToEncryptHash, accessControlConditions) => {
    const decryptedString = await decryptToString(
        {
            solRpcConditions: accessControlConditions,
            ciphertext,
            dataToEncryptHash,
            authSig,
            chain: 'solana',
        },
        client
    );
    return decryptedString;
}
