import { Router } from 'express';
import Post from '../models/Post.js';
import User, { PUBLIC_FIELDS } from '../models/User.js';
import Image, { imageUrl } from '../models/Image.js';
import Notification from '../models/Notification.js';
import Connection from '../models/Connection.js';
import { requireAuth } from '../middleware/auth.js';
import { ah, HttpError, text, validId } from '../middleware/errors.js';
import { brief, notify, unnotify } from '../lib.js';
import { ownImage } from './images.js';

const router = Router();
router.use(requireAuth);

// The original post of a repost, without its own comments.
function embed(p) {
  if (!p || !p.author) return null;
  return { id: p._id.toString(), author: brief(p.author), text: p.text, imageUrl: imageUrl(p.image), createdAt: p.createdAt };
}

function serialize(post, ctx) {
  const me = ctx.me.toString();
  const id = post._id.toString();
  return {
    id,
    author: brief(post.author),
    // How you relate to the author: self | none | sent | received | connected.
    authorStatus: ctx.status(post.author?._id),
    text: post.text,
    imageUrl: imageUrl(post.image),
    // undefined: not a repost. null: a repost whose original was deleted.
    repostOf: post.populated('repostOf') ? embed(post.repostOf) : undefined,
    createdAt: post.createdAt,
    likeCount: post.likes.length,
    likedByMe: post.likes.some((x) => x.toString() === me),
    repostCount: ctx.reposts.get(id)?.count || 0,
    repostedByMe: Boolean(ctx.reposts.get(id)?.mine),
    savedByMe: ctx.saved.has(id),
    comments: post.comments.map((c) => ({
      id: c._id.toString(),
      author: brief(c.author),
      text: c.text,
      createdAt: c.createdAt,
    })),
  };
}

// Repost counts, saved state and your connection to each author for a page of posts.
async function context(posts, meId) {
  const ids = posts.map((p) => p._id);
  const authors = [...new Set(posts.map((p) => p.author?._id?.toString()).filter(Boolean))];
  const [counts, me, links] = await Promise.all([
    Post.aggregate([
      { $match: { repostOf: { $in: ids } } },
      { $group: { _id: '$repostOf', count: { $sum: 1 }, authors: { $addToSet: '$author' } } },
    ]),
    User.findById(meId).select('+savedPosts'),
    Connection.find({ $or: [{ requester: meId, recipient: { $in: authors } }, { recipient: meId, requester: { $in: authors } }] }),
  ]);
  const rel = new Map(links.map((c) => {
    const mine = c.requester.equals(meId);
    return [(mine ? c.recipient : c.requester).toString(), c.status === 'accepted' ? 'connected' : mine ? 'sent' : 'received'];
  }));
  const status = (id) => (!id ? 'none' : id.equals(meId) ? 'self' : rel.get(id.toString()) || 'none');
  const reposts = new Map(counts.map((c) => [c._id.toString(), { count: c.count, mine: c.authors.some((a) => a.equals(meId)) }]));
  return { me: meId, reposts, status, saved:new Set((me?.savedPosts || []).map(String)) };
}

const withPeople = (q) => q
  .populate('author', PUBLIC_FIELDS)
  .populate('comments.author', PUBLIC_FIELDS)
  .populate({ path: 'repostOf', select: 'author text image createdAt', populate: { path: 'author', select: PUBLIC_FIELDS } });

async function load(id) {
  const post = await withPeople(Post.findById(validId(id)));
  if (!post) throw new HttpError(404, 'This post was deleted or never existed.');
  return post;
}

async function one(post, meId) {
  return serialize(post, await context([post], meId));
}

async function many(posts, meId) {
  const ctx = await context(posts, meId);
  return posts.map((p) => serialize(p, ctx));
}

// Engagement score for "Top": likes and comments, fading with age.
const score = (p, now) => (p.likes.length + 2 * p.comments.length + 1) / ((now - p.createdAt) / 3600e3 + 2) ** 1.2;

// Feed. Newest first by default; pass ?before=<ISO date> for the next page, ?author=<id> for one person.
// ?sort=top ranks the latest 500 posts by score and pages with ?before=offset:<n>.
router.get('/', ah(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  if (req.query.sort === 'top' && !req.query.author) {
    const m = /^offset:(\d{1,4})$/.exec(req.query.before || 'offset:0');
    if (!m) throw new HttpError(400, 'before must be offset:<n> when sort=top.');
    const offset = Number(m[1]);
    const now = Date.now();
    const recent = await Post.find().sort({ createdAt: -1 }).limit(500).select('likes comments createdAt');
    const ranked = recent.sort((a, b) => score(b, now) - score(a, now)).slice(offset, offset + limit);
    const found = await withPeople(Post.find({ _id: { $in: ranked.map((p) => p._id) } }));
    const byId = new Map(found.map((p) => [p._id.toString(), p]));
    const page = ranked.map((p) => byId.get(p._id.toString())).filter(Boolean);
    return res.json({
      posts: await many(page, req.user._id),
      nextCursor: offset + limit < recent.length ? `offset:${offset + limit}` : null,
    });
  }
  const filter = {};
  if (req.query.before) {
    const d = new Date(req.query.before);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, 'before must be a date.');
    filter.createdAt = { $lt: d };
  }
  if (req.query.author) filter.author = validId(req.query.author);
  const posts = await withPeople(Post.find(filter).sort({ createdAt: -1 }).limit(limit + 1));
  const page = posts.slice(0, limit);
  res.json({
    posts: await many(page, req.user._id),
    nextCursor: posts.length > limit ? page[page.length - 1].createdAt.toISOString() : null,
  });
}));

