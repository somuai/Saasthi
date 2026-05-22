/** Spread morning sync load across workers (0–maxMs). */

export function syncJitterMs(maxMs = 60_000) {
  return Math.floor(Math.random() * maxMs);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
