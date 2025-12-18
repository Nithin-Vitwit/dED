const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema({
    // Basic file info
    originalName: {
        type: String,
        required: true,
    },
    mimeType: {
        type: String,
        required: true,
    },
    isVideo: {
        type: Boolean,
        default: false,
    },

    // Storage
    arweaveId: {
        type: String,
        required: true,
        unique: true,
    },

    // Encryption
    accessControlConditions: {
        type: mongoose.Schema.Types.Mixed,
        required: false,
    },
    litEncryptedKey: {
        type: Object,
        required: false,
    },

    // Course Metadata
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: '',
    },
    price: {
        type: Number,
        required: true,
        default: 0,
    },
    creator: {
        type: String,
        required: true,
    },
    assetPDA: {
        type: String,
        default: '',
    },
    thumbnail: {
        type: String,
        default: '',
    },
    category: {
        type: String,
        default: 'General',
    },
    purchasedBy: {
        type: [String],
        default: [],
    },

    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Asset', AssetSchema);
