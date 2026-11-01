export const RATE_WINDOW_MS = 60_000;

export function rateLimitMax(raw = process.env.WIDGET_RATE_LIMIT) {
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 1000) return parsed;
  return 20;
}

export function rateWindowStart(now = Date.now()) {
  return Math.floor(now / RATE_WINDOW_MS) * RATE_WINDOW_MS;
}

export function rateBucketKey(publicKey: string, ip: string) {
  return `${publicKey}\n${ip}`;
}
