import mongoose from 'mongoose';

// Uploaded photos (profile photos, cover photos, post images), stored as bytes in MongoDB.
// Served from /api/images/:id. Fine for small deployments; move to a bucket (S3, R2) at scale.
const imageSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

export const imageUrl = (id) => (id ? `/api/images/${id.toString()}` : null);
export default mongoose.model('Image', imageSchema);
