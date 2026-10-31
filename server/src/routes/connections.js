import { Router } from 'express';
import Connection from '../models/Connection.js';
import User, { PUBLIC_FIELDS } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { ah, HttpError, validId } from '../middleware/errors.js';
import Notification from '../models/Notification.js';
import { brief, notify, relationship } from '../lib.js';

const router = Router();
router.use(requireAuth);

const other = (c, me) => (c.requester._id.toString() === me.toString() ? c.recipient : c.requester);

// Accepted connections.
router.get('/', ah(async (req, res) => {
  const me = req.user._id;
  const list = await Connection.find({ status: 'accepted', $or: [{ requester: me }, { recipient: me }] })
    .populate('requester', PUBLIC_FIELDS).populate('recipient', PUBLIC_FIELDS).sort({ updatedAt: -1 });
  res.json({ connections: list.map((c) => ({ id: c._id.toString(), user: brief(other(c, me)), since: c.updatedAt })) });
}));

// Pending invitations, both directions.
router.get('/invitations', ah(async (req, res) => {
  const me = req.user._id;
  const [received, sent] = await Promise.all([
    Connection.find({ recipient: me, status: 'pending' }).populate('requester', PUBLIC_FIELDS).sort({ createdAt: -1 }),
    Connection.find({ requester: me, status: 'pending' }).populate('recipient', PUBLIC_FIELDS).sort({ createdAt: -1 }),
  ]);
  res.json({
    received: received.map((c) => ({ id: c._id.toString(), user: brief(c.requester), createdAt: c.createdAt })),
    sent: sent.map((c) => ({ id: c._id.toString(), user: brief(c.recipient), createdAt: c.createdAt })),
  });
}));

// Send an invitation to a person. If they already invited you, this accepts it.
router.post('/request/:userId', ah(async (req, res) => {
  const me = req.user._id;
  const target = await User.findById(validId(req.params.userId));
  if (!target) throw new HttpError(404, 'This person does not exist.');
  const rel = await relationship(me, target._id);
  if (rel.status === 'self') throw new HttpError(400, 'You cannot connect with yourself.');
  if (rel.status === 'connected' || rel.status === 'sent') return res.json({ relationship: rel });
  if (rel.status === 'received') {
    await Connection.updateOne({ _id: rel.connectionId }, { status: 'accepted' });
    await Notification.deleteMany({ user: me, actor: target._id, type: 'invite' });
    await notify(target._id, me, 'accept');
  } else {
    await Connection.create({ requester: me, recipient: target._id });
    await notify(target._id, me, 'invite');
  }
  res.status(201).json({ relationship: await relationship(me, target._id) });
}));

router.post('/:id/accept', ah(async (req, res) => {
  const c = await Connection.findById(validId(req.params.id));
  if (!c || c.recipient.toString() !== req.user._id.toString() || c.status !== 'pending') {
    throw new HttpError(404, 'This invitation is no longer available.');
  }
  c.status = 'accepted';
  await c.save();
  await Notification.deleteMany({ user: req.user._id, actor: c.requester, type: 'invite' });
  await notify(c.requester, req.user._id, 'accept');
  res.json({ relationship: await relationship(req.user._id, c.requester) });
}));

// Decline a received invite, withdraw a sent one, or remove a connection.
router.delete('/:id', ah(async (req, res) => {
  const me = req.user._id.toString();
  const c = await Connection.findById(validId(req.params.id));
  if (!c || (c.requester.toString() !== me && c.recipient.toString() !== me)) {
    throw new HttpError(404, 'This connection no longer exists.');
  }
  await c.deleteOne();
  if (c.status === 'pending') await Notification.deleteMany({ user: c.recipient, actor: c.requester, type: 'invite' });
  res.status(204).end();
}));

export default router;
