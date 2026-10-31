import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1250 },
  },
  { timestamps: true }
);

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Text is optional when the post has an image or reposts another post.
    text: { type: String, trim: true, maxlength: 3000, default: '' },
    image: { type: mongoose.Schema.Types.ObjectId, ref: 'Image', default: null },
    repostOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null, index: true },
    likes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    comments: { type: [commentSchema], default: [] },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });

export default mongoose.model('Post', postSchema);
