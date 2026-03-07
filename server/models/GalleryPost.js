const mongoose = require('mongoose');

const galleryPostSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  imageUrl: { type: String, required: true },
  caption: { type: String, default: '' },
  authorName: { type: String, default: 'Anonymous' },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  approved: { type: Boolean, default: true },
  tags: [{ type: String }],
}, { timestamps: true });

galleryPostSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('GalleryPost', galleryPostSchema);
