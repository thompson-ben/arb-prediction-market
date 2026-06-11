/** Operational helper: fetch with a hard timeout so a hung upstream can't stall
 * a serverless function. On timeout the request is aborted and the caller's
 * existing error handling (try/catch or allSettled) degrades gracefully. */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit & { next?: { revalidate?: number } } = {},
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
