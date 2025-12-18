import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Alert, Spinner, ListGroup, Badge } from 'react-bootstrap';
import { createHighlighter } from 'shiki';
import streamSaver from 'streamsaver';
import axios from 'axios';
import { useWallet } from '@solana/wallet-adapter-react';
import * as LitJsSdk from "@lit-protocol/lit-node-client";

import init, { decrypt_chunk_session_bound } from '../../../security_enclave/pkg/security_enclave';
import { connectLit, decryptKey } from '../utils/lit';

// --- Sub-components (VideoPlayer, CodeBlock, DownloadButton) ---
// Kept same as before, simplified for brevity in replacement but full logic maintained
const VideoPlayer = ({ decryptedBlob }) => {
    const [url, setUrl] = useState(null);
    useEffect(() => {
        if (decryptedBlob) {
            const vidUrl = URL.createObjectURL(decryptedBlob);
            setUrl(vidUrl);
            return () => URL.revokeObjectURL(vidUrl);
        }
    }, [decryptedBlob]);
    if (!url) return <Spinner animation="border" />;
    return (
        <div className="ratio ratio-16x9">
            <video controls src={url} className="w-100 rounded" />
        </div>
    );
};

const CodeBlock = ({ decryptedBlob }) => {
    const [html, setHtml] = useState('');
    useEffect(() => {
        const renderCode = async () => {
            if (!decryptedBlob) return;
            const text = await decryptedBlob.text();
            try {
                const highlighter = await createHighlighter({ themes: ['nord'], langs: ['javascript', 'rust', 'html', 'css'] });
                const codeHtml = highlighter.codeToHtml(text, { lang: 'javascript', theme: 'nord' });
                setHtml(codeHtml);
            } catch (e) { setHtml(`<pre>${text}</pre>`); }
        };
        renderCode();
    }, [decryptedBlob]);
    if (!html) return <Spinner animation="border" />;
    return <div dangerouslySetInnerHTML={{ __html: html }} className="p-3 bg-dark rounded text-light" />;
};

const DownloadButton = ({ decryptedBlob, filename }) => {
    const handleDownload = async () => {
        if (!decryptedBlob) return;
        const url = URL.createObjectURL(decryptedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };
    return <Button variant="success" onClick={handleDownload} className="w-100">Download Decrypted File</Button>;
};

// --- Main Component ---

const AssetRenderer = () => {
    const wallet = useWallet();
    const [assets, setAssets] = useState([]);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [decryptedBlob, setDecryptedBlob] = useState(null);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('idle');
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        init().catch(console.error);
        fetchAssets();
    }, []);

    const fetchAssets = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/assets');
            setAssets(res.data);
        } catch (e) { console.error("Error fetching assets", e); }
    }

    const addLog = (msg) => setLogs(p => [...p, msg]);

    const handleDecrypt = async () => {
        if (!selectedAsset || !wallet.connected) {
            addLog("Wallet not connected or no asset selected.");
            return;
        }
        setStatus('decrypting');
        setError(null);
        setLogs([]);

        try {
            addLog("Connecting to Lit...");
            await connectLit();

            // 1. Get Auth Sig
            // Using checkAndSignAuthMessage to get signature from wallet
            addLog("Signing auth message...");
            const authSig = await LitJsSdk.checkAndSignAuthMessage({
                chain: "solana",
            });

            // 2. Decrypt Session Key via Lit
            addLog("Decrypting Session Key with Lit...");
            const { litEncryptedKey, accessControlConditions } = selectedAsset;
            if (!litEncryptedKey || !accessControlConditions) {
                throw new Error("Missing Lit metadata on this asset. Was it uploaded securely?");
            }

            const { ciphertext, dataToEncryptHash } = litEncryptedKey;

            const keyHex = await decryptKey(authSig, ciphertext, dataToEncryptHash, accessControlConditions);
            addLog("Session Key Decrypted!");

            // 3. Fetch Encrypted Data from Arweave
            addLog(`Fetching content from Arweave (ID: ${selectedAsset.arweaveId})...`);
            // Use Irys gateway or arweave.net
            const arweaveData = await axios.get(`https://gateway.irys.xyz/${selectedAsset.arweaveId}`, {
                responseType: 'arraybuffer'
            });
            const fileUint8 = new Uint8Array(arweaveData.data);
            addLog(`Content fetched: ${fileUint8.length} bytes`);

            // 4. Decrypt Content via WASM
            addLog("Decrypting content via WASM enclave...");
            const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

            // Decrypt
            // Note: WASM decrypt_chunk expects nonce at start (12 bytes)
            const decryptedBytes = decrypt_chunk_session_bound(fileUint8, keyBytes);
            const blob = new Blob([decryptedBytes], { type: selectedAsset.mimeType });

            setDecryptedBlob(blob);
            setStatus('done');
            addLog("Decryption Success! Rendering...");

        } catch (err) {
            console.error(err);
            setError('Decryption failed: ' + err.message);
            setStatus('error');
            addLog("Error: " + err.message);
        }
    };

    return (
        <Card className="mt-4">
            <Card.Header>Secure Asset Viewer (Library)</Card.Header>
            <Card.Body>
                {!selectedAsset ? (
                    <div className="mb-3">
                        <h5>Available Assets</h5>
                        <ListGroup>
                            {assets.map(a => (
                                <ListGroup.Item key={a._id} action onClick={() => { setSelectedAsset(a); setDecryptedBlob(null); setLogs([]); setStatus('idle'); }}>
                                    {a.originalName} <Badge bg="secondary">{a.mimeType}</Badge>
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                        {assets.length === 0 && <p>No assets found. Upload one above!</p>}
                    </div>
                ) : (
                    <div>
                        <Button variant="outline-secondary" size="sm" onClick={() => setSelectedAsset(null)} className="mb-3">Back to Library</Button>
                        <h5>{selectedAsset.originalName}</h5>

                        <Button
                            className="mb-4"
                            onClick={handleDecrypt}
                            disabled={status === 'decrypting' || !wallet.connected}
                        >
                            {!wallet.connected ? 'Connect Wallet to Access' :
                                status === 'decrypting' ? 'Decrypting...' : 'Unlock & View'}
                        </Button>

                        <div className="bg-light p-2 mb-3 rounded" style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.8em' }}>
                            {logs.map((l, i) => <div key={i}>{l}</div>)}
                        </div>

                        {error && <Alert variant="danger">{error}</Alert>}

                        {decryptedBlob && (
                            <div className="border p-3 rounded">
                                {selectedAsset.mimeType.startsWith('video/') ? (
                                    <VideoPlayer decryptedBlob={decryptedBlob} mimeType={selectedAsset.mimeType} />
                                ) : (selectedAsset.mimeType.includes('javascript') || selectedAsset.mimeType.includes('text') || selectedAsset.mimeType.includes('json')) ? (
                                    <CodeBlock decryptedBlob={decryptedBlob} />
                                ) : (
                                    <DownloadButton decryptedBlob={decryptedBlob} filename={"decrypted_" + selectedAsset.originalName} />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Card.Body>
        </Card>
    );
};

export default AssetRenderer;
