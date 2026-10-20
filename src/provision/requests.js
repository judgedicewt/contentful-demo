/**
 * Serialises Management API calls and retries them on HTTP 429.
 *
 * Contentful allows roughly 7 Management API requests per second. Every
 * write in the provisioning code goes through a single requester, so calls
 * run one at a time, and a rate-limited call waits for the number of seconds
 * the API asks for (falling back to 2s) before trying again, up to
 * `maxAttempts` times in total.
 */
import { isRateLimited, rateLimitResetSeconds } from './errors.js';

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createRequester({ log = () => {}, maxAttempts = 5, sleep = defaultSleep, fallbackSeconds = 2 } = {}) {
  let tail = Promise.resolve();

  async function runWithRetry(label, fn) {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await fn(attempt);
      } catch (error) {
        if (!isRateLimited(error) || attempt >= maxAttempts) throw error;
        const seconds = rateLimitResetSeconds(error, fallbackSeconds);
        log(`  rate limited on ${label}; waiting ${seconds}s (attempt ${attempt} of ${maxAttempts})`);
        await sleep(seconds * 1000);
      }
    }
  }

  /**
   * Queues `fn` behind every call made before it. Resolves with `fn`'s
   * result; rejects with its final error. A rejected call never blocks the
   * calls queued after it.
   */
  return function request(label, fn) {
    const run = () => runWithRetry(label, fn);
    const next = tail.then(run, run);
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
}

/** True when the entity's current version is the published one. */
export function isPublished(entity) {
  const sys = entity?.sys ?? {};
  return Boolean(sys.publishedVersion) && sys.version === sys.publishedVersion + 1;
}

export function isArchived(entity) {
  return Boolean(entity?.sys?.archivedVersion);
}
