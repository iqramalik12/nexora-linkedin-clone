import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const COOKIE = 'nx_token';

export function secret() {
  const s = process.env.JWT_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be set in production');
  return s || 'dev-only-secret-change-me';
}

export function issueToken(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), v: user.tokenVersion || 0 }, secret(), { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });
  try {
    const { sub, v } = jwt.verify(token, secret());
    const user = await User.findById(sub).select('+tokenVersion');
    if (user && (v ?? 0) !== user.tokenVersion) return res.status(401).json({ error: 'You were signed out. Please sign in again.' });
    if (!user) return res.status(401).json({ error: 'Your account was not found. Please sign in again.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}
