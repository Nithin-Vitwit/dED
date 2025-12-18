import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Button, Form, InputGroup } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const getDefaultThumbnail = () => '/default-course.jpg';

const Marketplace = () => {
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [filteredCourses, setFilteredCourses] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCourses();
    }, []);

    useEffect(() => {
        filterCourses();
    }, [searchTerm, selectedCategory, courses]);

    const fetchCourses = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/courses`);
            setCourses(res.data);
        } catch (err) {
            console.error('Error fetching courses:', err);
        } finally {
            setLoading(false);
        }
    };

    const filterCourses = () => {
        let filtered = courses;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(course =>
                (course.title && course.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (course.description && course.description.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        // Filter by category
        if (selectedCategory !== 'All') {
            filtered = filtered.filter(course => course.category === selectedCategory);
        }

        setFilteredCourses(filtered);
    };

    const categories = ['All', 'Development', 'Design', 'Business', 'Marketing', 'General'];

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

            <Container className="py-4">
                <h2 className="mb-4" style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '1.5rem'
                }}>
                    Course Marketplace
                </h2>

                {/* Search and Filter Bar */}
                <Row className="mb-4">
                    <Col md={8}>
                        <InputGroup>
                            <Form.Control
                                placeholder="Search courses..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    borderRadius: '0',
                                    border: '1px solid var(--border-color)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.9rem',
                                    backgroundColor: 'var(--bg-primary)',
                                    color: 'var(--text-primary)'
                                }}
                                onFocus={(e) => e.target.style.boxShadow = 'none'}
                                onBlur={(e) => e.target.style.boxShadow = 'none'}
                            />
                        </InputGroup>
                    </Col>
                    <Col md={4}>
                        <Form.Select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            style={{
                                borderRadius: '0',
                                border: '1px solid var(--border-color)',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.9rem',
                                backgroundColor: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                            onFocus={(e) => e.target.style.boxShadow = 'none'}
                            onBlur={(e) => e.target.style.boxShadow = 'none'}
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </Form.Select>
                    </Col>
                </Row>

                {/* Course Grid */}
                <Row>
                    {loading ? (
                        <div className="text-center py-5">Loading courses...</div>
                    ) : filteredCourses.length > 0 ? (
                        filteredCourses.map(course => (
                            <Col key={course._id} md={3} className="mb-4">
                                <Card className="h-100 course-card" style={{
                                    border: '2px solid var(--border-color)',
                                    borderRadius: '0',
                                    boxShadow: 'none'
                                }}>
                                    <div style={{
                                        height: '400px',
                                        backgroundColor: '#e9ecef',
                                        overflow: 'hidden',
                                        borderBottom: '2px solid var(--border-color)'
                                    }}>
                                        <Card.Img
                                            variant="top"
                                            src={course.thumbnail || getDefaultThumbnail()}
                                            style={{ height: '400px', width: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    <Card.Body>
                                        <Card.Title
                                            className="text-truncate"
                                            style={{
                                                fontFamily: 'var(--font-mono)',
                                                fontWeight: 700,
                                                fontSize: '1rem'
                                            }}
                                        >
                                            {course.title}
                                        </Card.Title>
                                        <Card.Text
                                            className="small"
                                            style={{
                                                height: '60px',
                                                overflow: 'hidden',
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: '0.85rem',
                                                opacity: 0.7
                                            }}
                                        >
                                            {course.description || 'No description'}
                                        </Card.Text>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <Badge
                                                bg="secondary"
                                                style={{
                                                    borderRadius: '0',
                                                    border: '1px solid var(--border-color)',
                                                    fontFamily: 'var(--font-mono)',
                                                    fontSize: '0.75rem',
                                                    padding: '0.25rem 0.5rem'
                                                }}
                                            >
                                                {course.category}
                                            </Badge>
                                            <strong style={{
                                                fontFamily: 'var(--font-mono)',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.9rem'
                                            }}>
                                                {course.price} SOL
                                            </strong>
                                        </div>
                                        <div className="d-grid">
                                            <Button
                                                variant="primary"
                                                onClick={() => navigate(`/course/${course._id}`)}
                                                style={{
                                                    borderRadius: '0',
                                                    fontFamily: 'var(--font-mono)',
                                                    fontWeight: 600,
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                View Course
                                            </Button>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        ))
                    ) : (
                        <div className="text-center py-5">No courses found</div>
                    )}
                </Row>
            </Container>
        </div>
    );
};

export default Marketplace;
