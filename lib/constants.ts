// ═══════════════════════════════════════════════════════════
//  MARKET — Game Constants
//  All balance values, commodities, events, leagues
//  Single source of truth shared by client + server
// ═══════════════════════════════════════════════════════════

// ─── Economy ───
export const DAILY_CLAIM = 100;
export const AD_BONUS = 50;
export const INITIAL_SUPPLY = 10000;
export const BANK_UNLOCK_NW = 1000;
export const INTEREST_RATE = 0.05;      // 5% daily on savings
export const LOAN_RATE = 0.08;          // 8% daily on loans
export const LOAN_TERM_DAYS = 7;
export const SHORT_COLLATERAL = 1.5;    // 150% collateral required
export const SHORT_BORROW_RATE = 0.008; // 0.8% daily borrow fee
export const SHORT_MARGIN_CALL = 0.85;  // Liquidate at 85% collateral consumed

// ─── Market Tick ───
export const TICK_MS = 15000;           // 15s between server ticks
export const EVENT_CHANCE = 0.06;       // 6% per tick
export const EVENT_COOLDOWN_TICKS = 6;  // 90s between events (6 × 15s)
export const NOISE_BASE = 0.001;        // Base price noise per tick
export const MICRO_TREND_CHANCE = 0.03;
export const MICRO_TREND_SIZE = 0.005;
export const GRAVITY_NORMAL = 0.0005;
export const GRAVITY_EXTREME = 0.003;

// ─── Daily Cycle ───
export const TIMEZONE = "America/New_York";
export const EVENTS_PER_DAY = 4;        // Fixed events per day

// ─── Commodities ───
export interface Commodity {
  id: string;
  name: string;
  short: string;
  emoji: string;
  base: number;
  vol: number;
  shares: number;
  desc: string;
  lore: string;
  isContraband?: boolean;
}

export const COMMODITIES: Commodity[] = [
  { id: "spices", name: "Exotic Spices", short: "Spices", emoji: "🌶️", base: 0.10, vol: 0.12, shares: 500000,
    desc: "Cinnamon, nutmeg, and pepper from the East Indies",
    lore: "The Dutch East India Company once valued nutmeg higher than gold" },
  { id: "silk", name: "Fine Silk", short: "Silk", emoji: "🧵", base: 0.10, vol: 0.10, shares: 200000,
    desc: "Lustrous fabric from Chinese silkworms",
    lore: "Silk road caravans would travel 4,000 miles for a single bolt" },
  { id: "rum", name: "Caribbean Rum", short: "Rum", emoji: "🍾", base: 0.10, vol: 0.15, shares: 800000,
    desc: "Dark spirits from sugarcane plantations",
    lore: "The Royal Navy issued daily rum rations until 1970" },
  { id: "gems", name: "Gemstones", short: "Gems", emoji: "💎", base: 0.10, vol: 0.08, shares: 150000,
    desc: "Rubies, emeralds, and sapphires",
    lore: "The Hope Diamond was said to carry a curse on all its owners" },
  { id: "parrots", name: "Rare Parrots", short: "Parrots", emoji: "🦜", base: 0.10, vol: 0.20, shares: 1000000,
    desc: "Colorful talking birds from tropical islands",
    lore: "A trained parrot could fetch more than a ship's cannon" },
  { id: "cannons", name: "Cannons & Arms", short: "Cannons", emoji: "💣", base: 0.10, vol: 0.14, shares: 300000,
    desc: "Naval weaponry and black powder munitions",
    lore: "A fully armed galleon carried 60+ cannons weighing 3 tons each" },
  { id: "tulips", name: "Tulip Bulbs", short: "Tulips", emoji: "🌷", base: 0.10, vol: 0.25, shares: 2000000,
    desc: "Rare flower bulbs from the Ottoman Empire",
    lore: "In 1637, a single Semper Augustus bulb sold for 10× a craftsman's annual income" },
];

export const CONTRABAND: Commodity = {
  id: "contraband", name: "Smuggled Opium", short: "Opium", emoji: "🖤", base: 0.10, vol: 0.18, shares: 100000,
  desc: "Illicit goods from the shadows", lore: "The East India Company's darkest trade secret",
  isContraband: true,
};

export const ALL_COMMODITIES = [...COMMODITIES, CONTRABAND];

// ─── Events ───
export interface GameEvent {
  name: string;
  emoji: string;
  targets: string[];
  effect: number;
  desc: string;
}

