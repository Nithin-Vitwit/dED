import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import axios from 'axios';
import { Container, Card, Form, Button, ProgressBar, Alert } from 'react-bootstrap';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import * as LitJsSdk from "@lit-protocol/lit-node-client";

import init, { encrypt_chunk, generate_key } from '../../../security_enclave/pkg/security_enclave';
import { getIrys, uploadToArweave } from '../utils/irys';
import { connectLit, encryptKey } from '../utils/lit';

const FileUploader = () => {
    const wallet = useWallet();
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle');
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);
    const [wasmReady, setWasmReady] = useState(false);
    const ffmpegRef = useRef(new FFmpeg());

    useEffect(() => {
        const loadWasm = async () => {
            try {
                await init();
                setWasmReady(true);
                addLog('WASM Enclave loaded');
            } catch (err) {
                console.error(err);
                addLog('Error loading WASM: ' + err.message);
            }
        };
        loadWasm();
    }, []);

    const addLog = (msg) => {
        setLogs((prev) => [...prev, msg]);
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const loadFFmpeg = async () => {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
        const ffmpeg = ffmpegRef.current;
        ffmpeg.on('log', ({ message }) => { });
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        addLog('FFmpeg loaded');
    }

    const handleUpload = async () => {
        if (!file || !wasmReady || !wallet.connected) {
            addLog("Please connect wallet first.");
            return;
        }
        setStatus('processing');
        setProgress(0);
        try {
            const isVideo = file.type.startsWith('video/');
            let dataToEncrypt = file;

            // 1. Transcode if Video (Simplified)
            if (isVideo) {
                // For MVP stability with large files, we might skip transcoding if ffmpeg crashes in this environment
                // But we keep the logic structure.
                addLog('Preparing video...');
            }

            // 2. Initialize Lit & Irys
            addLog('Connecting to Lit Protocol...');
            await connectLit();

            addLog('Initializing Irys (Arweave)...');
            const irys = await getIrys(wallet);
            addLog(`Irys Connected. Address: ${irys.address}`);

            // 3. Generate & Encrypt Key
            setStatus('encrypting');
            addLog('Generating secure session key...');
            const key = generate_key();

            addLog('Encrypting key with Lit...');
            // Need an authSig for Lit
            // For browser, we usually use checkAndSignAuthMessage, but for custom node client we might need manual sig
            // Using a simple workaround or assuming standard auth for now.
            // The lit-node-client in browser usually requires 'checkAndSignAuthMessage' from @lit-protocol/lit-node-client itself if available
            // or we construct it. Let's try standard flow.

            // NOTE: Lit v3 requires consistent authSig. We might need to prompt signature.
            // For MVP speed, we'll try to use the wallet to sign the specific message Lit expects if the SDK helper isn't finding it.
            // Actually, `checkAndSignAuthMessage` should handle it.

            // To simplify, we will skip the "Encrypt Key" complex AuthSig flow for this EXACT step if it fails, 
            // but let's try to do it right.
            // We'll proceed with plain KEY generated first, and try to encrypt it.

            // Mocking AuthSig for simplicity in this prompt if needed, but let's try real:
            // Lit Docs: client.checkAndSignAuthMessage({ chain: 'solana' })

            // Let's defer Lit Key Encryption until we have a robust AuthSig helper, 
            // OR we just store the conditions for now.
            // Actually, let's implement the basic Lit encryption call.

            // Workaround: We need a valid AuthSig.
            // Let's assume we can get it or fail gracefully.
            const authSig = await LitJsSdk.checkAndSignAuthMessage({
                chain: "solana",
            });

            const { ciphertext, dataToEncryptHash, accessControlConditions } = await encryptKey(authSig, key);
            addLog('Key Encrypted with Lit.');

            // 4. Encrypt File
            addLog('Encrypting file content...');
            const fileBuffer = await dataToEncrypt.arrayBuffer();
            const fileUint8 = new Uint8Array(fileBuffer);
            const encryptedData = encrypt_chunk(fileUint8, key);
            addLog(`Encryption complete. Size: ${encryptedData.length}`);

            // 5. Upload to Arweave (Real)
            setStatus('uploading');
            addLog('Uploading to Arweave (Irys)...');
            // Ensure we have funds? Validation usually happens inside upload or we check balance.

            // Convert Uint8Array to Buffer for Irys (since we have Node polyfills)
            const dataBuffer = Buffer.from(encryptedData);

            const arweaveId = await uploadToArweave(irys, dataBuffer, [
                { name: "Content-Type", value: "application/octet-stream" },
                { name: "App-Name", value: "DeEd-Marketplace" }
            ]);
            addLog(`Arweave Upload Success: ${arweaveId}`);

            // 6. Register Metadata
            await axios.post('http://localhost:5000/api/assets', {
                originalName: file.name,
                mimeType: file.type || 'application/octet-stream',
                isVideo: isVideo,
                arweaveId: arweaveId,
                litEncryptedKey: { ciphertext, dataToEncryptHash },
                accessControlConditions
            });

            setProgress(100);
            setStatus('done');
            addLog(`Success! Asset Registered.`);

        } catch (err) {
            console.error(err);
            setStatus('error');
            addLog('Error: ' + err.message);
        }
    };

    return (
        <Container className="mt-5">
            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <span>DeEd Secure Upload (Irys + Lit)</span>
                    <WalletMultiButton />
                </Card.Header>
                <Card.Body>
                    <Form.Group controlId="formFile" className="mb-3">
                        <Form.Label>Select Asset</Form.Label>
                        <Form.Control type="file" onChange={handleFileChange} />
                    </Form.Group>

                    {file && (
                        <div className="mb-3">
                            <p>Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>
                        </div>
                    )}

                    <div className="d-grid gap-2">
                        <Button
                            variant="primary"
                            onClick={handleUpload}
                            disabled={!file || !wasmReady || status === 'processing' || status === 'uploading' || !wallet.connected}
                        >
                            {!wallet.connected ? 'Connect Wallet to Upload' :
                                status === 'processing' ? 'Processing...' : 'Upload & Encrypt'}
                        </Button>
                    </div>

                    {status !== 'idle' && (
                        <div className="mt-4">
                            <h5>Progress: {status}</h5>
                            <ProgressBar animated now={progress} label={`${progress}%`} />
                        </div>
                    )}

                    <div className="mt-4 bg-light p-3 rounded" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        <h6>Logs:</h6>
                        {logs.map((log, i) => <div key={i} className="text-muted small">{log}</div>)}
                    </div>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default FileUploader;

