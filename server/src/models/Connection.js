import mongoose from 'mongoose';

// One document per pair of people. `requester` sent the invite to `recipient`.
const connectionSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
  },
  { timestamps: true }
);

connectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });

export default mongoose.model('Connection', connectionSchema);
