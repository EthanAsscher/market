// ═══════════════════════════════════════════════════════════
//  MARKET — Game Engine
//  Core formulas shared by client + server
//  Server-authoritative: these run on Edge Functions
//  Client uses them for display estimates only
// ═══════════════════════════════════════════════════════════

import {
  ALL_COMMODITIES, EVENTS, NOISE_BASE, MICRO_TREND_CHANCE,
  MICRO_TREND_SIZE, GRAVITY_NORMAL, GRAVITY_EXTREME,
  EVENT_CHANCE, EVENT_COOLDOWN_TICKS,
} from "./constants";

// ─── Spread Calculation ───
// Returns { bid, ask, spread } given current price and commodity volatility
export function calcSpread(price: number, vol: number, playerCount: number) {
  const base = 0.015;
  const volSpread = vol * 0.08;
  const liquidityBonus = Math.min(0.005, playerCount * 0.0001);
  const spread = Math.max(0.005, base + volSpread - liquidityBonus);
  const half = price * spread / 2;
  return {
    bid: +(price - half).toFixed(6),
    ask: +(price + half).toFixed(6),
    spread: +(spread * 100).toFixed(2), // percentage
  };
}

// ─── Price Impact ───
// How much a trade moves the price. Returns new price.
export function calcImpact(
  price: number, quantity: number, totalShares: number,
  action: "buy" | "sell" | "short" | "cover"
) {
  const impactPct = (quantity / totalShares) * 2;
  const direction = (action === "buy" || action === "cover") ? 1 : -1;
  const newPrice = price * (1 + impactPct * direction);
  return +Math.max(0.0001, newPrice).toFixed(6);
}

// ─── Market Tick ───
// Applies noise, micro-trends, and gravity to all commodities.
// Returns updated prices and optional event.
export interface TickInput {
  prices: Record<string, number>;          // commodity_id → current price
  bases: Record<string, number>;           // commodity_id → base price
  playerCount: number;
  ticksSinceEvent: number;
  dayRng: () => number;                    // Seeded RNG for deterministic events
}

export interface TickResult {
  prices: Record<string, number>;
  event: typeof EVENTS[number] | null;
  ticksSinceEvent: number;
}

export function doTick(input: TickInput): TickResult {
  const { prices, bases, playerCount, dayRng } = input;
  let { ticksSinceEvent } = input;
  const newPrices: Record<string, number> = {};

  // Noise multiplier — scales inversely with player count
  const noiseMult = Math.max(1, 8 - Math.log10(Math.max(playerCount, 1)) * 3.5);

  ALL_COMMODITIES.forEach(g => {
    let price = prices[g.id] || g.base;
    const base = bases[g.id] || g.base;

    // Random noise
    const noise = (dayRng() - 0.5) * NOISE_BASE * noiseMult * (1 + g.vol);
    price *= (1 + noise);

    // Micro-trends
    if (dayRng() < MICRO_TREND_CHANCE) {
      const dir = dayRng() > 0.5 ? 1 : -1;
      price *= (1 + dir * MICRO_TREND_SIZE * (1 + g.vol));
    }

    // Gravity toward base
    const ratio = price / base;
    const gravStr = (ratio > 5 || ratio < 0.2) ? GRAVITY_EXTREME : GRAVITY_NORMAL;
    price += (base - price) * gravStr;

    newPrices[g.id] = +Math.max(0.0001, price).toFixed(6);
  });

  // Event check
  let event = null;
  ticksSinceEvent++;
  if (ticksSinceEvent >= EVENT_COOLDOWN_TICKS && dayRng() < EVENT_CHANCE) {
    const eventIdx = Math.floor(dayRng() * EVENTS.length);
    event = EVENTS[eventIdx];
    ticksSinceEvent = 0;

    // Apply event effects with player scaling
    const eventScale = Math.min(1, 0.4 + Math.log10(Math.max(playerCount, 1)) / 3.5);
    event.targets.forEach(id => {
      if (newPrices[id] !== undefined) {
        newPrices[id] = +(newPrices[id] * (1 + event!.effect * eventScale)).toFixed(6);
      }
    });
  }

  return { prices: newPrices, event, ticksSinceEvent };
}

// ─── Net Worth Calculation ───
export function calcNetWorth(
  wallet: number,
  savings: number,
  loan: number,
  holdings: { commodity_id: string; quantity: number }[],
  shorts: { commodity_id: string; quantity: number; entry_price: number; collateral: number }[],
  prices: Record<string, number>
): number {
  let nw = wallet + savings - loan;
  holdings.forEach(h => { nw += h.quantity * (prices[h.commodity_id] || 0); });
  shorts.forEach(s => { nw += s.collateral + (s.entry_price - (prices[s.commodity_id] || 0)) * s.quantity; });
  return +nw.toFixed(2);
}

// ─── Seeded RNG ───
// Deterministic RNG so all clients compute same events for a given day+tick
export function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Generate seed from day number + tick number
export function tickSeed(day: number, tick: number): number {
  return day * 100000 + tick;
}
