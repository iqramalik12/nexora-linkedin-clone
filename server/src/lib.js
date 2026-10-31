import Connection from './models/Connection.js';
import Notification from './models/Notification.js';
import { imageUrl } from './models/Image.js';
import { publish } from './live.js';

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

export function brief(u) {
  if (!u) return null;
  return { id: u._id.toString(), name: u.name, headline: u.headline, location: u.location, avatarColor: u.avatarColor, avatarUrl: imageUrl(u.avatar) };
}

// Relationship of `me` to `otherId`: self | none | sent | received | connected
export async function relationship(meId, otherId) {
  if (meId.toString() === otherId.toString()) return { status: 'self' };
  const c = await Connection.findOne({
    $or: [
      { requester: meId, recipient: otherId },
      { requester: otherId, recipient: meId },
    ],
  });
  if (!c) return { status: 'none' };
  if (c.status === 'accepted') return { status: 'connected', connectionId: c._id.toString() };
  return { status: c.requester.toString() === meId.toString() ? 'sent' : 'received', connectionId: c._id.toString() };
}

export async function connectedIds(meId) {
  const list = await Connection.find({ status: 'accepted', $or: [{ requester: meId }, { recipient: meId }] });
  return list.map((c) => (c.requester.toString() === meId.toString() ? c.recipient : c.requester).toString());
}

// Records a notification for `userId` and pings their open tabs. Never notifies you about yourself.
export async function notify(userId, actorId, type, extra = {}) {
  if (userId.toString() === actorId.toString()) return;
  await Notification.create({ user: userId, actor: actorId, type, ...extra });
  publish(userId, 'notification', { type });
}

// Removes a notification again, e.g. when a like is taken back.
export async function unnotify(userId, actorId, type, extra = {}) {
  await Notification.deleteMany({ user: userId, actor: actorId, type, ...extra });
}
