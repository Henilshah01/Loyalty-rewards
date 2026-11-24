import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

export function notFound(req, res, next) {
  next(new AppError(404, 'not_found', 'Route not found.'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: 'validation_error', message: `${first.path.join('.') || 'input'}: ${first.message}` });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'duplicate', message: 'That value already exists.' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'bad_json', message: 'Invalid JSON body.' });
  }
  console.error(err);
  res.status(500).json({ error: 'server_error', message: 'Something went wrong.' });
}
