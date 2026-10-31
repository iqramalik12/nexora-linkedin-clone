import { Router } from 'express';
import Notification from '../models/Notification.js';
import { PUBLIC_FIELDS } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { ah, HttpError, validId } from '../middleware/errors.js';
import { brief } from '../lib.js';

const router = Router();
router.use(requireAuth);

const shape = (n) => ({
  id: n._id.toString(),
  type: n.type,
  actor: brief(n.actor),
  post: n.post ? { id: n.post._id.toString(), text: (n.post.text || '').slice(0, 140) } : null,
  job: n.job ? { id: n.job._id.toString(), title: n.job.title } : null,
  read: Boolean(n.readAt),
  createdAt: n.createdAt,
});

router.get('/', ah(async (req, res) => {
  const list = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100)
    .populate('actor', PUBLIC_FIELDS).populate('post', 'text').populate('job', 'title');
  // Drop notifications whose person was deleted.
  res.json({ notifications: list.filter((n) => n.actor).map(shape) });
}));

router.get('/unread', ah(async (req, res) => {
  res.json({ unread: await Notification.countDocuments({ user: req.user._id, readAt: null }) });
}));

router.post('/read-all', ah(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.status(204).end();
}));

router.post('/:id/read', ah(async (req, res) => {
  const r = await Notification.updateOne({ _id: validId(req.params.id), user: req.user._id }, { $set: { readAt: new Date() } });
  if (!r.matchedCount) throw new HttpError(404, 'Notification not found.');
  res.status(204).end();
}));

router.delete('/:id', ah(async (req, res) => {
  const r = await Notification.deleteOne({ _id: validId(req.params.id), user: req.user._id });
  if (!r.deletedCount) throw new HttpError(404, 'Notification not found.');
  res.status(204).end();
}));

export default router;
