import { Router } from 'express';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Connection from '../models/Connection.js';
import Message from '../models/Message.js';
import bcrypt from 'bcryptjs';
import { COOKIE } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { ah, HttpError, text, validId } from '../middleware/errors.js';
import Image from '../models/Image.js';
import Job from '../models/Job.js';
import Notification from '../models/Notification.js';
import { brief, connectedIds, relationship } from '../lib.js';
import { ownImage } from './images.js';

const router = Router();
router.use(requireAuth);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Search people by name or headline.
router.get('/', ah(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
  if (!q) return res.json({ users: [] });
  const rx = new RegExp(escapeRegex(q), 'i');
  const users = await User.find({ $or: [{ name: rx }, { headline: rx }] }).limit(20);
  res.json({ users: users.map(brief) });
}));

// People you may know: not you, not already connected or invited.
router.get('/suggestions', ah(async (req, res) => {
  const me = req.user._id;
  const links = await Connection.find({ $or: [{ requester: me }, { recipient: me }] });
  const exclude = new Set([me.toString()]);
  links.forEach((c) => { exclude.add(c.requester.toString()); exclude.add(c.recipient.toString()); });
  const limit = Math.min(Number(req.query.limit) || 6, 30);
  const users = (await User.find().sort({ createdAt: -1 }).limit(200))
    .filter((u) => !exclude.has(u._id.toString()))
    .slice(0, limit);
  res.json({ users: users.map(brief) });
}));

router.get('/me/stats', ah(async (req, res) => {
  const me = req.user._id;
  const [connections, posts, engagement] = await Promise.all([
    connectedIds(me),
    Post.countDocuments({ author: me }),
    Post.aggregate([{ $match: { author: me } }, { $group: { _id: null, likes: { $sum: { $size: '$likes' } }, comments: { $sum: { $size: '$comments' } } } }]),
  ]);
  const e = engagement[0] || { likes: 0, comments: 0 };
  res.json({ connections: connections.length, posts, profileViews: req.user.profileViews, reactions: e.likes + e.comments });
}));

router.put('/me', ah(async (req, res) => {
  const u = req.user;
  const b = req.body || {};
  if ('name' in b) u.name = text(b.name, 'Name', 80);
  if ('headline' in b) u.headline = text(b.headline, 'Headline', 160, { required: false });
  if ('location' in b) u.location = text(b.location, 'Location', 100, { required: false });
  if ('about' in b) u.about = text(b.about, 'About', 2000, { required: false });
  if ('skills' in b) {
    if (!Array.isArray(b.skills)) throw new HttpError(400, 'Skills must be a list.');
    u.skills = [...new Set(b.skills.map((s) => text(s, 'Skill', 40)))].slice(0, 30);
  }
  // Profile and cover photos: an id from POST /api/images, or null to remove.
  for (const key of ['avatar', 'cover']) {
    if (!(key in b)) continue;
    const next = await ownImage(b[key], u._id);
    const prev = u[key];
    u[key] = next;
    if (prev && !prev.equals(next)) await Image.deleteOne({ _id: prev, owner: u._id });
  }
  if ('experience' in b) {
    if (!Array.isArray(b.experience)) throw new HttpError(400, 'Experience must be a list.');
    u.experience = b.experience.slice(0, 20).map((e) => ({
      title: text(e?.title, 'Job title', 100),
      company: text(e?.company, 'Company', 100),
      start: text(e?.start, 'Start date', 20, { required: false }),
      end: text(e?.end, 'End date', 20, { required: false }),
    }));
  }
  await u.save();
  res.json({ user: u.toPublic() });
}));

// Deletes the account and everything it created: posts, comments, likes, connections, messages.
router.delete('/me', ah(async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(400, 'Enter your password to delete your account.');
  const me = user._id;
  // Strip likes and comments in code rather than with $pull conditions, so this
  // works the same on MongoDB and MongoDB-compatible servers.
  const touched = await Post.find({ $or: [{ likes: me }, { 'comments.author': me }] });
  for (const p of touched) {
    p.likes = p.likes.filter((id) => !id.equals(me));
    p.comments = p.comments.filter((c) => !c.author.equals(me));
    await p.save();
  }
  const applied = await Job.find({ 'applications.user': me });
  for (const j of applied) {
    j.applications = j.applications.filter((a) => !a.user.equals(me));
    await j.save();
  }
  const ownPosts = await Post.find({ author: me }).select('_id');
  await Promise.all([
    Post.deleteMany({ repostOf: { $in: ownPosts.map((p) => p._id) }, text: '' }),
    Job.deleteMany({ poster: me }),
    Image.deleteMany({ owner: me }),
    Notification.deleteMany({ $or: [{ user: me }, { actor: me }, { post: { $in: ownPosts.map((p) => p._id) } }] }),
  ]);
  await Promise.all([
    Post.deleteMany({ author: me }),
    Connection.deleteMany({ $or: [{ requester: me }, { recipient: me }] }),
    Message.deleteMany({ $or: [{ from: me }, { to: me }] }),
  ]);
  await User.deleteOne({ _id: me });
  res.clearCookie(COOKIE);
  res.status(204).end();
}));

router.get('/:id', ah(async (req, res) => {
  const user = await User.findById(validId(req.params.id));
  if (!user) throw new HttpError(404, 'This profile does not exist.');
  const rel = await relationship(req.user._id, user._id);
  if (rel.status !== 'self') await User.updateOne({ _id: user._id }, { $inc: { profileViews: 1 } });
  const [connections, postCount] = await Promise.all([connectedIds(user._id), Post.countDocuments({ author: user._id })]);
  res.json({ user: user.toPublic(), relationship: rel, connectionCount: connections.length, postCount });
}));

export default router;