export const EVENTS: GameEvent[] = [
  { name: "Typhoon Season", emoji: "🌊", targets: ["spices", "silk"], effect: 0.20, desc: "Storms wreck trade routes — spice & silk supply drops!" },
  { name: "Royal Wedding", emoji: "👑", targets: ["gems", "silk"], effect: 0.18, desc: "The Crown demands finery — gems and silk soar!" },
  { name: "Rum Shortage", emoji: "🏝️", targets: ["rum"], effect: 0.22, desc: "Caribbean drought devastates sugarcane — rum prices spike!" },
  { name: "Parrot Plague", emoji: "🦠", targets: ["parrots"], effect: -0.25, desc: "Disease sweeps through aviaries — parrot values plummet!" },
  { name: "Arms Race", emoji: "⚔️", targets: ["cannons"], effect: 0.20, desc: "War looms between empires — cannon demand surges!" },
  { name: "Tulip Fever", emoji: "🌷", targets: ["tulips"], effect: 0.30, desc: "Speculation mania! Everyone wants tulips!" },
  { name: "Tulip Crash", emoji: "💥", targets: ["tulips"], effect: -0.35, desc: "The bubble bursts — tulip prices collapse!" },
  { name: "Pirate Raid", emoji: "🏴‍☠️", targets: ["spices", "gems", "rum"], effect: -0.12, desc: "Pirates intercept merchant fleet — goods flood the market!" },
  { name: "Trade Treaty", emoji: "📜", targets: ["spices", "silk", "gems"], effect: 0.10, desc: "New treaty opens Eastern ports — premium goods rise!" },
  { name: "Naval Blockade", emoji: "⚓", targets: ["rum", "cannons"], effect: 0.15, desc: "Blockade restricts supply — military goods surge!" },
  { name: "Silk Worm Blight", emoji: "🐛", targets: ["silk"], effect: -0.20, desc: "Disease kills silkworms across provinces!" },
  { name: "Gold Discovery", emoji: "🪙", targets: ["gems"], effect: 0.25, desc: "New mine discovered — gemstone rush begins!" },
  { name: "Monsoon Harvest", emoji: "🌧️", targets: ["spices"], effect: -0.15, desc: "Bumper spice harvest floods the market!" },
  { name: "Cannon Surplus", emoji: "🏭", targets: ["cannons"], effect: -0.18, desc: "War ends — military surplus tanks arms prices!" },
  { name: "Exotic Bird Craze", emoji: "🎪", targets: ["parrots"], effect: 0.28, desc: "European courts go wild for exotic birds!" },
  { name: "Smuggler's Moon", emoji: "🌙", targets: ["contraband"], effect: 0.30, desc: "Perfect conditions for smuggling — opium flows freely!" },
  { name: "Port Inspection", emoji: "🔍", targets: ["contraband"], effect: -0.25, desc: "Authorities crack down — contraband values plummet!" },
  { name: "Governor's Ban", emoji: "🚫", targets: ["rum", "contraband"], effect: -0.15, desc: "New governor bans spirits and contraband!" },
  { name: "Harvest Festival", emoji: "🎉", targets: ["rum", "spices"], effect: 0.12, desc: "Festival demand boosts rum and spice prices!" },
  { name: "Trade Wind Shift", emoji: "💨", targets: ["silk", "parrots"], effect: -0.10, desc: "Changed winds speed up delivery — prices ease!" },
  { name: "Museum Heist", emoji: "🎭", targets: ["gems", "tulips"], effect: -0.15, desc: "Stolen gems and tulips flood the black market!" },
  { name: "Explorer's Return", emoji: "🗺️", targets: ["parrots", "spices"], effect: 0.15, desc: "Explorer returns with tales of rare finds — demand surges!" },
  { name: "Treasury Bonds", emoji: "💰", targets: ["gems"], effect: -0.10, desc: "Crown sells gem reserves to fund the navy!" },
  { name: "Victory Celebration", emoji: "🎆", targets: ["rum", "cannons", "gems"], effect: 0.08, desc: "Naval victory — the whole port celebrates!" },
  { name: "Merchant Guild Strike", emoji: "✊", targets: ["spices", "silk", "rum"], effect: 0.14, desc: "Merchants refuse to sell at current prices!" },
];

// ─── Leagues ───
export interface League {
  id: string;
  name: string;
  emoji: string;
  min: number;
  max: number;
  col: string;
}

export const LEAGUES: League[] = [
  { id: "barnacle", name: "Barnacle", emoji: "🪸", min: 0, max: 500, col: "#7a8b7a" },
  { id: "deckhand", name: "Deckhand", emoji: "🪢", min: 500, max: 2000, col: "#6d8fa6" },
  { id: "boatswain", name: "Boatswain", emoji: "⚓", min: 2000, max: 8000, col: "#5c7a3a" },
  { id: "captain", name: "Captain", emoji: "🧭", min: 8000, max: 30000, col: "#8b6914" },
  { id: "admiral", name: "Admiral", emoji: "🎖️", min: 30000, max: 100000, col: "#c0392b" },
  { id: "diamond", name: "Diamond", emoji: "💎", min: 30000, max: 100000, col: "#4a90d9" },
  { id: "legend", name: "Legendary", emoji: "👑", min: 100000, max: Infinity, col: "#a0382a" },
];

export function getLeague(nw: number): League {
  return LEAGUES.find(l => nw >= l.min && nw < l.max) || LEAGUES[0];
}

// ─── Day Calculation ───
// Day 1 = the day you launch. Set this to your launch date.
export const LAUNCH_DATE = new Date("2025-03-01T00:00:00-05:00"); // Midnight ET

export function getCurrentDay(): number {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: TIMEZONE }));
  const launch = new Date(LAUNCH_DATE.toLocaleString("en-US", { timeZone: TIMEZONE }));
  const diffMs = et.getTime() - launch.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

export function getTimeUntilReset(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const etStr = now.toLocaleString("en-US", { timeZone: TIMEZONE });
  const et = new Date(etStr);
  const midnight = new Date(et);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight.getTime() - et.getTime();
  return {
    hours: Math.floor(diff / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}
