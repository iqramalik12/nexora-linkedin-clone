import mongoose from 'mongoose';
import { imageUrl } from './Image.js';

const experienceSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, maxlength: 100, required: true },
    company: { type: String, trim: true, maxlength: 100, required: true },
    start: { type: String, trim: true, maxlength: 20 },
    end: { type: String, trim: true, maxlength: 20 },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    headline: { type: String, trim: true, maxlength: 160, default: '' },
    location: { type: String, trim: true, maxlength: 100, default: '' },
    about: { type: String, trim: true, maxlength: 2000, default: '' },
    avatarColor: { type: String, default: '#7a4fa8' },
    avatar: { type: mongoose.Schema.Types.ObjectId, ref: 'Image', default: null },
    cover: { type: mongoose.Schema.Types.ObjectId, ref: 'Image', default: null },
    savedPosts: { type: [mongoose.Schema.Types.ObjectId], ref: 'Post', default: [], select: false },
    savedJobs: { type: [mongoose.Schema.Types.ObjectId], ref: 'Job', default: [], select: false },
    skills: { type: [String], default: [] },
    experience: { type: [experienceSchema], default: [] },
    profileViews: { type: Number, default: 0 },
    // Bumped by "sign out everywhere" so every older session token stops working.
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    headline: this.headline,
    location: this.location,
    about: this.about,
    avatarColor: this.avatarColor,
    avatarUrl: imageUrl(this.avatar),
    coverUrl: imageUrl(this.cover),
    skills: this.skills,
    experience: this.experience.map((e) => ({ id: e._id.toString(), title: e.title, company: e.company, start: e.start, end: e.end })),
    createdAt: this.createdAt,
  };
};

export const PUBLIC_FIELDS = 'name headline location avatarColor avatar';
export default mongoose.model('User', userSchema);
