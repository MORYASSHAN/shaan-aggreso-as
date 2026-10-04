import { ERROR } from '../constants.js';
import { AppError, appError } from '../utils/AppError.js';

function toAppError(err) {
  if (err instanceof AppError) return err;
  // A malformed ObjectId in the URL means the thing does not exist.
  if (err?.name === 'CastError') return appError(ERROR.NOT_FOUND, 'Not found.');
  if (err?.type === 'entity.parse.failed')
    return appError(ERROR.VALIDATION_FAILED, 'Request body is not valid JSON.');
  if (err?.type === 'entity.too.large')
    return appError(ERROR.VALIDATION_FAILED, 'Request body is too large.');
  return null;
}

export function notFound(req, _res, next) {
  next(appError(ERROR.NOT_FOUND, `No route for ${req.method} ${req.originalUrl}.`));
}

// One place turns every error into { error: { code, message, requestId } }.
export function errorHandler(err, req, res, _next) {
  const known = toAppError(err);
  if (!known) {
    req.log.error({ err }, 'unexpected error');
    res.status(ERROR.INTERNAL.status).json({
      error: { code: ERROR.INTERNAL.code, message: 'Something went wrong.', requestId: req.id },
    });
    return;
  }
  if (known.status >= 500) req.log.error({ err }, 'server error');
  const body = { code: known.code, message: known.message, requestId: req.id };
  if (known.details) body.details = known.details;
  res.status(known.status).json({ error: body });
}
