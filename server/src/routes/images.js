import { Router } from 'express';
import Image from '../models/Image.js';
import { requireAuth } from '../middleware/auth.js';
import { ah, HttpError, validId } from '../middleware/errors.js';

const router = Router();
router.use(requireAuth);

export const MAX_BYTES = 2 * 1024 * 1024;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

// The first bytes of each format, so a file cannot claim to be an image it is not.
const MAGIC = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/gif': (b) => b.subarray(0, 4).toString('ascii') === 'GIF8',
  'image/webp': (b) => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
};

// Upload one image as a data URL: { dataUrl: "data:image/jpeg;base64,..." }.
router.post('/', ah(async (req, res) => {
  const m = typeof req.body?.dataUrl === 'string' ? DATA_URL.exec(req.body.dataUrl) : null;
  if (!m) throw new HttpError(400, 'Choose a JPEG, PNG, WebP or GIF image.');
  const data = Buffer.from(m[2], 'base64');
  if (data.length > MAX_BYTES) throw new HttpError(413, 'Images must be 2 MB or smaller.');
  if (!MAGIC[m[1]](data)) throw new HttpError(400, 'This file is not a valid image.');
  const img = await Image.create({ owner: req.user._id, type: m[1], data });
  res.status(201).json({ id: img._id.toString(), url: `/api/images/${img._id}` });
}));

router.get('/:id', ah(async (req, res) => {
  const img = await Image.findById(validId(req.params.id));
  if (!img) throw new HttpError(404, 'Image not found.');
  res.set({ 'Content-Type': img.type, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
  res.send(img.data);
}));

export default router;

// Checks that `id` is an image the signed-in person uploaded. Returns the id, or null for "none".
export async function ownImage(id, userId) {
  if (id === null || id === '') return null;
  const img = await Image.findById(validId(id)).select('owner');
  if (!img || !img.owner.equals(userId)) throw new HttpError(400, 'Upload the image again and retry.');
  return img._id;
}
