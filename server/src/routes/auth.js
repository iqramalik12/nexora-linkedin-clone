import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { COOKIE, issueToken, requireAuth } from '../middleware/auth.js';
import { ah, HttpError, text } from '../middleware/errors.js';

const router = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLORS = ['#7a4fa8', '#2c6e8f', '#b4532a', '#4f7a2b', '#8a3b6b', '#0d6e6e', '#9a5b13', '#3d5a99'];

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: () => (process.env.NODE_ENV === 'test' ? 1000 : 30), // read per request: tests set NODE_ENV after import
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

router.post('/signup', limiter, ah(async (req, res) => {
  const name = text(req.body.name, 'Name', 80);
  const email = text(req.body.email, 'Email', 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
  if (password.length > 128) throw new HttpError(400, 'Password must be 128 characters or fewer.');
  if (await User.exists({ email })) throw new HttpError(409, 'An account with this email already exists. Try signing in.');

  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10),
    headline: text(req.body.headline, 'Headline', 160, { required: false }),
    avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
  });
  issueToken(res, user);
  res.status(201).json({ user: user.toPublic() });
}));

router.post('/login', limiter, ah(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'That email and password do not match.');
  }
  issueToken(res, user);
  res.json({ user: user.toPublic() });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.status(204).end();
});

// Ends every session on every device.
router.post('/logout-all', requireAuth, ah(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.clearCookie(COOKIE);
  res.status(204).end();
}));

router.put('/password', requireAuth, ah(async (req, res) => {
  const current = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const next = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
  const user = await User.findById(req.user._id).select('+passwordHash +tokenVersion');
  if (!(await bcrypt.compare(current, user.passwordHash))) throw new HttpError(400, 'Your current password is not correct.');
  if (next.length < 8 || next.length > 128) throw new HttpError(400, 'New password must be 8 to 128 characters.');
  user.passwordHash = await bcrypt.hash(next, 10);
  user.tokenVersion += 1; // other devices are signed out
  await user.save();
  issueToken(res, user);
  res.status(204).end();
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));

export default router;
