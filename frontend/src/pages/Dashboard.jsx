import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const getDefaultThumbnail = () => '/default-course.jpg';

const Dashboard = () => {
    const { publicKey, connected } = useWallet();
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [filteredCourses, setFilteredCourses] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const categories = ['All', 'Development', 'Design', 'Business', 'Marketing', 'General'];

    useEffect(() => {
        fetchAllCourses();
    }, []);

    useEffect(() => {
        filterCourses();
    }, [selectedCategory, searchQuery, courses]);

    const fetchAllCourses = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/courses`);
            setCourses(res.data || []);
            setFilteredCourses(res.data || []);
        } catch (err) {
            console.error('Error fetching courses:', err);
            setCourses([]);
            setFilteredCourses([]);
        } finally {
            setLoading(false);
        }
    };

    const filterCourses = () => {
        let filtered = courses;

        if (selectedCategory !== 'All') {
            filtered = filtered.filter(course => course.category === selectedCategory);
        }

        if (searchQuery) {
            filtered = filtered.filter(course =>
                (course.title && course.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (course.description && course.description.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        setFilteredCourses(filtered);
    };

    const renderCourseCard = (course, index) => (
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
                    {course.description ? (course.description.length > 50 ? `${course.description.slice(0, 50)}...` : course.description) : 'No description'}
                </div>
                <div className="course-card-meta" style={{ marginTop: '0.5rem' }}>
                    {course.price || 0} SOL
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', paddingBottom: '4rem' }}>
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

            {/* Main Content */}
            <div className="container-fluid">
                {/* All Courses Header with underline */}
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: '1.5rem',
                        marginBottom: '0.5rem',
                        borderBottom: '1px solid var(--border-color)',
                        paddingBottom: '0.5rem',
                        display: 'inline-block',
                        minWidth: '200px'
                    }}>
                        All Courses
                    </h3>
                </div>

                {/* Category Filters + Search/Sort Controls - All in one line */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '2rem',
                    marginBottom: '2rem',
                    flexWrap: 'wrap'
                }}>
                    {/* Category Filters */}
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        flex: '1 1 auto'
                    }}>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`category-filter ${selectedCategory === cat ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Search and Sort */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        flexWrap: 'nowrap',
                        flex: '0 1 auto',
                        minWidth: '250px'
                    }}>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search courses..."
                            style={{
                                width: '250px',
                                borderRadius: '0',
                                border: '1px solid var(--border-color)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.9rem'
                            }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button
                            className="btn"
                            style={{
                                minWidth: '100px',
                                borderRadius: '0',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.9rem',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Sort ↓
                        </button>
                    </div>
                </div>

                {/* Course Grid */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <div className="mono-text">Loading courses...</div>
                    </div>
                ) : filteredCourses.length > 0 ? (
                    <div className="course-grid">
                        {filteredCourses.map((course, index) => renderCourseCard(course, index))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '4rem' }}>
                        <div className="mono-text">No courses found</div>
                        {connected && (
                            <button
                                className="btn btn-primary"
                                style={{ marginTop: '1rem' }}
                                onClick={() => navigate('/upload')}
                            >
                                Upload First Course
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
