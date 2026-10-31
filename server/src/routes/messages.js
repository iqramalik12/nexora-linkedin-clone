import { Router } from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { ah, HttpError, text, validId } from '../middleware/errors.js';
import { brief, relationship } from '../lib.js';
import { openStream, publish } from '../live.js';
import { maybeDemoReply } from '../demoReplies.js';

const router = Router();
router.use(requireAuth);

const shape = (m) => ({ id: m._id.toString(), from: m.from.toString(), to: m.to.toString(), text: m.text, createdAt: m.createdAt, readAt: m.readAt });

// Conversation list: latest message per person plus unread count.
router.get('/', ah(async (req, res) => {
  const me = req.user._id.toString();
  const msgs = await Message.find({ $or: [{ from: me }, { to: me }] }).sort({ createdAt: -1 }).limit(1000);
  const byPerson = new Map();
  for (const m of msgs) {
    const other = m.from.toString() === me ? m.to.toString() : m.from.toString();
    if (!byPerson.has(other)) byPerson.set(other, { last: m, unread: 0 });
    if (m.to.toString() === me && !m.readAt) byPerson.get(other).unread += 1;
  }
  const users = await User.find({ _id: { $in: [...byPerson.keys()] } });
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  const conversations = [...byPerson.entries()]
    .filter(([id]) => userMap.has(id))
    .map(([id, v]) => ({ user: brief(userMap.get(id)), last: shape(v.last), unread: v.unread }));
  res.json({ conversations });
}));

// Live stream of new messages for the signed-in person (Server-Sent Events).
router.get('/stream', openStream);

router.get('/unread', ah(async (req, res) => {
  res.json({ unread: await Message.countDocuments({ to: req.user._id, readAt: null }) });
}));

// Thread with one person. Marks their messages to you as read.
router.get('/:userId', ah(async (req, res) => {
  const me = req.user._id;
  const other = await User.findById(validId(req.params.userId));
  if (!other) throw new HttpError(404, 'This person does not exist.');
  // Newest 500, shown oldest first.
  const msgs = (await Message.find({
    $or: [{ from: me, to: other._id }, { from: other._id, to: me }],
  }).sort({ createdAt: -1, _id: -1 }).limit(500)).reverse();
  const read = await Message.updateMany({ from: other._id, to: me, readAt: null }, { $set: { readAt: new Date() } });
  if (read.modifiedCount) publish(me, 'read', { userId: other._id.toString() });
  const rel = await relationship(me, other._id);
  res.json({ user: brief(other), canMessage: rel.status === 'connected', messages: msgs.map(shape) });
}));

router.post('/:userId', ah(async (req, res) => {
  const me = req.user._id;
  const other = await User.findById(validId(req.params.userId));
  if (!other) throw new HttpError(404, 'This person does not exist.');
  const rel = await relationship(me, other._id);
  if (rel.status !== 'connected') throw new HttpError(403, `Connect with ${other.name} before sending a message.`);
  const m = await Message.create({ from: me, to: other._id, text: text(req.body.text, 'Message', 2000) });
  publish(other._id, 'message', shape(m));
  publish(me, 'message', shape(m)); // your other open tabs
  maybeDemoReply(req.user, other, shape);
  res.status(201).json({ message: shape(m) });
}));

export default router;
