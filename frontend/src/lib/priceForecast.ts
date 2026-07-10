import type { Product } from '@/types';

// All prices are integer cents. Dates are ISO strings on input, ms timestamps internally.

export interface SeriesPoint {
  t: number; // day index (0 = oldest history point)
  date: number; // ms timestamp
  price?: number; // cents, present on history points
  forecast?: number; // cents, present on forecast points
  lower?: number; // confidence band lower (cents)
  upper?: number; // confidence band upper (cents)
}

export interface PriceSeries {
  points: SeriesPoint[]; // history + forecast, chronological
  historyCount: number; // number of leading history points in `points`
  synthesized: boolean; // true when real history was too sparse
  stats: {
    current: number;
    min: number;
    max: number;
    avg: number;
    trendPct: number; // % change over the visible history window
    forecastPrice: number | null; // predicted price at end of horizon
    forecastDeltaPct: number | null;
    direction: 'up' | 'down' | 'flat';
  };
}

const DAY = 86_400_000;

// Small deterministic string hash → 32-bit int (never Math.random, so SSR/CSR agree).
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic PRNG (mulberry32) seeded from the hash.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a plausible, deterministic ~90-day daily history ending at the current price.
function synthesize(current: number, createdAt: number, slug: string, days = 90): { price: number; date: number }[] {
  const rand = mulberry32(hashSeed(slug));
  const now = Date.now();
  const start = Math.min(createdAt || now - days * DAY, now - days * DAY);

  // Random-walk backwards from current price, then reverse to chronological order.
  const walk: number[] = [current];
  let p = current;
  const drift = (rand() - 0.45) * 0.004; // slight bias per step
  for (let i = 1; i < days; i++) {
    const shock = (rand() - 0.5) * 0.05; // ±2.5% daily noise
    p = p / (1 + drift + shock);
    // Occasional promo dips
    if (rand() > 0.92) p *= 1 + (rand() * 0.12);
    p = Math.max(50, Math.round(p));
    walk.push(p);
  }
  walk.reverse();
  walk[walk.length - 1] = current; // pin the latest point to the real price

  return walk.map((price, i) => ({
    date: start + ((now - start) * i) / (days - 1),
    price,
  }));
}

// Least-squares linear regression over (t, price). Returns slope+intercept in cents/day. linear regression over (t, price). Returns slope+intercept in cents/day.
function regress(pts: { t: number; price: number }[]) {
  const n = pts.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const { t, price } of pts) {
    sx += t; sy += price; sxx += t * t; sxy += t * price;
  }
  const denom = n * sxx - sx * sx;
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  // Residual standard deviation for the confidence band.
  let ss = 0;
  for (const { t, price } of pts) {
    const pred = slope * t + intercept;
    ss += (price - pred) ** 2;
  }
  const stddev = n > 2 ? Math.sqrt(ss / (n - 2)) : 0;
  return { slope, intercept, stddev };
}

/**
 * Build the combined history + forecast series for a product.
 * Prefers real `priceHistory`; falls back to a deterministic synthesized series
 * when fewer than 2 real points exist. `horizonDays` extends the forecast forward.
 */
export function buildPriceSeries(product: Product, horizonDays = 30): PriceSeries {
  const current = product.price;
  const createdAt = product.createdAt ? new Date(product.createdAt).getTime() : Date.now();

  const real = (product.priceHistory ?? [])
    .map((h) => ({ price: h.price, date: new Date(h.date).getTime() }))
    .filter((h) => Number.isFinite(h.date) && Number.isFinite(h.price))
    .sort((a, b) => a.date - b.date);

  const synthesized = real.length < 2;
  const raw: { price: number; date: number }[] = synthesized
    ? synthesize(current, createdAt, product.slug || product._id).map((p) => ({ price: p.price, date: p.date }))
    : real;

  const history: SeriesPoint[] = raw.map((h) => ({
    t: (h.date - raw[0].date) / DAY,
    date: h.date,
    price: h.price,
  }));

  const { slope, stddev } = regress(history.map((h) => ({ t: h.t, price: h.price! })));
  const lastT = history[history.length - 1].t;
  const lastDate = history[history.length - 1].date;

  // Forecast points, anchored at the current price so the line is continuous.
  const forecast: SeriesPoint[] = [{ t: lastT, date: lastDate, price: current, forecast: current, lower: current, upper: current }];
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const dt = (horizonDays / steps) * i;
    const t = lastT + dt;
    // Anchor prediction to current price + projected slope movement (avoids intercept jump).
    const anchored = Math.max(0, Math.round(current + slope * dt));
    const bandRaw = stddev || Math.abs(current * 0.03);
    const band = bandRaw * (0.6 + i / steps); // widens with distance
    forecast.push({
      t,
      date: lastDate + dt * DAY,
      forecast: anchored,
      lower: Math.max(0, Math.round(anchored - band)),
      upper: Math.round(anchored + band),
    });
  }

  const prices = raw.map((h) => h.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const first = prices[0];
  const trendPct = first > 0 ? ((current - first) / first) * 100 : 0;

  const forecastPrice = forecast[forecast.length - 1].forecast ?? null;
  const forecastDeltaPct = forecastPrice != null && current > 0 ? ((forecastPrice - current) / current) * 100 : null;
  const direction: 'up' | 'down' | 'flat' =
    forecastDeltaPct == null || Math.abs(forecastDeltaPct) < 0.5 ? 'flat' : forecastDeltaPct > 0 ? 'up' : 'down';

  return {
    points: [...history, ...forecast.slice(1)],
    historyCount: history.length,
    synthesized,
    stats: { current, min, max, avg, trendPct, forecastPrice, forecastDeltaPct, direction },
  };
}

// Filter a built series to a trailing window ('30d' | '90d' | 'all'), keeping all forecast points.
export function windowSeries(series: PriceSeries, range: '30d' | '90d' | 'all'): SeriesPoint[] {
  if (range === 'all') return series.points;
  const days = range === '30d' ? 30 : 90;
  const historyPts = series.points.slice(0, series.historyCount);
  const forecastPts = series.points.slice(series.historyCount);
  const cutoff = historyPts[historyPts.length - 1].date - days * DAY;
  return [...historyPts.filter((p) => p.date >= cutoff), ...forecastPts];
}
