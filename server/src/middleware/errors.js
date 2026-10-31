import mongoose from 'mongoose';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Wraps async route handlers so thrown errors reach the error middleware.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function validId(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Not found.');
  return id;
}

export function text(value, field, max, { required = true } = {}) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (required && !v) throw new HttpError(400, `${field} is required.`);
  if (v.length > max) throw new HttpError(400, `${field} must be ${max} characters or fewer.`);
  return v;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: Object.values(err.errors)[0]?.message || 'Invalid data.' });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
}
