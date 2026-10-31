import { api, ApiError } from './api.js';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Shrinks a picked file so uploads stay small: longest side at most `max` px, re-encoded as JPEG.
// GIFs are sent as they are so animation survives.
export async function prepareImage(file, max = 1600) {
  if (!TYPES.includes(file.type)) throw new ApiError(400, 'Choose a JPEG, PNG, WebP or GIF image.');
  if (file.type === 'image/gif') {
    if (file.size > 2 * 1024 * 1024) throw new ApiError(413, 'GIFs must be 2 MB or smaller.');
    return readAsDataUrl(file);
  }
  const bitmap = await createImageBitmap(file).catch(() => { throw new ApiError(400, 'This file could not be opened as an image.'); });
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent PNGs get a white background instead of black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.85);
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new ApiError(400, 'This file could not be read.'));
    r.readAsDataURL(file);
  });
}

// Uploads a data URL from prepareImage. Resolves to { id, url }.
export const uploadImage = (dataUrl) => api.post('/images', { dataUrl });
