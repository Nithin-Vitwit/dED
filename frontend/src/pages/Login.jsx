import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const Login = () => {
    const { connected, connecting } = useWallet();
    const navigate = useNavigate();

    useEffect(() => {
        // Only redirect when connected and not in the middle of connecting
        if (connected && !connecting) {
            console.log('Wallet connected, navigating to home...');
            setTimeout(() => {
                navigate('/', { replace: true });
            }, 500); // Small delay to ensure state is fully updated
        }
    }, [connected, connecting, navigate]);

    // Don't render anything if we're connected (about to redirect)
    if (connected) {
        return (
            <div className="login-container">
                <div className="mono-text">Redirecting...</div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="login-logo">
                <span className="yellow-highlight">perma</span>dED
            </div>

            <div className="login-hero">
                <img
                    src="/permaded-title.png"
                    alt="PERMAdED"
                    className="hero-title-image"
                    style={{ maxWidth: '600px', marginBottom: '1rem' }}
                />
                <div className="login-tagline">
                    A decentralized education platform on Solana Network
                </div>
            </div>

            <WalletMultiButton />

            <div style={{ marginTop: '3rem', textAlign: 'center', opacity: 0.6 }}>
                <small className="mono-text">
                    Connect your Solana wallet to access the platform
                </small>
            </div>
        </div>
    );
};

export default Login;
