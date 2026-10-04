export class AppError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    Object.assign(this, { code, status, details });
  }
}

/** Builds an AppError from an entry in constants.ERROR so codes and statuses never drift apart. */
export function appError(kind, message, details) {
  return new AppError(kind.code, message, kind.status, details);
}
