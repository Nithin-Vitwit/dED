import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, Alert, Spinner } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import axios from 'axios';
import * as LitJsSdk from "@lit-protocol/lit-node-client";

import init, { decrypt_chunk_session_bound } from '../wasm/security_enclave.js';
import { connectLit, decryptKey } from '../utils/lit';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';

import JSZip from 'jszip';
import mammoth from 'mammoth';

// Helper for file icons
const getFileIcon = (name) => {
    if (name.endsWith('/')) return '📁';
    if (name.match(/\.(png|jpg|jpeg|gif)$/i)) return '🖼️';
    if (name.match(/\.(js|jsx|ts|tsx|json|html|css)$/i)) return '📝';
    if (name.match(/\.md$/i)) return '📋';
    return '📄';
};

// Tree builder helper
const buildFileTree = (files) => {
    const root = {};

    Object.keys(files).forEach(path => {
        const parts = path.split('/');
        let current = root;

        parts.forEach((part, index) => {
            if (!part) return; // Handle trailing slash

            if (!current[part]) {
                const isFile = index === parts.length - 1 && !path.endsWith('/');
                current[part] = {
                    name: part,
                    path: parts.slice(0, index + 1).join('/'),
                    type: isFile ? 'file' : 'folder',
                    children: {},
                    fileEntry: isFile ? files[path] : null
                };
            }
            current = current[part].children;
        });
    });

    return root;
};

