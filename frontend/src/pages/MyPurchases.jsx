import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const getDefaultThumbnail = () => '/default-course.jpg';

const MyPurchases = () => {
    const { publicKey, connected } = useWallet();
    const navigate = useNavigate();
    const [purchasedCourses, setPurchasedCourses] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (connected && publicKey) {
            fetchPurchasedCourses();
        }
    }, [connected, publicKey]);

    const fetchPurchasedCourses = async () => {
        if (!publicKey) return;
        try {
            setLoading(true);
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/courses/purchased?buyer=${publicKey.toString()}`);
            setPurchasedCourses(res.data || []);
        } catch (err) {
            console.error('Error fetching purchased courses:', err);
            setPurchasedCourses([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {/* Hero Section */}
            <div style={{
                textAlign: 'center',
                padding: '2.5rem 2rem',
                marginBottom: '1.5rem'
            }}>
                <img
                    src="/permaded-title.png"
                    alt="PERMAdED"
                    className="hero-title-image"
                />
                <div className="login-tagline" style={{ marginTop: '1rem' }}>
                    A decentralized education platform on Solana Network
                </div>
            </div>

            {/* Horizontal Divider */}
            <div className="retro-divider"></div>

            <div className="container-fluid py-4">
                <h2 style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    marginBottom: '1rem',
                    borderBottom: '2px solid var(--border-color)',
                    paddingBottom: '1rem',
                    display: 'inline-block'
                }}>
                    My Purchases
                </h2>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <div className="mono-text">Loading your purchases...</div>
                    </div>
                ) : purchasedCourses.length > 0 ? (
                    <div className="course-grid" style={{ marginTop: '2rem' }}>
                        {purchasedCourses.map((course, index) => (
                            <div
                                key={course._id}
                                className="course-card"
                                onClick={() => navigate(`/course/${course._id}`)}
                            >
                                <img
                                    src={course.thumbnail || getDefaultThumbnail()}
                                    alt={course.title}
                                    className="course-card-image"
                                />
                                <div className="course-card-body">
                                    <div className="course-card-title">{course.title || 'Untitled'}</div>
                                    <div className="course-card-meta">
                                        {course.creator ? `${course.creator.slice(0, 8)}...` : 'Unknown'}
                                    </div>
                                    <div className="course-card-meta" style={{ marginTop: '0.5rem' }}>
                                        {course.price || 0} SOL
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <div className="mono-text" style={{ marginBottom: '1rem' }}>
                            You haven't purchased any courses yet
                        </div>
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate('/marketplace')}
                        >
                            Browse Marketplace
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyPurchases;
