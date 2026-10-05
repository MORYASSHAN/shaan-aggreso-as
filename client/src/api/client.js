export class ApiError extends Error {
  constructor({ status, code, message, requestId, details }) {
    super(message);
    Object.assign(this, { name: 'ApiError', status, code, requestId, details });
  }

  // 409: the data changed underneath, so reload rather than retry.
  get isConflict() {
    return this.status === 409;
  }

  get fieldErrors() {
    return this.details?.fields ?? {};
  }
}

async function parse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function api(path, { method = 'GET', body, query } = {}) {
  const qs = query
    ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''))}`
    : '';
  let res;
  try {
    res = await fetch(`/api${path}${qs}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: 'NETWORK',
      message: 'Cannot reach the server. Check your connection.',
    });
  }
  const data = await parse(res);
  if (!res.ok) {
    const error = data?.error ?? {};
    throw new ApiError({
      status: res.status,
      code: error.code ?? 'INTERNAL',
      message: error.message ?? `Request failed (${res.status}).`,
      requestId: error.requestId ?? res.headers.get('x-request-id'),
      details: error.details,
    });
  }
  return data;
}