const FileNode = ({ node, level, onSelect }) => {
    const [expanded, setExpanded] = useState(false);

    const handleClick = (e) => {
        e.stopPropagation();
        if (node.type === 'folder') {
            setExpanded(!expanded);
        } else {
            onSelect(node);
        }
    };

    return (
        <div style={{ marginLeft: level * 12 }}>
            <div
                onClick={handleClick}
                style={{
                    cursor: 'pointer',
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: node.type === 'folder' ? '#ffd700' : '#ffffff', // Bright white for files
                    fontSize: '0.9rem',
                    fontFamily: 'monospace',
                    marginBottom: '2px', // Slight spacing
                    borderRadius: '4px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <span>{node.type === 'folder' ? (expanded ? '📂' : '📁') : getFileIcon(node.name)}</span>
                <span style={{ color: node.type === 'folder' ? '#ffd700' : '#ffffff', opacity: 0.9 }}>{node.name}</span>
            </div>

            {expanded && node.children && (
                <div>
                    {Object.values(node.children).map(child => (
                        <FileNode key={child.path} node={child} level={level + 1} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </div>
    );
};

const ZipContentRenderer = ({ decryptedBlob }) => {
    const [fileTree, setFileTree] = useState({});
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewContent, setPreviewContent] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadZip = async () => {
            try {
                const zip = await JSZip.loadAsync(decryptedBlob);
                const tree = buildFileTree(zip.files);
                setFileTree(tree);
                setLoading(false);
            } catch (err) {
                console.error("Failed to load ZIP", err);
                setLoading(false);
            }
        };
        loadZip();
    }, [decryptedBlob]);

    const handleFileSelect = async (node) => {
        if (!node.fileEntry) return;

        try {
            setSelectedFile(node.name);
            const type = node.name.split('.').pop().toLowerCase();

            if (['png', 'jpg', 'jpeg', 'gif'].includes(type)) {
                const blob = await node.fileEntry.async('blob');
                setPreviewContent({ type: 'image', url: URL.createObjectURL(blob) });
            } else if (['js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'md', 'txt', 'py', 'rs', 'sol'].includes(type)) {
                const text = await node.fileEntry.async('string');
                setPreviewContent({ type: 'text', content: text, lang: type });
            } else {
                setPreviewContent({ type: 'unknown', name: node.name });
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 300px) 1fr', gap: '1px', height: '600px', border: '1px solid var(--border-color)', backgroundColor: '#000' }}>
            {/* File Tree Sidebar */}
            <div style={{
                overflowY: 'auto',
                borderRight: '1px solid var(--border-color)',
                padding: '1rem',
                backgroundColor: '#111'
            }}>
                <div style={{ paddingBottom: '1rem', borderBottom: '1px solid #333', marginBottom: '1rem' }}>
                    <h5 className="mono-text" style={{ fontSize: '0.9rem', margin: 0, color: '#ffffff', letterSpacing: '1px' }}>PROJECT FILES</h5>
                </div>
                {loading ? <Spinner size="sm" /> : (
                    <div>
                        {Object.values(fileTree).map(node => (
                            <FileNode key={node.path} node={node} level={0} onSelect={handleFileSelect} />
                        ))}
                    </div>
                )}
            </div>

            {/* Preview Area */}
            <div style={{ overflowY: 'auto', padding: '1.5rem', backgroundColor: '#0a0a0a' }}>
                {!selectedFile ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5, gap: '1rem' }}>
                        <div style={{ fontSize: '3rem' }}>⚡</div>
                        <div>Select a file to preview content</div>
                    </div>
                ) : (
                    <div>
                        <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--primary-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong className="mono-text" style={{ color: '#ffffff', fontSize: '1.1rem' }}>{selectedFile}</strong>
                        </div>
                        {previewContent?.type === 'image' && (
                            <img src={previewContent.url} alt="Preview" style={{ maxWidth: '100%', border: '1px solid #333' }} />
                        )}
                        {previewContent?.type === 'text' && (
                            <div style={{ position: 'relative' }}>
                                <SyntaxHighlighter
                                    language={previewContent.lang === 'js' ? 'javascript' : 'text'}
                                    style={dracula}
                                    customStyle={{ background: '#111', fontSize: '0.85rem', border: '1px solid #333', borderRadius: '4px' }}
                                    showLineNumbers={true}
                                >
                                    {previewContent.content}
                                </SyntaxHighlighter>
                            </div>
                        )}
                        {previewContent?.type === 'unknown' && (
                            <Alert variant="info" style={{ backgroundColor: '#1e1e1e', border: 'none', color: '#aaa' }}>
                                Preview not available for this file type.
                            </Alert>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const DocxContentRenderer = ({ decryptedBlob }) => {
    const [htmlContent, setHtmlContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const convertDocx = async () => {
            try {
                const arrayBuffer = await decryptedBlob.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                setHtmlContent(result.value);
                setLoading(false);
            } catch (err) {
                console.error("Failed to convert DOCX", err);
                setError("Failed to render document preview.");
                setLoading(false);
            }
        };
        convertDocx();
    }, [decryptedBlob]);

    if (loading) return <Spinner animation="border" size="sm" />;
    if (error) return <Alert variant="danger">{error}</Alert>;

    return (
        <div style={{
            backgroundColor: 'white',
            color: 'black',
            padding: '2rem',
            border: '1px solid #ccc',
            maxHeight: '600px',
            overflowY: 'auto',
            fontFamily: 'Arial, sans-serif'
        }}>
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </div>
    );
};

// Content Renderers
const SecureContentRenderer = ({ decryptedBlob, mimeType }) => {
    const [url, setUrl] = useState(null);
    const [textContent, setTextContent] = useState(null);

    // Handle ZIP files specifically
    if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') {
        return <ZipContentRenderer decryptedBlob={decryptedBlob} />;
    }

    // Handle DOCX files
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return <DocxContentRenderer decryptedBlob={decryptedBlob} />;
    }

    useEffect(() => {
        if (decryptedBlob) {
            // Handle text-based content specifically
            if (mimeType.startsWith('text/') || mimeType.includes('javascript') || mimeType.includes('json')) {
                decryptedBlob.text().then(setTextContent).catch(err => console.error("Failed to read text", err));
            } else {
                const vidUrl = URL.createObjectURL(decryptedBlob);
                setUrl(vidUrl);
                // Intentionally not revoking immediately to keep content visible
                return () => URL.revokeObjectURL(vidUrl);
            }
        }
    }, [decryptedBlob, mimeType]);

    const preventContext = (e) => {
        e.preventDefault();
        return false;
    };

    if (textContent !== null) {
        return (
            <div className="position-relative" onContextMenu={preventContext}>
                <SyntaxHighlighter
                    language={mimeType.includes('javascript') ? 'javascript' : 'text'}
                    style={dracula}
                    customStyle={{
                        maxHeight: '500px',
                        border: '2px solid var(--border-color)',
                        borderRadius: '0',
                        backgroundColor: '#1a1a1a',
                        fontFamily: 'DM Mono, Courier New, monospace',
                        fontSize: '0.85rem',
                        padding: '1.5rem',
                        boxShadow: 'inset 0 0 0 1px var(--border-color)'
                    }}
                    wrapLongLines={true}
                    showLineNumbers={true}
                    lineNumberStyle={{
                        color: '#666',
                        fontFamily: 'DM Mono, Courier New, monospace',
                        borderRight: '1px solid var(--border-color)',
                        paddingRight: '1rem',
                        marginRight: '1rem'
                    }}
                >
                    {textContent}
                </SyntaxHighlighter>
            </div>
        );
    }

    if (!url && !textContent) return <Spinner animation="border" />;

    if (mimeType.startsWith('video/')) {
        return (
            <div style={{
                border: '2px solid var(--border-color)',
                padding: '0.5rem',
                backgroundColor: '#000'
            }} onContextMenu={preventContext}>
                {/* disablePictureInPicture controlsList="nodownload" adds extra browser-level protection */}
                <video
                    controls
                    controlsList="nodownload"
                    disablePictureInPicture
                    src={url}
                    style={{ width: '100%', display: 'block' }}
                />
            </div>
        );
    }

    if (mimeType.startsWith('image/')) {
        return (
            <div style={{
                textAlign: 'center',
                border: '2px solid var(--border-color)',
                padding: '1rem',
                backgroundColor: 'var(--bg-secondary)'
            }} onContextMenu={preventContext}>
                <img
                    src={url}
                    style={{
                        maxWidth: '100%',
                        height: 'auto',
                        border: '1px solid var(--border-color)'
                    }}
                    alt="Protected Content"
                />
            </div>
        );
    }

    if (mimeType === 'application/pdf') {
        return (
            <div style={{
                position: 'relative',
                paddingTop: '75%', // 4:3 aspect ratio
                border: '2px solid var(--border-color)',
                backgroundColor: '#fff'
            }} onContextMenu={preventContext}>
                <iframe
                    src={`${url}#toolbar=0`}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        border: 'none'
                    }}
                    title="Protected PDF"
                />
            </div>
        );
    }

    return (
        <Alert variant="warning" style={{
            border: '2px solid var(--border-color)',
            borderRadius: '0',
            fontFamily: 'DM Mono, Courier New, monospace'
        }}>
            This content type ({mimeType}) cannot be previewed securely in the browser.
            Direct downloads are disabled for security.
        </Alert>
    );
};

const CourseView = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { publicKey, connected } = useWallet();
    const anchorWallet = useAnchorWallet();
    const { connection } = useConnection();
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [decryptedBlob, setDecryptedBlob] = useState(null);
    const [decrypting, setDecrypting] = useState(false);
    const [error, setError] = useState(null);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        init().catch(console.error);
        fetchCourse();
    }, [id]);

    const fetchCourse = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/courses/${id}`);
            setCourse(res.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load course');
            setLoading(false);
        }
    };

    const addLog = (msg) => setLogs(p => [...p, msg]);

    const handlePurchase = async () => {
        if (!connected || !publicKey) {
            alert('Please connect your wallet');
            return;
        }

        if (!course.assetPDA) {
            alert('This course was not registered on the blockchain. Please contact the creator.');
            return;
        }

        try {
            setDecrypting(true);
            setLogs([]); // Clear previous logs
            addLog('Initiating blockchain payment...');

            if (!anchorWallet) {
                throw new Error('Wallet not ready for blockchain operations. Please reconnect your wallet.');
            }

            // Execute real SOL transfer via smart contract
            const { buyAssetOnChainManual } = await import('../utils/solana.ts');
            const { tx } = await buyAssetOnChainManual(
                anchorWallet,
                connection,
                course.assetPDA,
                course.creator
            );

            addLog(`Payment successful! TX: ${tx.slice(0, 8)}...`);

            // Update database after successful blockchain transaction
            await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/courses/${id}/purchase`, {
                buyer: publicKey.toString()
            });

            alert(`Course purchased successfully! ${course.price} SOL transferred to creator.`);
            fetchCourse(); // Refresh to show ownership
        } catch (err) {
            console.error(err);
            // Check if user canceled the transaction
            if (err.message && (err.message.includes('User rejected') || err.message.includes('cancelled') || err.message.includes('canceled'))) {
                addLog('✗ Transaction canceled by user');
                setError('Transaction was canceled');
            } else {
                addLog(`✗ Error: ${err.message || 'Purchase failed'}`);
                setError(err.message || 'Purchase failed');
            }
        } finally {
            setDecrypting(false);
        }
    };

    const handleDecrypt = async () => {
        if (!connected || !publicKey) {
            alert('Please connect your wallet');
            return;
        }

        // Check if user has purchased or is creator
        const userAddress = publicKey.toString();
        const hasPurchased = course.purchasedBy.includes(userAddress) || course.creator === userAddress;

        if (!hasPurchased) {
            alert('You must purchase this course first!');
            return;
        }

        setDecrypting(true);
        setError(null);
        setLogs([]);

        try {
            addLog("Connecting to Lit...");
            await connectLit();

            addLog("Signing auth message...");
            const authSig = await LitJsSdk.checkAndSignAuthMessage({
                chain: "solana",
            });

            addLog("Decrypting Session Key with Lit...");
            const { litEncryptedKey, accessControlConditions } = course;
            const { ciphertext, dataToEncryptHash } = litEncryptedKey;

            const keyHex = await decryptKey(authSig, ciphertext, dataToEncryptHash, accessControlConditions);
            addLog("Session Key Decrypted!");
            console.log("Decrypted Key Hex:", keyHex);

            if (!keyHex || typeof keyHex !== 'string') {
                throw new Error(`Decryption returned invalid key: ${keyHex}`);
            }

            addLog(`Fetching content from Arweave (ID: ${course.arweaveId})...`);
            const arweaveData = await axios.get(`https://gateway.irys.xyz/${course.arweaveId}`, {
                responseType: 'arraybuffer'
            });
            const fileUint8 = new Uint8Array(arweaveData.data);
            addLog(`Content fetched: ${fileUint8.length} bytes`);

            addLog("Decrypting content via WASM enclave...");
            const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

            const decryptedBytes = decrypt_chunk_session_bound(fileUint8, keyBytes);
            const blob = new Blob([decryptedBytes], { type: course.mimeType });

            setDecryptedBlob(blob);
            addLog("Decryption Success!");

        } catch (err) {
            console.error(err);
            setError('Decryption failed: ' + err.message);
            addLog("Error: " + err.message);
        } finally {
            setDecrypting(false);
        }
    };

    if (loading) {
        return (
            <Container className="text-center py-5">
                <Spinner animation="border" />
            </Container>
        );
    }

    if (!course) {
        return (
            <Container className="py-5">
                <Alert variant="danger">Course not found</Alert>
            </Container>
        );
    }

    const isPurchased = connected && publicKey && (
        course.purchasedBy.includes(publicKey.toString()) ||
        course.creator === publicKey.toString()
    );

    return (
        <div className="container-fluid py-4">
            <button className="btn mb-4" onClick={() => navigate(-1)}>
                ← Back
            </button>

            {/* Course Header - 3 Column Layout when logs active */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: (logs.length > 0 || decrypting) ? '350px 1fr 350px' : '350px 1fr',
                gap: '2rem',
                marginBottom: '3rem',
                alignItems: 'start'
            }}>
                {/* Left: Large Course Image */}
                <div>
                    <img
                        src={course.thumbnail || '/default-course.jpg'}
                        alt={course.title}
                        style={{
                            width: '100%',
                            height: 'auto',
                            border: '2px solid var(--border-color)',
                            aspectRatio: '1/1',
                            objectFit: 'cover'
                        }}
                    />
                </div>

                {/* Middle: Course Details */}
                <div>
                    <h1 className="mono-text" style={{
                        fontSize: '1.75rem',
                        marginBottom: '0.5rem',
                        fontWeight: 700
                    }}>
                        {course.title}
                    </h1>
                    <div className="mono-text" style={{
                        fontSize: '0.9rem',
                        opacity: 0.7,
                        marginBottom: '1.5rem'
                    }}>
                        by {course.creator ? `${course.creator.slice(0, 8)}...` : 'Unknown'}
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <div className="mono-text" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                            <strong>Price:</strong> {course.price} SOL
                        </div>
                        <div className="mono-text" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                            <strong>Category:</strong> {course.category}
                        </div>
                        <div className="mono-text" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                            <strong>Created:</strong> {new Date(course.createdAt).toLocaleDateString()}
                        </div>
                        <div className="mono-text" style={{ fontSize: '0.85rem' }}>
                            <strong>Type:</strong> {course.mimeType}
                        </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <div className="mono-text" style={{
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            marginBottom: '0.5rem'
                        }}>
                            Description
                        </div>
                        <p className="mono-text" style={{
                            fontSize: '0.85rem',
                            lineHeight: '1.6',
                            opacity: 0.9
                        }}>
                            {course.description || 'No description provided'}
                        </p>
                    </div>
                </div>

                {/* Right: Process Status - Only shows when active */}
                {(logs.length > 0 || decrypting) && (
                    <div className="card" style={{ position: 'sticky', top: '20px' }}>
                        <div style={{
                            padding: '1rem',
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-secondary)'
                        }}>
                            <h6 className="mono-text" style={{ margin: 0, fontSize: '0.9rem' }}>
                                Process Status
                            </h6>
                        </div>
                        <div style={{
                            padding: '1rem',
                            maxHeight: '400px',
                            minHeight: '150px',
                            overflowY: 'auto',
                            backgroundColor: 'var(--bg-primary)'
                        }}>
                            {logs.map((l, i) => (
                                <div key={i} className="mono-text" style={{
                                    fontSize: '0.75rem',
                                    opacity: 0.7,
                                    marginBottom: '0.25rem'
                                }}>
                                    {l}
                                </div>
                            ))}
                            {decrypting && (
                                <div className="mono-text" style={{
                                    fontSize: '0.75rem',
                                    opacity: 0.5,
                                    fontStyle: 'italic'
                                }}>
                                    Processing...
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Actions Below - Spans columns 2 & 3 */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: (logs.length > 0 || decrypting) ? '350px 1fr 350px' : '350px 1fr',
                gap: '2rem',
                marginBottom: '3rem'
            }}>
                <div></div> {/* Empty space for image column */}

                {/* Action buttons - spans remaining columns */}
                <div style={{ gridColumn: (logs.length > 0 || decrypting) ? 'span 2' : 'span 1' }}>
                    {!connected ? (
                        <div className="alert" style={{ padding: '1rem' }}>
                            <span className="mono-text">Connect wallet to access</span>
                        </div>
                    ) : isPurchased ? (
                        <div>
                            <div className="alert alert-success" style={{ padding: '1rem', marginBottom: '1rem' }}>
                                <span className="mono-text">✓ You own this course</span>
                            </div>
                            <button
                                className="btn btn-primary"
                                onClick={handleDecrypt}
                                disabled={decrypting}
                                style={{ width: '100%' }}
                            >
                                {decrypting ? 'Decrypting...' : 'Unlock & View Content'}
                            </button>
                        </div>
                    ) : (
                        <button
                            className="btn btn-primary"
                            onClick={handlePurchase}
                            disabled={decrypting}
                            style={{ width: '100%' }}
                        >
                            Buy Course - {course.price} SOL
                        </button>
                    )}

                    {/* Error Display */}
                    {error && (
                        <div className="alert alert-danger" style={{ marginTop: '1.5rem' }}>
                            <span className="mono-text" style={{ fontSize: '0.85rem' }}>{error}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Horizontal Divider */}
            <div className="retro-divider" style={{ marginBottom: '2rem' }}></div>

            {/* Course Content Section - Full Width Below */}
            <div style={{ marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '0', border: '2px solid var(--border-color)' }}>
                    {/* Header */}
                    <div style={{
                        padding: '1rem',
                        borderBottom: '2px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)'
                    }}>
                        <h2 className="mono-text" style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            margin: 0
                        }}>
                            Course Content
                        </h2>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '1.5rem' }}>
                        {decryptedBlob ? (
                            <SecureContentRenderer
                                decryptedBlob={decryptedBlob}
                                mimeType={course.mimeType}
                            />
                        ) : (
                            <div style={{
                                textAlign: 'center',
                                padding: '3rem',
                                border: '1px dashed var(--border-color)',
                                backgroundColor: 'var(--bg-primary)'
                            }}>
                                <div className="mono-text" style={{ opacity: 0.6, fontSize: '0.9rem' }}>
                                    {isPurchased
                                        ? '↑ Click "Unlock & View Content" to access the course material'
                                        : '⚠ Purchase this course to access the content'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Responsive: Stack on mobile */}
            <style>{`
                @media (max-width: 768px) {
                    .container-fluid > div[style*="grid"] {
                        grid-template-columns: 1fr !important;
                        gap: 1rem !important;
                    }
                    .container-fluid > div[style*="grid"] > div[style*="gridColumn"] {
                        grid-column: span 1 !important;
                    }
                    .container-fluid button[style*="width: 100%"] {
                        width: 100% !important;
                        padding: 0.75rem !important;
                        font-size: 0.9rem !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default CourseView;
