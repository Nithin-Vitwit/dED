import React, { useState, useRef, useEffect } from 'react';
import { Container, Card, Form, Button, ProgressBar, Alert, Row, Col, ButtonGroup } from 'react-bootstrap';
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as LitJsSdk from "@lit-protocol/lit-node-client";

import init, { encrypt_chunk, generate_key } from '../wasm/security_enclave.js';
import { getIrys, uploadToArweave } from '../utils/irys';
import { connectLit, encryptKey } from '../utils/lit';

const UploadCourse = () => {
    const wallet = useWallet();
    const anchorWallet = useAnchorWallet();
    const { connection } = useConnection();
    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [wasmReady, setWasmReady] = useState(false);
    const [status, setStatus] = useState('idle');
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);

    // Form fields
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Development',
        price: ''
    });

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
            addLog(`Selected file: ${e.target.files[0].name} (${(e.target.files[0].size / 1024 / 1024).toFixed(2)} MB)`);
        }
    };

    const handleThumbnailChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setThumbnailFile(e.target.files[0]);
            addLog(`Selected thumbnail: ${e.target.files[0].name}`);
        }
    };

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleQuickPrice = (price) => {
        setFormData({ ...formData, price: price.toString() });
    };

    const handleUpload = async () => {
        if (!file || !wasmReady || !wallet.connected) {
            addLog("Please connect wallet and select a file.");
            return;
        }

        if (!formData.title || !formData.price) {
            addLog("Please fill in title and price.");
            return;
        }

        console.log("Starting upload process...", formData);
        addLog(`Starting upload: ${formData.title} - ${formData.price} SOL`);

        setStatus('processing');
        setProgress(0);

        try {
            const isVideo = file.type.startsWith('video/');

            // Initialize Lit & Irys
            addLog('Connecting to Lit Protocol...');
            await connectLit();

            addLog('Initializing Irys (Arweave)...');
            const irys = await getIrys(wallet, connection);
            addLog(`Irys Connected. Address: ${irys.address}`);

            // Check and fund Irys wallet if needed
            addLog('Checking Irys balance...');
            const balance = await irys.getLoadedBalance();
            const balanceInSol = balance / 1e9; // Convert lamports to SOL
            addLog(`Current Irys balance: ${balanceInSol.toFixed(6)} SOL`);

            // For safety, always fund if balance is less than 0.1 SOL
            // This covers files up to ~1GB on devnet
            if (balanceInSol < 0.1) {
                addLog(`Insufficient balance. Funding Irys with 0.1 SOL...`);
                try {
                    const fundTx = await irys.fund(100000000); // Fund with 0.1 SOL (100,000,000 lamports)
                    addLog(`Funded successfully! TX: ${fundTx.id || 'confirmed'}`);

                    // Wait a moment for the funding to be processed
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Check new balance
                    const newBalance = await irys.getLoadedBalance();
                    addLog(`New Irys balance: ${(newBalance / 1e9).toFixed(6)} SOL`);
                } catch (fundError) {
                    console.error('Funding error details:', fundError);
                    throw new Error(`Failed to fund Irys wallet: ${fundError.message}. Please ensure you have SOL in your wallet.`);
                }
            }

            // Generate & Encrypt Key
            setStatus('encrypting');
            addLog('Generating secure session key...');
            const key = generate_key();

            addLog('Encrypting key with Lit...');
            const authSig = await LitJsSdk.checkAndSignAuthMessage({
                chain: "solana",
            });

            const { ciphertext, dataToEncryptHash, accessControlConditions } = await encryptKey(authSig, key);
            addLog('Key Encrypted with Lit.');

            // Encrypt File
            addLog('Encrypting file content...');
            const fileBuffer = await file.arrayBuffer();
            const fileUint8 = new Uint8Array(fileBuffer);
            const encryptedData = encrypt_chunk(fileUint8, key);
            addLog(`Encryption complete. Size: ${encryptedData.length}`);

            // Upload to Arweave
            setStatus('uploading');
            addLog('Uploading processing...');
            console.time('Irys Upload');
            addLog(`Sending ${encryptedData.length} bytes to Irys...`);
            const dataBuffer = Buffer.from(encryptedData);

            const arweaveId = await uploadToArweave(irys, dataBuffer, [
                { name: "Content-Type", value: "application/octet-stream" },
                { name: "App-Name", value: "DeEd-Marketplace" }
            ])
            console.log("Arweave ID:", arweaveId);
            if (!arweaveId) {
                throw new Error("Arweave upload failed: No ID returned.");
            }
            console.timeEnd('Irys Upload');
            addLog(`Arweave Upload Success: ${arweaveId}`);

            // Register Asset on Solana Blockchain
            if (!anchorWallet) {
                throw new Error('Wallet not ready for blockchain operations. Please reconnect your wallet.');
            }

            addLog('Registering asset on Solana blockchain...');
            const { initAssetOnChainManual } = await import('../utils/solana.ts');
            const { tx, assetPDA } = await initAssetOnChainManual(
                anchorWallet,
                connection,
                arweaveId,
                parseFloat(formData.price)
            );
            addLog(`Blockchain registration complete! TX: ${tx.slice(0, 8)}...`);

            // Upload thumbnail if provided
            let thumbnailUrl = '';
            if (thumbnailFile) {
                addLog('Uploading thumbnail...');
                const thumbnailFormData = new FormData();
                thumbnailFormData.append('thumbnail', thumbnailFile);
                const thumbResponse = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/upload-thumbnail`, thumbnailFormData);
                thumbnailUrl = thumbResponse.data.url;
                addLog('Thumbnail uploaded!');
            }

            // Register Course in Database
            await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/assets`, {
                originalName: file.name,
                mimeType: file.type || 'application/octet-stream',
                isVideo: isVideo,
                arweaveId: arweaveId,
                litEncryptedKey: { ciphertext, dataToEncryptHash },
                accessControlConditions,
                title: formData.title,
                description: formData.description,
                price: parseFloat(formData.price),
                creator: wallet.publicKey.toString(),
                assetPDA: assetPDA,
                thumbnail: thumbnailUrl,
                category: formData.category
            });

            setProgress(100);
            setStatus('done');
            addLog(`Success! Course "${formData.title}" uploaded!`);

            setTimeout(() => {
                navigate('/');
            }, 2000);

        } catch (err) {
            console.error(err);
            setStatus('error');
            addLog('Error: ' + err.message);
        }
    };

    if (!wallet.connected) {
        return (
            <Container className="text-center py-5">
                <Alert variant="info">
                    <Alert.Heading>Connect Your Wallet</Alert.Heading>
                    <p>Please connect your Solana wallet to upload courses.</p>
                </Alert>
            </Container>
        );
    }

    return (
        <Container className="py-4" style={{ maxWidth: '800px' }}>
            <div className="card" style={{ border: '2px solid var(--border-color)' }}>
                <div style={{
                    padding: '1rem',
                    borderBottom: '2px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)'
                }}>
                    <h4 className="mono-text" style={{ margin: 0, fontWeight: 700 }}>Upload New Course</h4>
                </div>
                <div style={{ padding: '2rem' }}>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label className="mono-text" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                Course Title *
                            </Form.Label>
                            <Form.Control
                                type="text"
                                name="title"
                                placeholder="e.g., Complete Solana Development Course"
                                value={formData.title}
                                onChange={handleInputChange}
                                required
                                style={{
                                    borderRadius: '0',
                                    border: '1px solid var(--border-color)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="mono-text" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                Description
                            </Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                name="description"
                                placeholder="Describe what students will learn..."
                                value={formData.description}
                                onChange={handleInputChange}
                                style={{
                                    borderRadius: '0',
                                    border: '1px solid var(--border-color)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </Form.Group>

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="mono-text" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                        Category
                                    </Form.Label>
                                    <Form.Select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleInputChange}
                                        style={{
                                            borderRadius: '0',
                                            border: '1px solid var(--border-color)',
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        <option value="Development">Development</option>
                                        <option value="Design">Design</option>
                                        <option value="Business">Business</option>
                                        <option value="Marketing">Marketing</option>
                                        <option value="General">General</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="mono-text" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                        Price (SOL) *
                                    </Form.Label>
                                    <Form.Control
                                        type="number"
                                        step="0.1"
                                        name="price"
                                        placeholder="0.0"
                                        value={formData.price}
                                        onChange={handleInputChange}
                                        required
                                        style={{
                                            borderRadius: '0',
                                            border: '1px solid var(--border-color)',
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                    <div className="mt-2">
                                        <small className="mono-text" style={{ opacity: 0.7, fontSize: '0.75rem' }}>Quick fill:</small>
                                        <ButtonGroup size="sm" className="ms-2">
                                            {[0.00002, 0.00003, 0.00005, 0.0001, 0.0002].map(price => (
                                                <Button
                                                    key={price}
                                                    variant="outline-primary"
                                                    onClick={() => handleQuickPrice(price)}
                                                    style={{
                                                        borderRadius: '0',
                                                        fontFamily: 'var(--font-mono)',
                                                        fontSize: '0.75rem',
                                                        padding: '0.25rem 0.5rem'
                                                    }}
                                                >
                                                    {price}
                                                </Button>
                                            ))}
                                        </ButtonGroup>
                                    </div>
                                </Form.Group>
                            </Col>
                        </Row>

                        <Form.Group className="mb-3">
                            <Form.Label className="mono-text" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                Course Thumbnail (Optional)
                            </Form.Label>
                            <Form.Control
                                type="file"
                                accept="video/*,image/*,application/pdf,.zip,application/zip,application/x-zip-compressed"
                                onChange={handleThumbnailChange}
                                style={{
                                    borderRadius: '0',
                                    border: '1px solid var(--border-color)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.85rem'
                                }}
                            />
                            {thumbnailFile && (
                                <small className="mono-text" style={{ opacity: 0.7, fontSize: '0.75rem' }}>
                                    Selected: {thumbnailFile.name}
                                </small>
                            )}
                            <Form.Text className="mono-text" style={{ opacity: 0.6, fontSize: '0.75rem' }}>
                                Upload a square image (recommended 500x500px or larger)
                            </Form.Text>
                        </Form.Group>

                        <Form.Group className="mb-4">
                            <Form.Label className="mono-text" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                Course File *
                            </Form.Label>
                            <Form.Control
                                type="file"
                                onChange={handleFileChange}
                                style={{
                                    borderRadius: '0',
                                    border: '1px solid var(--border-color)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.85rem'
                                }}
                            />
                            {file && (
                                <small className="mono-text" style={{ opacity: 0.7, fontSize: '0.75rem' }}>
                                    Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </small>
                            )}
                        </Form.Group>

                        <div className="d-grid gap-2">
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleUpload}
                                disabled={!file || !wasmReady || status === 'processing' || status === 'uploading'}
                                style={{
                                    borderRadius: '0',
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 600,
                                    padding: '0.75rem'
                                }}
                            >
                                {status === 'processing' ? 'Processing...' :
                                    status === 'uploading' ? 'Uploading...' :
                                        'Upload & Encrypt Course'}
                            </Button>
                        </div>

                        {status !== 'idle' && (
                            <div className="mt-4">
                                <h6 className="mono-text" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    Progress: {status}
                                </h6>
                                <ProgressBar
                                    animated
                                    now={progress}
                                    label={`${progress}%`}
                                    style={{
                                        height: '1.5rem',
                                        borderRadius: '0',
                                        border: '1px solid var(--border-color)',
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>
                        )}

                        <div className="mt-4" style={{
                            backgroundColor: '#1a1a1a',
                            padding: '1rem',
                            border: '2px solid var(--border-color)',
                            maxHeight: '200px',
                            overflowY: 'auto'
                        }}>
                            <h6 className="mono-text" style={{
                                color: 'var(--accent-yellow)',
                                fontSize: '0.85rem',
                                marginBottom: '0.75rem'
                            }}>
                                Logs:
                            </h6>
                            {logs.map((log, i) => (
                                <div
                                    key={i}
                                    className="mono-text"
                                    style={{
                                        color: '#00ff00',
                                        fontSize: '0.75rem',
                                        marginBottom: '0.25rem',
                                        opacity: 0.9
                                    }}
                                >
                                    → {log}
                                </div>
                            ))}
                        </div>
                    </Form>
                </div>
            </div>
        </Container>
    );
};

export default UploadCourse;
