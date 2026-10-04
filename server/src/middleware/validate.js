import { ERROR } from '../constants.js';
import { appError } from '../utils/AppError.js';

function fieldErrors(zodError) {
  const fields = {};
  for (const issue of zodError.issues) {
    const key = issue.path.join('.') || '_';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/** Validates req.body; the parsed (trimmed, defaulted) value replaces it. */
export function validate(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      next(
        appError(ERROR.VALIDATION_FAILED, 'Some fields are invalid.', { fields: fieldErrors(parsed.error) }),
      );
      return;
    }
    req.body = parsed.data;
    next();
  };
}

/** Express 5 makes req.query read-only, so the parsed query is stored on req.validQuery. */
export function validateQuery(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.query ?? {});
    if (!parsed.success) {
      next(
        appError(ERROR.VALIDATION_FAILED, 'Some query parameters are invalid.', {
          fields: fieldErrors(parsed.error),
        }),
      );
      return;
    }
    req.validQuery = parsed.data;
    next();
  };
}
