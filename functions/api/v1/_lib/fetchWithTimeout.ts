/**
 * fetch() wrapped with AbortController timeout + a single retry on 5xx /
 * network errors. Used for outbound calls to Resend, ClickSend, Twilio,
 * MessageBird and Square — anywhere a hung third-party would otherwise
 * burn the Pages function's CPU budget and surface as a 524 to the user.
 *
 * Usage:
 *   const r = await fetchWithTimeout(url, { method: 'POST', headers, body });
 *
 * Tunables via opts:
 *   timeoutMs:   default 8000 (8s). Caller can shorten for fast paths.
 *   retryOn5xx:  default true. Set false for non-idempotent operations
 *                where a retry could double-charge / double-send.
 *
 * Audit reference: 2026-04-25 audit, Backend High #7.
 */

const DEFAULT_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MIN_MS = 200;
const RETRY_DELAY_JITTER_MS = 300;

export interface FetchWithTimeoutOpts extends RequestInit {
  timeoutMs?: number;
  retryOn5xx?: boolean;
}

export async function fetchWithTimeout(
  url: string,
  opts: FetchWithTimeoutOpts = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, retryOn5xx = true, ...init } = opts;

  const attempt = async (): Promise<Response> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const r = await attempt();
    if (retryOn5xx && r.status >= 500 && r.status < 600) {
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MIN_MS + Math.random() * RETRY_DELAY_JITTER_MS));
      return await attempt();
    }
    return r;
  } catch (e: any) {
    // AbortError (timeout) or genuine network failure — single retry with jitter.
    if (retryOn5xx) {
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MIN_MS + Math.random() * RETRY_DELAY_JITTER_MS));
      return await attempt();
    }
    throw e;
  }
}
