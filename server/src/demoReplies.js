// The sample people from the seed are not real, so nobody would ever answer them.
// Outside production they send a short reply a moment after you message them,
// unless someone is signed in as that sample person right now (then they reply themselves).
// Set DEMO_REPLIES=false to turn this off.
import Message from './models/Message.js';
import { publish, isOnline } from './live.js';
import { SAMPLE_EMAILS } from './seed.js';

const REPLIES = [
  'Thanks for the message! Let me get back to you on that shortly.',
  'Good to hear from you. That sounds great.',
  'Interesting, tell me a bit more?',
  'Sure, happy to help. When works for you?',
  'Appreciate you reaching out!',
  'Makes sense. Let us catch up this week.',
];

const enabled = () => !['production', 'test'].includes(process.env.NODE_ENV) && process.env.DEMO_REPLIES !== 'false';

export function maybeDemoReply(sender, recipient, shape) {
  if (!enabled() || !SAMPLE_EMAILS.includes(recipient.email) || isOnline(recipient._id)) return;
  setTimeout(async () => {
    try {
      const count = await Message.countDocuments({ from: recipient._id, to: sender._id });
      const m = await Message.create({ from: recipient._id, to: sender._id, text: REPLIES[count % REPLIES.length] });
      publish(sender._id, 'message', shape(m));
      publish(recipient._id, 'message', shape(m));
    } catch (err) { console.error('demo reply failed', err); }
  }, 1500 + Math.random() * 1500);
}
