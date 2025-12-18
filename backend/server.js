const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const Asset = require('./models/Asset');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/deed';

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for encrypted course data
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

// Configure Multer for Thumbnail Uploads
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Root Endpoint for Health Check
app.get('/', (req, res) => {
    res.send('dED Backend is running! 🚀');
});

// Temporary Thumbnail Upload Endpoint (Returns Base64 to save storage cost)
app.post('/api/upload-thumbnail', upload.single('thumbnail'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No file uploaded' });
        }
        // Convert buffer to base64
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const mimeType = req.file.mimetype;
        const dataURI = `data:${mimeType};base64,${b64}`;

        // Return as "url" so frontend logic works
        res.json({ url: dataURI });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// Routes
// 1. Register Asset (Course)
app.post('/api/assets', async (req, res) => {
    try {
        const {
            originalName, mimeType, isVideo, arweaveId,
            litEncryptedKey, accessControlConditions,
            title, description, price, creator, thumbnail, category,
            assetPDA
        } = req.body;

        // Check if asset already exists
        let asset = await Asset.findOne({ arweaveId });
        if (asset) {
            return res.status(400).json({ msg: 'Asset already exists' });
        }

        asset = new Asset({
            originalName,
            mimeType,
            isVideo,
            arweaveId,
            litEncryptedKey,
            accessControlConditions,
            title: title || originalName,
            description: description || '',
            price: price || 0,
            creator: creator || '',
            assetPDA: assetPDA || '',
            thumbnail: thumbnail || '',
            category: category || 'General',
        });

        await asset.save();
        res.status(201).json(asset);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 2. Get All Courses (Marketplace)
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await Asset.find().sort({ createdAt: -1 });
        res.json(courses);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 3. Get My Courses (Created by user)
app.get('/api/courses/my-courses', async (req, res) => {
    try {
        const { creator } = req.query;
        if (!creator) {
            return res.status(400).json({ msg: 'Creator address required' });
        }
        const courses = await Asset.find({ creator }).sort({ createdAt: -1 });
        res.json(courses);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 4. Get Purchased Courses
app.get('/api/courses/purchased', async (req, res) => {
    try {
        const { buyer } = req.query;
        if (!buyer) {
            return res.status(400).json({ msg: 'Buyer address required' });
        }
        const courses = await Asset.find({ purchasedBy: buyer }).sort({ createdAt: -1 });
        res.json(courses);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 5. Get Single Course
app.get('/api/courses/:id', async (req, res) => {
    try {
        const course = await Asset.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ msg: 'Course not found' });
        }
        res.json(course);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 6. Purchase Course
app.post('/api/courses/:id/purchase', async (req, res) => {
    try {
        const { buyer } = req.body;
        if (!buyer) {
            return res.status(400).json({ msg: 'Buyer address required' });
        }

        const course = await Asset.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ msg: 'Course not found' });
        }

        // Check if already purchased
        if (course.purchasedBy.includes(buyer)) {
            return res.status(400).json({ msg: 'Already purchased' });
        }

        course.purchasedBy.push(buyer);
        await course.save();
        res.json(course);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Legacy endpoint for compatibility
app.get('/api/assets', async (req, res) => {
    try {
        const assets = await Asset.find().sort({ createdAt: -1 });
        res.json(assets);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server started on port ${PORT}`));
