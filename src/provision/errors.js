/**
 * Helpers for reading errors thrown by contentful-management.
 *
 * The SDK throws an Error whose `message` is a JSON document of the shape
 * `{ status, statusText, message, details, request }`. Raw axios errors (for
 * example from a transport failure before the SDK's handler ran) carry
 * `response.status` and `response.headers` instead. Both are handled here.
 */

export function parseError(error) {
  let parsed = {};
  if (typeof error?.message === 'string') {
    try {
      const candidate = JSON.parse(error.message);
      if (candidate && typeof candidate === 'object') parsed = candidate;
    } catch {
      // Not a JSON message; fall through to the raw fields below.
    }
  }
  const status = parsed.status ?? error?.response?.status ?? error?.status;
  return {
    status: typeof status === 'number' ? status : Number(status) || undefined,
    name: error?.name,
    message: parsed.message || (typeof error?.message === 'string' ? error.message : String(error)),
    details: parsed.details ?? error?.details ?? {},
    headers: error?.response?.headers ?? parsed.headers ?? {},
    requestId: parsed.requestId,
  };
}

export function isNotFound(error) {
  return parseError(error).status === 404;
}

export function isRateLimited(error) {
  return parseError(error).status === 429;
}

/**
 * Seconds to wait before retrying a rate-limited request. Reads the
 * `X-Contentful-RateLimit-Reset` header when the error exposes response
 * headers, then any reset hint in the parsed `details`, else `fallback`.
 */
export function rateLimitResetSeconds(error, fallback = 2) {
  const { headers, details } = parseError(error);
  const candidates = [
    headers?.['x-contentful-ratelimit-reset'],
    headers?.['X-Contentful-RateLimit-Reset'],
    typeof headers?.get === 'function' ? headers.get('x-contentful-ratelimit-reset') : undefined,
    details?.reset,
    details?.rateLimitReset,
    details?.['X-Contentful-RateLimit-Reset'],
  ];
  for (const candidate of candidates) {
    const seconds = Number(candidate);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }
  return fallback;
}

/** One-line description of an API error for log output (never includes tokens). */
export function describeError(error) {
  const { status, name, message, details } = parseError(error);
  const parts = [];
  if (status) parts.push(`HTTP ${status}`);
  if (name && name !== 'Error') parts.push(name);
  if (message) parts.push(message);
  const detailErrors = Array.isArray(details?.errors) ? details.errors : [];
  for (const detail of detailErrors.slice(0, 5)) {
    const path = Array.isArray(detail.path) ? detail.path.join('.') : detail.path;
    parts.push(`${path ? `${path}: ` : ''}${detail.details ?? detail.name ?? JSON.stringify(detail)}`);
  }
  return parts.join(' | ') || String(error);
}
