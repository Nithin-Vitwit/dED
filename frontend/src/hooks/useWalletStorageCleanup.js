import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect } from 'react';

/**
 * Custom hook to clear wallet-related localStorage on disconnect
 * Provides better privacy by removing sign messages and wallet data
 */
const useWalletStorageCleanup = () => {
    const { connected } = useWallet();

    useEffect(() => {
        // Clear wallet data from localStorage when disconnected
        if (!connected) {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                // Remove wallet-adapter and solana-related keys
                if (key && (
                    key.includes('wallet') ||
                    key.includes('solana') ||
                    key.includes('lit-') ||
                    key.includes('signature')
                )) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
                console.log(`🧹 Cleared: ${key}`);
            });
        }
    }, [connected]);
};

export default useWalletStorageCleanup;