// Posts you saved, most recently saved first.
router.get('/saved', ah(async (req, res) => {
  const me = await User.findById(req.user._id).select('+savedPosts');
  const ids = [...me.savedPosts].reverse().slice(0, 100);
  const found = await withPeople(Post.find({ _id: { $in: ids } }));
  const byId = new Map(found.map((p) => [p._id.toString(), p]));
  res.json({ posts: await many(ids.map((id) => byId.get(id.toString())).filter(Boolean), req.user._id) });
}));

router.get('/:id', ah(async (req, res) => {
  res.json({ post: await one(await load(req.params.id), req.user._id) });
}));

router.post('/', ah(async (req, res) => {
  const image = 'image' in req.body ? await ownImage(req.body.image, req.user._id) : null;
  const body = text(req.body.text, 'Post text', 3000, { required: !image });
  const post = await Post.create({ author: req.user._id, text: body, image });
  res.status(201).json({ post: await one(await load(post._id), req.user._id) });
}));

router.delete('/:id', ah(async (req, res) => {
  const post = await load(req.params.id);
  if (post.author._id.toString() !== req.user._id.toString()) throw new HttpError(403, 'You can only delete your own posts.');
  await post.deleteOne();
  // Plain reposts go with it; reposts with their own text stay and show the original as unavailable.
  await Promise.all([Post.deleteMany({ repostOf: post._id, text: '' }), Notification.deleteMany({ post: post._id })]);
  if (post.image && !(await Post.exists({ image: post.image }))) await Image.deleteOne({ _id: post.image });
  res.status(204).end();
}));

// Toggle like.
router.post('/:id/like', ah(async (req, res) => {
  const post = await load(req.params.id);
  const me = req.user._id;
  const liked = post.likes.some((id) => id.toString() === me.toString());
  await Post.updateOne({ _id: post._id }, liked ? { $pull: { likes: me } } : { $addToSet: { likes: me } });
  if (liked) await unnotify(post.author._id, me, 'like', { post: post._id });
  else await notify(post.author._id, me, 'like', { post: post._id });
  res.json({ post: await one(await load(post._id), me) });
}));

// Toggle saved.
router.post('/:id/save', ah(async (req, res) => {
  const post = await load(req.params.id);
  const me = await User.findById(req.user._id).select('+savedPosts');
  const saved = me.savedPosts.some((id) => id.equals(post._id));
  me.savedPosts = saved ? me.savedPosts.filter((id) => !id.equals(post._id)) : [...me.savedPosts, post._id].slice(-500);
  await me.save();
  res.json({ post: await one(post, req.user._id) });
}));

// Repost to your followers, optionally with your own thoughts. Reposting a repost shares its original.
router.post('/:id/repost', ah(async (req, res) => {
  let target = await load(req.params.id);
  if (target.repostOf) target = await load(target.repostOf._id);
  const me = req.user._id;
  if (target.author._id.equals(me)) throw new HttpError(400, 'You cannot repost your own post.');
  const thoughts = text(req.body.text, 'Your thoughts', 3000, { required: false });
  if (!thoughts && (await Post.exists({ author: me, repostOf: target._id, text: '' }))) {
    throw new HttpError(409, 'You already reposted this.');
  }
  const post = await Post.create({ author: me, text: thoughts, repostOf: target._id });
  await notify(target.author._id, me, 'repost', { post: target._id });
  res.status(201).json({ post: await one(await load(post._id), me), original: await one(target, me) });
}));

// Undo a plain repost of a post.
router.delete('/:id/repost', ah(async (req, res) => {
  const target = await load(req.params.id);
  const me = req.user._id;
  const r = await Post.findOneAndDelete({ author: me, repostOf: target._id, text: '' });
  if (!r) throw new HttpError(404, 'You have not reposted this.');
  await unnotify(target.author._id, me, 'repost', { post: target._id });
  res.json({ removedId: r._id.toString(), original: await one(target, me) });
}));

router.post('/:id/comments', ah(async (req, res) => {
  const post = await load(req.params.id);
  post.comments.push({ author: req.user._id, text: text(req.body.text, 'Comment', 1250) });
  await post.save();
  await notify(post.author._id, req.user._id, 'comment', { post: post._id });
  res.status(201).json({ post: await one(await load(post._id), req.user._id) });
}));

router.delete('/:id/comments/:commentId', ah(async (req, res) => {
  const post = await load(req.params.id);
  const c = post.comments.id(validId(req.params.commentId));
  if (!c) throw new HttpError(404, 'This comment was already deleted.');
  const me = req.user._id.toString();
  if (c.author._id.toString() !== me && post.author._id.toString() !== me) {
    throw new HttpError(403, 'You can only delete your own comments or comments on your post.');
  }
  // Replace the array instead of a conditional $pull, which some MongoDB-compatible servers do not support.
  post.comments = post.comments.filter((x) => !x._id.equals(c._id));
  await post.save();
  res.json({ post: await one(await load(post._id), req.user._id) });
}));

export default router;
