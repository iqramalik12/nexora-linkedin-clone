import mongoose from 'mongoose';

// Something that happened to `user` because of `actor`.
export const TYPES = ['like', 'comment', 'repost', 'invite', 'accept', 'apply'];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
