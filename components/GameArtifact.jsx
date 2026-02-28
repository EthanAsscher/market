"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSharedPrices } from "./useSharedPrices";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ═══════════════════════════════════════════════════════════
// AUDIO ENGINE
// ═══════════════════════════════════════════════════════════

const AudioEngine = (() => {
  let ctx = null, masterGain = null, musicGain = null, sfxGain = null;
  let musicOscs = [], musicActive = false, currentMode = "light";
  let currentTrack = null, nextTrack = null; // For MP3 music
  const musicUrls = { light: null, dark: null }; // Set these to MP3 URLs
  
  const init = () => {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain(); masterGain.gain.value = 0.5; masterGain.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.12; musicGain.connect(masterGain);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.3; sfxGain.connect(masterGain);
  };
  
  // ─── MP3 Music (use when URLs are set) ───
  const loadTrack = async (url) => {
    if (!ctx || !url) return null;
    try {
      const resp = await fetch(url);
      const buf = await resp.arrayBuffer();
      return await ctx.decodeAudioData(buf);
    } catch { return null; }
  };
  
  const playTrack = async (mode) => {
    const url = musicUrls[mode]; if (!url || !ctx) return false;
    const buf = await loadTrack(url);
    if (!buf) return false;
    // Fade out current
    if (currentTrack) {
      const old = currentTrack;
      old.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
      setTimeout(() => { try { old.src.stop(); } catch {} }, 2000);
    }
    // Play new
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const gain = ctx.createGain(); gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
    src.connect(gain); gain.connect(musicGain); src.start();
    currentTrack = { src, gain }; musicActive = true; currentMode = mode;
    return true;
  };
  
  // ─── Procedural Music (fallback when no MP3 URLs) ───
  const startProcedural = (mode = "light") => {
    init(); stopMusic();
    currentMode = mode; musicActive = true;
    const t = ctx.currentTime;
    const notes = mode === "dark" 
      ? [82.41, 110, 146.83, 185]
      : [130.81, 164.81, 196, 261.63];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      osc.detune.setValueAtTime((Math.random() - 0.5) * 15, t);
      filter.type = "lowpass";
      filter.frequency.value = mode === "dark" ? 400 : 600;
      filter.Q.value = 1;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.06 / notes.length, t + 2);
      osc.connect(filter); filter.connect(gain); gain.connect(musicGain);
      osc.start(t);
      musicOscs.push({ osc, gain, filter });
    });
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = mode === "dark" ? 0.05 : 0.08;
    lfoGain.gain.value = mode === "dark" ? 150 : 200;
    lfo.connect(lfoGain);
    musicOscs.forEach(o => { if (o.filter) lfoGain.connect(o.filter.frequency); });
    lfo.start(t);
    musicOscs.push({ osc: lfo, gain: lfoGain });
  };
  
  const startMusic = async (mode = "light") => {
    init();
    // Try MP3 first, fall back to procedural
    if (musicUrls[mode]) {
      const ok = await playTrack(mode);
      if (ok) return;
    }
    startProcedural(mode);
  };
  
  const stopMusic = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    // Stop procedural
    musicOscs.forEach(o => {
      try { if (o.gain.gain) o.gain.gain.linearRampToValueAtTime(0, t + 1); o.osc.stop(t + 1.1); } catch {}
    });
    musicOscs = [];
    // Stop MP3
    if (currentTrack) {
      try { currentTrack.gain.gain.linearRampToValueAtTime(0, t + 1); currentTrack.src.stop(t + 1.1); } catch {}
      currentTrack = null;
    }
    musicActive = false;
  };
  
  const setMode = (mode) => { if (musicActive && mode !== currentMode) startMusic(mode); };
  
  // Set MP3 URLs — call before startMusic or anytime to swap tracks
  // Example: AudioEngine.setMusicUrls({ light: "/music/tavern.mp3", dark: "/music/opium-den.mp3" })
  const setMusicUrls = (urls) => { if (urls.light) musicUrls.light = urls.light; if (urls.dark) musicUrls.dark = urls.dark; };
  
  const playSfx = (type) => {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(sfxGain);
    
    if (type === "buy") {
      osc.type = "sine"; osc.frequency.setValueAtTime(523, t); osc.frequency.linearRampToValueAtTime(784, t + 0.08);
      gain.gain.setValueAtTime(0.3, t); gain.gain.linearRampToValueAtTime(0, t + 0.15);
      osc.start(t); osc.stop(t + 0.15);
    } else if (type === "sell") {
      osc.type = "triangle"; osc.frequency.setValueAtTime(392, t); osc.frequency.linearRampToValueAtTime(294, t + 0.1);
      gain.gain.setValueAtTime(0.25, t); gain.gain.linearRampToValueAtTime(0, t + 0.15);
      osc.start(t); osc.stop(t + 0.15);
    } else if (type === "event") {
      osc.type = "sine"; osc.frequency.setValueAtTime(880, t);
      gain.gain.setValueAtTime(0.2, t); gain.gain.linearRampToValueAtTime(0, t + 0.4);
      osc.start(t); osc.stop(t + 0.4);
      const o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.connect(g2); g2.connect(sfxGain);
      o2.type = "sine"; o2.frequency.value = 1108;
      g2.gain.setValueAtTime(0, t + 0.1); g2.gain.linearRampToValueAtTime(0.15, t + 0.15); g2.gain.linearRampToValueAtTime(0, t + 0.5);
      o2.start(t + 0.1); o2.stop(t + 0.5);
    } else if (type === "claim") {
      [523, 659, 784].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(sfxGain); o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0, t + i * 0.08); g.gain.linearRampToValueAtTime(0.2, t + i * 0.08 + 0.02); g.gain.linearRampToValueAtTime(0, t + i * 0.08 + 0.2);
        o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.2);
      });
    } else if (type === "error") {
      osc.type = "square"; osc.frequency.setValueAtTime(200, t); osc.frequency.linearRampToValueAtTime(150, t + 0.12);
      gain.gain.setValueAtTime(0.1, t); gain.gain.linearRampToValueAtTime(0, t + 0.12);
      osc.start(t); osc.stop(t + 0.12);
    } else if (type === "click") {
      osc.type = "sine"; osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.08, t); gain.gain.linearRampToValueAtTime(0, t + 0.03);
      osc.start(t); osc.stop(t + 0.03);
    }
  };
  
  const setVolume = (v) => { if (masterGain) masterGain.gain.value = v; };
  
  return { init, startMusic, stopMusic, setMode, playSfx, setVolume, setMusicUrls, isPlaying: () => musicActive };
})();

// ═══════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════

const COMMODITIES = [
  { id: "spice", name: "Exotic Spices", short: "Spices", emoji: "🌶️", base: 0.10, vol: 0.06, shares: 500000,
    desc: "Steady earner from the East Indies",
    lore: "Cinnamon, nutmeg, and cloves — worth more than gold in the courts of Europe. The Dutch East India Company built an empire on these tiny pods. Entire wars were fought over the Banda Islands. A single sack could buy a house in Amsterdam." },
  { id: "silk", name: "Fine Silk", short: "Silk", emoji: "🧵", base: 0.10, vol: 0.03, shares: 300000,
    desc: "Low risk, slow and steady",
    lore: "For a thousand years, China guarded the silkworm's secret with a death sentence. The Silk Road stretched 4,000 miles — every yard that reached Venice survived bandits, deserts, and mountain passes. Silk funds kingdoms." },
  { id: "rum", name: "Caribbean Rum", short: "Rum", emoji: "🍺", base: 0.10, vol: 0.12, shares: 800000,
    desc: "Wild swings, big rewards",
    lore: "Born in the sugar plantations of Barbados, rum became the currency of the Atlantic. Pirates demanded it, navies rationed it. Every bottle tells a story of paradise and exploitation. Volatile as the seas that carry it." },
  { id: "gems", name: "Gemstones", short: "Gems", emoji: "💎", base: 0.10, vol: 0.08, shares: 150000,
    desc: "High value, moderate risk",
    lore: "The Golconda mines produced the Hope Diamond and the Koh-i-Noor. Gemstones are portable wealth — a fortune in your pocket. But every diamond carries a curse, and every ruby has a price paid in blood." },
  { id: "parrots", name: "Rare Parrots", short: "Parrots", emoji: "🦜", base: 0.10, vol: 0.20, shares: 1000000,
    desc: "The meme commodity. Pure chaos.",
    lore: "It started as a dock workers' joke. Then London aristocrats decided exotic birds were fashionable. Then a countess paid 200 gold for a macaw that recited Shakespeare. The parrot bubble is either genius or madness." },
  { id: "cannons", name: "Cannons & Arms", short: "Cannons", emoji: "⚔️", base: 0.10, vol: 0.05, shares: 250000,
    desc: "War economy staple",
    lore: "Swedish iron forged in Dutch foundries, sold to English privateers, aimed at Spanish galleons. Wars end, but the threat of war never does. The safest investment in an unsafe world." },
  { id: "tulips", name: "Tulip Bulbs", short: "Tulips", emoji: "🌷", base: 0.10, vol: 0.30, shares: 2000000,
    desc: "Speculative mania. To the moon?",
    lore: "Amsterdam, 1637. A single Semper Augustus sold for more than a canal house. It's not about the flower — it's about what the next person will pay. The bulb doesn't need to bloom. It just needs a buyer." },
];

const BLACK_GOOD = {
  id: "contraband", name: "Smuggled Opium", short: "Opium", emoji: "🖤", base: 0.10, vol: 0.18, shares: 100000,
  desc: "Forbidden. Lucrative. Dangerous.",
  lore: "The East India Company ships it by the ton. The Emperor banned it. Fortunes are made in the shadows of Macau and Canton. If you're reading this, you've already chosen a side."
};
const ALL_GOODS = [...COMMODITIES, BLACK_GOOD];

const DAILY_BASE = 100, STREAK_BONUS = 10, STREAK_7_BONUS = 50;
const INITIAL_SUPPLY = 10000;
const BANK_SAVE_RATE = 0.015, BANK_LOAN_RATE = 0.05, MAX_LOAN_MULT = 3, LOAN_DEADLINE = 5;
const BANK_UNLOCK_NW = 1000;
const TICK_MS = 15000, EVENT_CHANCE = 0.06;
const OFFERING_THRESHOLD = 0.10, OFFERING_AMOUNT = 0.20;
const TRADE_FEE = 0.003; // 0.3% fee on every trade
const SHORT_COLLATERAL = 1.5; // 150% collateral required
const SHORT_MARGIN_CALL = 0.9; // liquidate when collateral covers only 90% of loss
const SHORT_BORROW_RATE = 0.008; // 0.8% daily borrow fee on shorts
const TRADE_COOLDOWN = 2000; // 2s between trades

// Inflation scales with economy size — each claim "grows" the baseline
// so 500 players claiming daily doesn't cause 5000% inflation
function getInflationFactor(moneySupply, totalClaims) {
  const baselineEconomy = INITIAL_SUPPLY + (totalClaims || 0) * (DAILY_BASE * 0.8);
  return moneySupply / baselineEconomy;
}

const LEAGUES = [
  { id: "driftwood", name: "Driftwood", emoji: "🪵", min: 0, max: 500, col: "#8B7355" },
  { id: "bronze", name: "Bronze", emoji: "🥉", min: 500, max: 2000, col: "#CD7F32" },
  { id: "silver", name: "Silver", emoji: "🥈", min: 2000, max: 8000, col: "#8a8a8a" },
  { id: "gold", name: "Gold", emoji: "🥇", min: 8000, max: 30000, col: "#b8860b" },
  { id: "diamond", name: "Diamond", emoji: "💎", min: 30000, max: 100000, col: "#4a90d9" },
  { id: "legend", name: "Legendary", emoji: "👑", min: 100000, max: Infinity, col: "#a0382a" },
];

const EVENTS = [
  { title: "Typhoon in the Spice Islands", desc: "Storm destroyed cargo. Supply decimated.", targets: ["spice"], eff: 0.20, emoji: "🌊" },
  { title: "War in the Colonies", desc: "The Crown declared war. Arms demand surges.", targets: ["cannons"], eff: 0.18, emoji: "⚔️" },
  { title: "Plague on the Silk Road", desc: "Caravans halted. Silk supply dries up.", targets: ["silk"], eff: 0.15, emoji: "☠️" },
  { title: "Rum Flotilla Arrives", desc: "Massive convoy docked. Market flooded.", targets: ["rum"], eff: -0.18, emoji: "🍺" },
  { title: "Royal Court Trend", desc: "The Queen has a parrot. Every noble wants one.", targets: ["parrots"], eff: 0.25, emoji: "👑" },
  { title: "New Gem Mine Found", desc: "Massive ruby deposit in Burma.", targets: ["gems"], eff: -0.15, emoji: "⛏️" },
  { title: "Tulip Fever Spreads!", desc: "'Bulbs will replace gold!' — street pamphlet", targets: ["tulips"], eff: 0.30, emoji: "🌷" },
  { title: "Tulip Market Panic", desc: "Prominent merchant can't sell. Everyone dumps.", targets: ["tulips"], eff: -0.25, emoji: "📉" },
  { title: "Pirate Fleet Raids Convoy", desc: "Armada intercepted a trade fleet.", targets: ["spice", "silk", "gems"], eff: 0.10, emoji: "🏴‍☠️" },
  { title: "Peace Treaty Signed", desc: "War's over. Arms stockpiles unwanted.", targets: ["cannons"], eff: -0.15, emoji: "🕊️" },
  { title: "Harbour Raid", desc: "Authorities seized opium. Street price soars.", targets: ["contraband"], eff: 0.22, emoji: "🚨" },
  { title: "Golden Age of Trade", desc: "Prosperity! All markets rally.", targets: ["spice", "silk", "rum", "gems", "cannons"], eff: 0.06, emoji: "☀️" },
  { title: "Monsoon Failure", desc: "Crops failed. Luxury demand collapses.", targets: ["gems", "parrots", "tulips"], eff: -0.10, emoji: "🏜️" },
  { title: "Spice Oversupply", desc: "Bumper harvest floods the market.", targets: ["spice"], eff: -0.12, emoji: "📦" },
  { title: "Parrot Plague", desc: "Disease sweeps parrots. Survivors are rare.", targets: ["parrots"], eff: 0.20, emoji: "🦠" },
  // New balanced events
  { title: "Silk Warehouse Fire", desc: "Massive stockpile destroyed in Canton.", targets: ["silk"], eff: -0.14, emoji: "🔥" },
  { title: "New Silk Route Opens", desc: "Overland passage through Persia discovered.", targets: ["silk"], eff: -0.12, emoji: "🐪" },
  { title: "Arms Embargo", desc: "Parliament banned weapons exports.", targets: ["cannons"], eff: -0.18, emoji: "🚫" },
  { title: "Colonial Revolt", desc: "Settlers seize armories. Weapons worthless.", targets: ["cannons"], eff: -0.12, emoji: "🏴" },
  { title: "Opium Shipment Arrives", desc: "Massive haul from Bengal docks quietly.", targets: ["contraband"], eff: -0.15, emoji: "🚢" },
  { title: "Crackdown Fails", desc: "Corrupt officials look the other way. Opium flows.", targets: ["contraband"], eff: -0.10, emoji: "💰" },
  { title: "Parrot Fashion Fades", desc: "The Queen got a cat. Birds are passé.", targets: ["parrots"], eff: -0.18, emoji: "🐱" },
  { title: "Gem Counterfeit Scandal", desc: "Fake rubies flood the market. Trust erodes.", targets: ["gems"], eff: -0.12, emoji: "🔍" },
  { title: "Market Crash", desc: "Panic selling across all commodities.", targets: ["spice", "silk", "rum", "gems", "cannons", "tulips"], eff: -0.08, emoji: "💥" },
  { title: "Rum Shortage", desc: "Caribbean storms destroyed sugar fields.", targets: ["rum"], eff: 0.22, emoji: "⛈️" },
];

const CLAIM_MSGS = [
  { icon: "💰", text: "Plundered a merchant vessel" }, { icon: "🏴‍☠️", text: "Raided a coastal village" },
  { icon: "🗺️", text: "Found buried treasure" }, { icon: "⚓", text: "Taxed the harbour" },
  { icon: "🦜", text: "Sold secrets to the governor" }, { icon: "🍺", text: "Won a tavern bet" },
  { icon: "🏝️", text: "Salvaged a shipwreck" }, { icon: "👑", text: "Collected tribute" },
  { icon: "📜", text: "Cashed a letter of marque" }, { icon: "🎲", text: "Lucky night at dice" },
];

// ═══════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════

function getToday() { return new Date().toISOString().split("T")[0]; }
function getLaunchDate() { return new Date("2026-02-28T00:00:00-05:00"); }
function getCurrentDay() { const now = new Date(); const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" })); const launch = new Date(getLaunchDate().toLocaleString("en-US", { timeZone: "America/New_York" })); return Math.floor((et - launch) / 86400000) + 1; }
function getTimeUntilReset() { const now = new Date(); const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" })); const mid = new Date(et); mid.setHours(24,0,0,0); const d = mid - et; return { h: Math.floor(d/3600000), m: Math.floor((d%3600000)/60000), s: Math.floor((d%60000)/1000) }; }
function getLeague(n) { return LEAGUES.find(l => n >= l.min && n < l.max) || LEAGUES[0]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function initMarket() {
  const c = {};
  const now = Date.now();
  ALL_GOODS.forEach(g => {
    // Seed a few points so charts aren't a single dot on fresh market
    const snaps = [];
    let p = g.base;
    for (let i = 20; i >= 0; i--) {
      const noise = (Math.random() - 0.5) * p * 0.001;
      p = Math.max(0.0001, p + noise);
      snaps.push({ t: now - i * TICK_MS, p: +p.toFixed(6) });
    }
    c[g.id] = {
      last: +p.toFixed(6), volume: 0,
      totalShares: g.shares,
      bankHeld: g.shares,
      playerHeld: 0,
      snaps,
    };
  });
  return {
    commodities: c, moneySupply: INITIAL_SUPPLY, totalClaims: 0,
    bankReserves: INITIAL_SUPPLY * 2, lastTick: now, lastEvent: 0,
    offerings: [],
  };
}

// Spread based on supply scarcity — tighter when bank has lots, wider when scarce
function getSpread(price, vol, bankHeld, totalShares) {
  const bankRatio = bankHeld / totalShares; // 1 = bank has all (liquid), 0 = sold out (illiquid)
  const liquidityFactor = 0.5 + (1 - bankRatio) * 1.5; // 0.5x (very liquid) to 2x (scarce)
  const halfSpread = price * (0.01 + vol * 0.04) * liquidityFactor;
  return { bid: +(price - halfSpread).toFixed(6), ask: +(price + halfSpread).toFixed(6) };
}

// Price impact: larger when bank inventory is low (supply squeeze)
function calcImpact(qty, bankHeld, totalShares, price, isBuy) {
  // Base impact: proportion of remaining bank inventory (for buys) or total (for sells)
  const pool = isBuy ? Math.max(bankHeld, 1) : totalShares;
  const proportion = qty / pool;
  // Impact scales with scarcity: buying last 10% of inventory = huge impact
  const scarcity = isBuy ? Math.max(1, 2 - (bankHeld / totalShares) * 2) : 1;
  const impact = proportion * scarcity * price * 1.5;
  return isBuy ? impact : -impact;
}

function doTick(mk, playerCount) {
  const m = JSON.parse(JSON.stringify(mk));
  const now = Date.now();
  // Dynamic noise: more volatile when fewer players (their trades aren't moving prices enough)
  // At 1 player: 8x noise. At 100+: 1x noise. Smooth curve.
  const noiseMult = Math.max(1, 8 - Math.log2(Math.max(playerCount || 1, 1)) * 1.05);
  
  ALL_GOODS.forEach(g => {
    const cd = m.commodities[g.id]; if (!cd) return;
    const fv = g.base * getInflationFactor(m.moneySupply, m.totalClaims);
    
    // Adaptive gravity — gentle normally, stronger when price diverges wildly
    const ratio = cd.last / Math.max(fv, 0.0001);
    const isExtreme = ratio > 3 || ratio < 0.33;
    const gravityStr = isExtreme ? 0.003 : 0.0005; // 6x stronger when extreme
    const gravity = (fv - cd.last) * gravityStr;
    // Dynamic noise — more movement when fewer players are trading
    const noise = (Math.random() - 0.5) * cd.last * 0.001 * noiseMult;
    // Occasional micro-trend: small momentum bursts so charts look alive
    const trend = Math.random() < 0.03 ? (Math.random() - 0.5) * cd.last * 0.005 * noiseMult : 0;
    cd.last = clamp(+(cd.last + gravity + noise + trend).toFixed(6), 0.0001, 999999);
    
    // Snapshot
    cd.snaps = [...(cd.snaps || []), { t: now, p: cd.last }];
    if (cd.snaps.length > 2500) cd.snaps = cd.snaps.slice(-2500);
    
    // Check if bank should do a share offering (< 10% inventory remaining)
    if (cd.bankHeld < cd.totalShares * OFFERING_THRESHOLD && cd.totalShares < g.shares * 3) {
      const newShares = Math.floor(cd.totalShares * OFFERING_AMOUNT);
      cd.totalShares += newShares;
      cd.bankHeld += newShares;
      // Offering dilutes price slightly
      cd.last = +(cd.last * 0.92).toFixed(6);
      m.offerings = [...(m.offerings || []), { t: now, good: g.id, shares: newShares }];
    }
  });

  // Random event — effects scale with market size (fewer players = smaller events)
  let event = null;
  const eventScale = Math.min(1, 0.4 + Math.log10(Math.max(playerCount || 1, 1)) / 3.5);
  if (Math.random() < EVENT_CHANCE && now - (m.lastEvent || 0) > 90000) {
    event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
    event.targets.forEach(tid => {
      const cd = m.commodities[tid]; if (!cd) return;
      cd.last = clamp(+(cd.last * (1 + event.eff * eventScale)).toFixed(6), 0.0001, 999999);
      cd.snaps = [...(cd.snaps || []), { t: now, p: cd.last }];
    });
    m.lastEvent = now;
  }
  m.lastTick = now;
  return { market: m, event };
}

async function loadS(k, sh = false) { try { const r = await window.storage.get(k, sh); return r?.value ? JSON.parse(r.value) : null; } catch { return null; } }
async function saveS(k, d, sh = false) { try { await window.storage.set(k, JSON.stringify(d), sh); } catch (e) { console.error(e); } }

function filterSnaps(snaps, t) {
  const now = Date.now();
  const r = { "1D": 864e5, "1W": 6048e5, "1M": 2592e6, "ALL": Infinity }[t] || 864e5;
  let f = r === Infinity ? snaps : snaps.filter(s => now - s.t < r);
  if (!f.length && snaps.length) f = snaps;
  if (f.length > 80) { const step = Math.ceil(f.length / 80); f = f.filter((_, i) => i % step === 0 || i === f.length - 1); }
  return f;
}

function dailyAmt(streak) {
  let a = DAILY_BASE;
  const s = Math.min(streak || 0, 7);
  if (s > 1 && s < 7) a += (s - 1) * STREAK_BONUS;
  if (s >= 7) a += 6 * STREAK_BONUS + STREAK_7_BONUS;
  return a;
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export default function Market({ autoSignIn, onSignOut }) {
  const [ready, setReady] = useState(false);
  const [mk, setMk] = useState(null);
  const [pl, setPl] = useState(null);
  const [lb, setLb] = useState([]);
  const [tab, setTab] = useState("market");
  const [sel, setSel] = useState(null);
  const [showLore, setShowLore] = useState(false);
  const [tQty, setTQty] = useState("");
  const [tMode, setTMode] = useState("buy");
  const [tfr, setTfr] = useState("1D");
  const [claim, setClaim] = useState(null);
  const [info, setInfo] = useState(false);
  const [nameIn, setNameIn] = useState("");
  const [notif, setNotif] = useState(null);
  const [bTab, setBTab] = useState("savings");
  const [bAmt, setBAmt] = useState("");
  const [eventPop, setEventPop] = useState(null);
  const [bm, setBm] = useState(false);
  const [eggN, setEggN] = useState(0);
  const [dayClock, setDayClock] = useState({ h: 0, m: 0, s: 0 });
  const [showLeagues, setShowLeagues] = useState(false);
  const [lastTrade, setLastTrade] = useState(0);
  const [tradeLog, setTradeLog] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);
  const [audioOn, setAudioOn] = useState(true);
  const audioStarted = useRef(false);
  const nRef = useRef(null);

  // Shared server prices from Supabase
  const sharedPrices = useSharedPrices(true);

  const notify = useCallback((m, t = "info", sfx) => {
    clearTimeout(nRef.current); setNotif({ m, t });
    nRef.current = setTimeout(() => setNotif(null), 3500);
    if (sfx) AudioEngine.playSfx(sfx);
    else if (t === "error") AudioEngine.playSfx("error");
  }, []);

  const localPrices = mk ? Object.fromEntries(ALL_GOODS.map(g => [g.id, mk.commodities[g.id]?.last || 0.10])) : {};
  const prices = sharedPrices ? Object.fromEntries(ALL_GOODS.map(g => [g.id, sharedPrices[g.id]?.price || localPrices[g.id] || 0.10])) : localPrices;
  const calcNW = useCallback((p) => {
    if (!p || !mk) return 0;
    let t = (p.wallet || 0) + (p.savings || 0);
    Object.entries(p.holdings || {}).forEach(([id, q]) => { t += q * (prices[id] || 0); });
    // Short positions: collateral is already out of wallet, P&L = (entry - current) * qty
    Object.entries(p.shorts || {}).forEach(([id, s]) => {
      t += (s.collateral || 0) + (s.entry - (prices[id] || 0)) * s.qty;
    });
    return +(t - (p.loan || 0)).toFixed(2);
  }, [mk, prices]);

  const ms = mk?.moneySupply || INITIAL_SUPPLY;
  const infF = getInflationFactor(ms, mk?.totalClaims || 0);
  const pp = +(1 / infF).toFixed(4);
  const nw = pl ? calcNW(pl) : 0;
  const league = getLeague(nw);
  const holdVal = pl ? Object.entries(pl.holdings || {}).reduce((s, [id, q]) => s + q * (prices[id] || 0), 0) : 0;
  const shortVal = pl ? Object.entries(pl.shorts || {}).reduce((s, [id, sh]) => s + (sh.entry - (prices[id] || 0)) * sh.qty, 0) : 0;
  const bankUnlocked = pl?.bankUnlocked || false;

  const syncLb = useCallback(async (p, m) => {
    if (!p?.name) return;
    let players = [];
    try { const d = await loadS("mkt-lb-v13", true); if (d) players = d.players || []; } catch {}
    const n = (() => { let t = (p.wallet || 0) + (p.savings || 0); Object.entries(p.holdings || {}).forEach(([id, q]) => { t += q * (m?.commodities?.[id]?.last || 0.10); }); Object.entries(p.shorts || {}).forEach(([id, s]) => { t += (s.collateral || 0) + (s.entry - (m?.commodities?.[id]?.last || 0.10)) * s.qty; }); return +(t - (p.loan || 0)).toFixed(2); })();
    const idx = players.findIndex(x => x.name === p.name);
    const entry = { name: p.name, netWorth: n, league: getLeague(n).id, updated: Date.now() };
    if (idx >= 0) players[idx] = entry; else players.push(entry);
    players.sort((a, b) => b.netWorth - a.netWorth);
    await saveS("mkt-lb-v13", { players: players.slice(0, 100) }, true);
    setLb(players.slice(0, 100));
  }, []);

  const handleEgg = useCallback(() => {
    const n = eggN + 1; setEggN(n);
    if (n >= 7 && !bm) {
      setBm(true);
      if (pl) { const u = { ...pl, bm: true }; setPl(u); saveS("mkt-player-v13", u); }
      // Increment BM player count on shared market
      if (mk) { const m = { ...mk, bmPlayers: (mk.bmPlayers || 0) + 1 }; setMk(m); saveS("mkt-data-v13", m, true); }
      notify("🖤 The Black Market has opened...", "success");
    } else if (n >= 4 && n < 7 && !bm) notify(`${7 - n} more...`, "info");
  }, [eggN, bm, pl]);

  // ═══ INIT ═══
  useEffect(() => {
    (async () => {
      let m = await loadS("mkt-data-v13", true);
      if (!m?.commodities) { m = initMarket(); await saveS("mkt-data-v13", m, true); }
      ALL_GOODS.forEach(g => {
        if (!m.commodities[g.id]) m.commodities[g.id] = { last: g.base, volume: 0, totalShares: g.shares, bankHeld: g.shares, playerHeld: 0, snaps: [{ t: Date.now(), p: g.base }] };
        // Migration: ensure new fields exist
        const cd = m.commodities[g.id];
        if (cd.bankHeld === undefined) { cd.bankHeld = g.shares - (cd.circulating || cd.playerHeld || 0); cd.playerHeld = cd.circulating || cd.playerHeld || 0; cd.totalShares = cd.totalShares || g.shares; }
      });
      setMk(m);
      const l = await loadS("mkt-lb-v13", true); if (l?.players) setLb(l.players);
      const p = await loadS("mkt-player-v13");
      if (p?.name) {
        setPl(p); setNameIn(p.name); if (p.bm) setBm(true);
        const today = getToday();
        if (p.lastClaim !== today) {
          const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split("T")[0]; })();
          const streak = p.lastClaim === yesterday ? Math.min((p.streak || 0) + 1, 7) : 1;
          const amt = dailyAmt(streak);
          const interest = +((p.savings || 0) * BANK_SAVE_RATE).toFixed(2);
          const loanInt = +((p.loan || 0) * BANK_LOAN_RATE).toFixed(2);
          const loginCount = (p.loginCount || 0) + 1;
          let up = { ...p, wallet: +((p.wallet || 0) + amt).toFixed(2), savings: +((p.savings || 0) + interest).toFixed(2), loan: +((p.loan || 0) + loanInt).toFixed(2), lastClaim: today, streak, loginCount, totalClaimed: +((p.totalClaimed || 0) + amt).toFixed(2) };
          
          // Short borrow fees — daily cost to maintain shorts
          if (up.shorts && Object.keys(up.shorts).length > 0) {
            let shortFees = 0;
            Object.entries(up.shorts).forEach(([id, s]) => {
              const price = m.commodities[id]?.last || 0.10;
              const fee = +(s.qty * price * SHORT_BORROW_RATE).toFixed(4);
              shortFees += fee;
            });
            up.wallet = +(up.wallet - shortFees).toFixed(2);
          }
          
          // Check bank unlock
          const tempNW = (() => { let t = up.wallet + (up.savings || 0); Object.entries(up.holdings || {}).forEach(([id, q]) => { t += q * (m.commodities[id]?.last || 0.10); }); return t - (up.loan || 0); })();
          if (!up.bankUnlocked && tempNW >= BANK_UNLOCK_NW) up.bankUnlocked = true;
          
          // Loan deadline
          let loanForced = false;
          if (up.loan > 0 && up.loanDay && loginCount - up.loanDay >= LOAN_DEADLINE) {
            loanForced = true;
            // 1. Use wallet
            const repW = Math.min(up.wallet, up.loan); up.wallet = +(up.wallet - repW).toFixed(2); up.loan = +(up.loan - repW).toFixed(2);
            // 2. Use savings
            if (up.loan > 0) { const repS = Math.min(up.savings || 0, up.loan); up.savings = +((up.savings || 0) - repS).toFixed(2); up.loan = +(up.loan - repS).toFixed(2); }
            // 3. Sell holdings
            if (up.loan > 0) {
              for (const [id, qty] of Object.entries(up.holdings || {})) {
                if (up.loan <= 0) break;
                const pr = m.commodities[id]?.last || 0.10;
                const sq = Math.min(qty, Math.ceil(up.loan / pr));
                up.loan = Math.max(0, +(up.loan - sq * pr).toFixed(2));
                up.holdings[id] = qty - sq; if (up.holdings[id] <= 0) delete up.holdings[id];
                if (m.commodities[id]) { m.commodities[id].bankHeld = (m.commodities[id].bankHeld || 0) + sq; m.commodities[id].playerHeld = Math.max(0, (m.commodities[id].playerHeld || 0) - sq); }
              }
            }
            // 4. Force-close shorts and reclaim collateral
            if (up.loan > 0 && up.shorts) {
              for (const [id, s] of Object.entries(up.shorts)) {
                if (up.loan <= 0) break;
                const repC = Math.min(s.collateral, up.loan);
                up.loan = Math.max(0, +(up.loan - repC).toFixed(2));
                if (m.commodities[id]) { m.commodities[id].bankHeld += s.qty; m.commodities[id].playerHeld = Math.max(0, m.commodities[id].playerHeld - s.qty); }
                delete up.shorts[id];
              }
            }
            up.loan = 0; up.loanDay = null;
          }
          
          // Snapshot NW for portfolio chart
          const claimNW = (() => { let t = up.wallet + (up.savings || 0); Object.entries(up.holdings || {}).forEach(([id, q]) => { t += q * (m.commodities[id]?.last || 0.10); }); Object.entries(up.shorts || {}).forEach(([id, s]) => { t += (s.collateral || 0) + (s.entry - (m.commodities[id]?.last || 0.10)) * s.qty; }); return +(t - (up.loan || 0)).toFixed(2); })();
          up.nwHistory = [...(up.nwHistory || []).slice(-200), { t: Date.now(), v: claimNW }];
          
          setPl(up); await saveS("mkt-player-v13", up);
          m.moneySupply = +(m.moneySupply + amt).toFixed(2); m.totalClaims = (m.totalClaims || 0) + 1;
          await saveS("mkt-data-v13", m, true); setMk({ ...m });
          const msg = CLAIM_MSGS[Math.floor(Math.random() * CLAIM_MSGS.length)];
          setClaim({ ...msg, amt, streak, interest, loanInt, loanForced });
          AudioEngine.playSfx("claim");
        }
        await syncLb(p, m);
      }
      setReady(true);
      if (!p && autoSignIn) { setNameIn(autoSignIn); }
    })();
  }, []);

  // Auto sign-in from Supabase auth
  useEffect(() => {
    if (ready && !pl && autoSignIn && nameIn === autoSignIn) {
      signIn();
    }
  }, [ready, nameIn, autoSignIn]);

  // ═══ TICK ═══
  useEffect(() => {
    if (!ready || !mk) return;
    const iv = setInterval(async () => {
      let m = await loadS("mkt-data-v13", true); if (!m) return;
      ALL_GOODS.forEach(g => { if (!m.commodities[g.id]) m.commodities[g.id] = { last: g.base, volume: 0, totalShares: g.shares, bankHeld: g.shares, playerHeld: 0, snaps: [{ t: Date.now(), p: g.base }] }; });
      const { market: nm, event } = doTick(m, lb.length);
      setMk(nm); await saveS("mkt-data-v13", nm, true);
      if (event) { setEventPop(event); AudioEngine.playSfx("event"); }
      // Sync leaderboard with latest prices
      if (pl?.name) await syncLb(pl, nm);
      // Margin call check on shorts
      if (pl?.shorts && Object.keys(pl.shorts).length > 0) {
        let p = { ...pl }, liquidated = false;
        Object.entries(p.shorts).forEach(([id, s]) => {
          const price = nm.commodities[id]?.last || 0.10;
          const loss = (price - s.entry) * s.qty; // positive = losing money
          if (loss > s.collateral * SHORT_MARGIN_CALL) {
            // Margin call — force close
            const closeCost = s.qty * price;
            p.wallet = +(p.wallet + s.collateral - Math.max(0, loss)).toFixed(4);
            const shorts = { ...(p.shorts || {}) }; delete shorts[id]; p.shorts = shorts;
            if (nm.commodities[id]) { nm.commodities[id].bankHeld += s.qty; nm.commodities[id].playerHeld = Math.max(0, nm.commodities[id].playerHeld - s.qty); }
            liquidated = true;
          }
        });
        if (liquidated) { setPl(p); await saveS("mkt-player-v13", p); notify("📉 Margin call! Short position liquidated", "error"); }
      }
      // Check bank unlock
      if (pl && !pl.bankUnlocked) {
        const nwNow = calcNW(pl);
        if (nwNow >= BANK_UNLOCK_NW) {
          const up = { ...pl, bankUnlocked: true }; setPl(up); await saveS("mkt-player-v13", up);
          notify("🏦 The Bank is now open to you!", "success");
        }
      }
    }, TICK_MS);
    // Fast cosmetic price jitter — visual only, every 1s between real ticks
    const jitter = setInterval(() => {
      setMk(prev => {
        if (!prev) return prev;
        const m = { ...prev, commodities: { ...prev.commodities } };
        ALL_GOODS.forEach(g => {
          const cd = m.commodities[g.id]; if (!cd) return;
          const noise = (Math.random() - 0.5) * cd.last * 0.0008;
          m.commodities[g.id] = { ...cd, last: +Math.max(0.0001, cd.last + noise).toFixed(6) };
        });
        return m;
      });
    }, 1000);
    return () => { clearInterval(iv); clearInterval(jitter); };
  }, [ready, !!mk, pl?.bankUnlocked]);

  // ═══ SIGN IN ═══
  const signIn = async () => {
    const name = nameIn.trim().slice(0, 24);
    if (name.length < 2) { notify("Name too short", "error"); return; }
    // Check for duplicate names on leaderboard
    const existing = lb.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (existing) { notify("Name taken — try another", "error"); return; }
    const p = { name, wallet: DAILY_BASE, holdings: {}, costBasis: {}, shorts: {}, savings: 0, loan: 0, loanDay: null, lastClaim: getToday(), streak: 1, loginCount: 1, bm: false, bankUnlocked: false, totalClaimed: DAILY_BASE, nwHistory: [{ t: Date.now(), v: DAILY_BASE }] };
    setPl(p); await saveS("mkt-player-v13", p);
    const m = { ...mk, moneySupply: +(mk.moneySupply + DAILY_BASE).toFixed(2), totalClaims: (mk.totalClaims || 0) + 1 };
    setMk(m); await saveS("mkt-data-v13", m, true); await syncLb(p, m);
    setClaim({ ...CLAIM_MSGS[Math.floor(Math.random() * CLAIM_MSGS.length)], amt: DAILY_BASE, streak: 1, interest: 0, loanInt: 0 });
    AudioEngine.playSfx("claim");
  };

  const signOut = async () => {
    try { await window.storage.delete("mkt-player-v13"); } catch {}
    setPl(null); setNameIn(""); setSel(null); setTab("market"); setBm(false); setEggN(0); setTradeLog([]); if (onSignOut) onSignOut();
  };

  // ═══ TRADE — buys from bank inventory, sells back to bank ═══
  const doTrade = async () => {
    if (!pl || !sel || !mk) return;
    // Cooldown check
    if (Date.now() - lastTrade < TRADE_COOLDOWN) { notify("Wait a moment...", "info"); return; }
    const q = parseInt(tQty); if (!q || q <= 0) { notify("Invalid qty", "error"); return; }
    const g = sel;
    const cd = mk.commodities[g.id];
    const { bid, ask } = getSpread(cd.last, g.vol, cd.bankHeld, cd.totalShares);
    const m = JSON.parse(JSON.stringify(mk));
    const p = { ...pl };
    const mcd = m.commodities[g.id];

    if (tMode === "buy") {
      if (q > mcd.bankHeld) { notify(`Only ${mcd.bankHeld.toLocaleString()} available`, "error"); return; }
      const cost = +(q * ask).toFixed(4);
      const fee = +(cost * TRADE_FEE).toFixed(4);
      const total = +(cost + fee).toFixed(4);
      if (total > p.wallet) { notify(`Need ${total.toFixed(2)} ÐC (incl. fee), have ${p.wallet.toFixed(2)}`, "error"); return; }
      
      p.wallet = +(p.wallet - total).toFixed(4);
      const prevQty = p.holdings[g.id] || 0;
      const prevCost = (p.costBasis || {})[g.id] || 0;
      p.holdings = { ...p.holdings, [g.id]: prevQty + q };
      p.costBasis = { ...(p.costBasis || {}), [g.id]: prevQty + q > 0 ? +((prevCost * prevQty + total) / (prevQty + q)).toFixed(6) : ask };
      mcd.bankHeld -= q;
      mcd.playerHeld += q;
      m.bankReserves = +(m.bankReserves + total).toFixed(4);
      
      // Price impact — bigger when bank inventory is low
      const impact = calcImpact(q, mcd.bankHeld + q, mcd.totalShares, cd.last, true);
      mcd.last = clamp(+(cd.last + impact).toFixed(6), 0.0001, 999999);
      mcd.volume = (cd.volume || 0) + q;
      notify(`Bought ${q} ${g.name} @ ${ask.toFixed(4)}`, "success", "buy");
    } else if (tMode === "sell") {
      const held = p.holdings[g.id] || 0;
      if (q > held) { notify(`Only holding ${held}`, "error"); return; }
      const revenue = +(q * bid).toFixed(4);
      const fee = +(revenue * TRADE_FEE).toFixed(4);
      const net = +(revenue - fee).toFixed(4);
      if (revenue > m.bankReserves) { notify("Insufficient market liquidity", "error"); return; }
      
      p.wallet = +(p.wallet + net).toFixed(4);
      p.holdings = { ...p.holdings, [g.id]: held - q };
      if (p.holdings[g.id] <= 0) { delete p.holdings[g.id]; const cb = { ...(p.costBasis || {}) }; delete cb[g.id]; p.costBasis = cb; }
      mcd.bankHeld += q;
      mcd.playerHeld = Math.max(0, mcd.playerHeld - q);
      m.bankReserves = +(m.bankReserves - revenue + fee).toFixed(4);
      
      const impact = calcImpact(q, mcd.bankHeld - q, mcd.totalShares, cd.last, false);
      mcd.last = clamp(+(cd.last + impact).toFixed(6), 0.0001, 999999);
      mcd.volume = (cd.volume || 0) + q;
      notify(`Sold ${q} ${g.name} @ ${bid.toFixed(4)}`, "success", "sell");
    } else if (tMode === "short") {
      // Open a short position — borrow shares from bank, sell immediately
      if (!p.bankUnlocked) { notify("Unlock the Bank first (1,000 ÐC NW)", "error"); return; }
      if (q > mcd.bankHeld) { notify(`Only ${mcd.bankHeld.toLocaleString()} available to short`, "error"); return; }
      const proceeds = +(q * bid).toFixed(4);
      const collateral = +(proceeds * SHORT_COLLATERAL).toFixed(4);
      if (collateral > p.wallet) { notify(`Need ${collateral.toFixed(2)} ÐC collateral (${(SHORT_COLLATERAL * 100).toFixed(0)}%)`, "error"); return; }
      const fee = +(proceeds * TRADE_FEE).toFixed(4);
      
      p.wallet = +(p.wallet - collateral + proceeds - fee).toFixed(4);
      const existing = (p.shorts || {})[g.id];
      const prevQty = existing?.qty || 0;
      const prevEntry = existing?.entry || 0;
      const prevColl = existing?.collateral || 0;
      const newQty = prevQty + q;
      const newEntry = newQty > 0 ? +((prevEntry * prevQty + bid * q) / newQty).toFixed(6) : bid;
      p.shorts = { ...(p.shorts || {}), [g.id]: { qty: newQty, entry: newEntry, collateral: +(prevColl + collateral).toFixed(4) } };
      
      mcd.bankHeld -= q;
      mcd.playerHeld += q;
      m.bankReserves = +(m.bankReserves + fee).toFixed(4);
      
      const impact = calcImpact(q, mcd.bankHeld + q, mcd.totalShares, cd.last, false);
      mcd.last = clamp(+(cd.last + impact).toFixed(6), 0.0001, 999999);
      mcd.volume = (cd.volume || 0) + q;
      notify(`Shorted ${q} ${g.name} @ ${bid.toFixed(4)}`, "success", "sell");
    } else if (tMode === "cover") {
      // Close short — buy back shares, return to bank
      const short = (p.shorts || {})[g.id];
      if (!short || short.qty <= 0) { notify("No short position", "error"); return; }
      const coverQty = Math.min(q, short.qty);
      const cost = +(coverQty * ask).toFixed(4);
      const fee = +(cost * TRADE_FEE).toFixed(4);
      const pnl = +((short.entry - ask) * coverQty).toFixed(4);
      const collateralReturn = +(short.collateral * (coverQty / short.qty)).toFixed(4);
      
      p.wallet = +(p.wallet - cost - fee + collateralReturn).toFixed(4);
      const remaining = short.qty - coverQty;
      if (remaining <= 0) {
        const s = { ...(p.shorts || {}) }; delete s[g.id]; p.shorts = s;
      } else {
        p.shorts = { ...(p.shorts || {}), [g.id]: { ...short, qty: remaining, collateral: +(short.collateral - collateralReturn).toFixed(4) } };
      }
      
      mcd.bankHeld += coverQty;
      mcd.playerHeld = Math.max(0, mcd.playerHeld - coverQty);
      m.bankReserves = +(m.bankReserves + fee).toFixed(4);
      
      const impact = calcImpact(coverQty, mcd.bankHeld - coverQty, mcd.totalShares, cd.last, true);
      mcd.last = clamp(+(cd.last + impact).toFixed(6), 0.0001, 999999);
      mcd.volume = (cd.volume || 0) + coverQty;
      notify(`Covered ${coverQty} ${g.name} @ ${ask.toFixed(4)} (${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)})`, pnl >= 0 ? "success" : "error");
    }
    
    mcd.snaps = [...(cd.snaps || []), { t: Date.now(), p: mcd.last }];
    
    // Check bank unlock after trade
    const tempNW = (() => { let t = p.wallet + (p.savings || 0); Object.entries(p.holdings || {}).forEach(([id, qq]) => { t += qq * (m.commodities[id]?.last || 0.10); }); Object.entries(p.shorts || {}).forEach(([id, s]) => { t += (s.collateral || 0) + (s.entry - (m.commodities[id]?.last || 0.10)) * s.qty; }); return t - (p.loan || 0); })();
    if (!p.bankUnlocked && tempNW >= BANK_UNLOCK_NW) {
      p.bankUnlocked = true;
      notify("🏦 Net worth 1,000! The Bank is now open!", "success");
    }
    
    // Snapshot NW for portfolio chart
    p.nwHistory = [...(p.nwHistory || []).slice(-200), { t: Date.now(), v: +tempNW.toFixed(2) }];
    
    // Log trade
    const logEntry = { t: Date.now(), mode: tMode, good: g.name, emoji: g.emoji, qty: tMode === "cover" ? Math.min(q, (pl.shorts?.[g.id]?.qty || q)) : q, price: tMode === "buy" || tMode === "cover" ? ask : bid };
    setTradeLog(prev => [logEntry, ...prev].slice(0, 20));
    setLastTrade(Date.now());
    
    setMk(m); setPl(p); setTQty("");
    await Promise.all([saveS("mkt-data-v13", m, true), saveS("mkt-player-v13", p), syncLb(p, m)]);
  };

  // ═══ BANK ═══
  const bDeposit = async () => { const a = parseFloat(bAmt); if (!a || a <= 0 || a > pl.wallet) return notify("Invalid", "error"); const p = { ...pl, wallet: +(pl.wallet - a).toFixed(2), savings: +((pl.savings || 0) + a).toFixed(2) }; setPl(p); setBAmt(""); await saveS("mkt-player-v13", p); notify(`Deposited ${a.toFixed(2)}`, "success"); };
  const bWithdraw = async () => { const a = parseFloat(bAmt); if (!a || a <= 0 || a > (pl.savings || 0)) return notify("Invalid", "error"); const p = { ...pl, wallet: +(pl.wallet + a).toFixed(2), savings: +((pl.savings || 0) - a).toFixed(2) }; setPl(p); setBAmt(""); await saveS("mkt-player-v13", p); notify(`Withdrew ${a.toFixed(2)}`, "success"); };
  const bBorrow = async () => {
    const a = parseFloat(bAmt); const mx = Math.max(0, +(nw * MAX_LOAN_MULT - (pl.loan || 0)).toFixed(2));
    if (!a || a <= 0 || a > mx) return notify(`Max: ${mx.toFixed(2)}`, "error");
    if (a > (mk?.bankReserves || 0)) return notify("Insufficient liquidity", "error");
    const p = { ...pl, wallet: +(pl.wallet + a).toFixed(2), loan: +((pl.loan || 0) + a).toFixed(2), loanDay: pl.loanDay || pl.loginCount || 1 };
    const m = { ...mk, bankReserves: +(mk.bankReserves - a).toFixed(2), moneySupply: +(mk.moneySupply + a).toFixed(2) };
    setPl(p); setMk(m); setBAmt("");
    await Promise.all([saveS("mkt-player-v13", p), saveS("mkt-data-v13", m, true)]);
    notify(`Borrowed ${a.toFixed(2)} — ${LOAN_DEADLINE} logins to repay`, "success");
  };
  const bRepay = async () => {
    const a = Math.min(parseFloat(bAmt) || 0, pl.loan || 0, pl.wallet);
    if (!a || a <= 0) return notify("Invalid", "error");
    const newL = +((pl.loan || 0) - a).toFixed(2);
    const p = { ...pl, wallet: +(pl.wallet - a).toFixed(2), loan: newL, loanDay: newL <= 0 ? null : pl.loanDay };
    const m = { ...mk, bankReserves: +(mk.bankReserves + a).toFixed(2) };
    setPl(p); setMk(m); setBAmt("");
    await Promise.all([saveS("mkt-player-v13", p), saveS("mkt-data-v13", m, true)]);
    notify(`Repaid ${a.toFixed(2)}${newL <= 0 ? " — cleared!" : ""}`, "success");
  };

  // ═══ STYLES ═══
  const isDk = tab === "black market" || sel?.id === "contraband";
  
  // Switch music mode based on light/dark theme
  useEffect(() => { if (audioStarted.current && audioOn) AudioEngine.setMode(isDk ? "dark" : "light"); }, [isDk, audioOn]);
  useEffect(() => { const iv = setInterval(() => setDayClock(getTimeUntilReset()), 1000); return () => clearInterval(iv); }, []);

  // Sync shared server prices into local market state
  useEffect(() => {
    if (!sharedPrices || !mk) return;
    const updated = { ...mk, commodities: { ...mk.commodities } };
    Object.entries(sharedPrices).forEach(([id, sp]) => {
      if (updated.commodities[id]) {
        const old = updated.commodities[id];
        updated.commodities[id] = { ...old, last: sp.price, bankHeld: sp.bankHeld, playerHeld: sp.playerHeld, totalShares: sp.totalShares };
        updated.commodities[id].snaps = [...(old.snaps || []), { t: Date.now(), p: sp.price }];
      }
    });
    setMk(updated);
  }, [sharedPrices]);
  
  // Auto-start music on first user interaction (browsers require gesture for AudioContext)
  useEffect(() => {
    if (audioStarted.current) return;
    const start = () => {
      if (audioStarted.current) return;
      audioStarted.current = true;
      AudioEngine.init();
      if (audioOn) { AudioEngine.startMusic(isDk ? "dark" : "light"); AudioEngine.setVolume(0.5); }
      else { AudioEngine.setVolume(0); }
    };
    document.addEventListener("click", start, { once: true });
    document.addEventListener("touchstart", start, { once: true });
    return () => { document.removeEventListener("click", start); document.removeEventListener("touchstart", start); };
  }, []);
  const C = isDk ? {
    bg: "#0d0f14", card: "rgba(22,24,34,0.95)", card2: "rgba(18,20,28,0.98)",
    brd: "rgba(255,255,255,0.08)", brdL: "rgba(255,255,255,0.04)", brdH: "rgba(255,255,255,0.15)",
    txt: "#e0ddd5", txtM: "rgba(220,215,200,0.55)", txtD: "rgba(220,215,200,0.3)", txtF: "rgba(255,255,255,0.15)",
    acc: "rgba(255,255,255,0.25)", g: "#4ade80", gBg: "rgba(74,222,128,0.08)", gB: "rgba(74,222,128,0.2)",
    r: "#f87171", rBg: "rgba(248,113,113,0.08)", rB: "rgba(248,113,113,0.2)",
    bgG: "linear-gradient(170deg,#0d0f14,#161822 40%,#1a1c28)", inp: "rgba(255,255,255,0.04)"
  } : {
    bg: "#f5f0e8", card: "rgba(255,252,245,0.9)", card2: "rgba(245,238,225,0.95)",
    brd: "rgba(120,90,50,0.12)", brdL: "rgba(120,90,50,0.08)", brdH: "rgba(120,90,50,0.25)",
    txt: "#3a2f25", txtM: "rgba(80,60,40,0.55)", txtD: "rgba(80,60,40,0.3)", txtF: "rgba(120,90,50,0.2)",
    acc: "rgba(120,90,50,0.35)", g: "#2d7a3e", gBg: "rgba(34,120,60,0.06)", gB: "rgba(34,120,60,0.2)",
    r: "#a0382a", rBg: "rgba(160,50,40,0.06)", rB: "rgba(160,50,40,0.2)",
    bgG: "linear-gradient(170deg,#f5f0e8,#ede6d8 40%,#e8e0d0)", inp: "rgba(120,90,50,0.03)"
  };
  const ff = "'Crimson Pro', Georgia, serif", ffd = "'Spectral SC', serif";
  const CRD = { background: `linear-gradient(135deg,${C.card},${C.card2})`, border: `1px solid ${C.brd}`, borderRadius: 6, boxShadow: isDk ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 12px rgba(120,90,50,0.05),inset 0 1px 0 rgba(255,255,255,0.5)" };
  const BTN = { border: `1px solid ${C.brd}`, borderRadius: 4, fontFamily: ffd, cursor: "pointer", transition: "all .2s", letterSpacing: 2, background: C.inp };
  const INP = { background: C.inp, border: `1px solid ${C.brd}`, borderRadius: 4, color: C.txt, fontFamily: ff, outline: "none" };

  if (!ready) return (
    <div style={{ background: "linear-gradient(170deg,#f5f0e8,#ede6d8)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ff, flexDirection: "column", gap: 12 }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Spectral+SC:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 48, animation: "float 2s ease-in-out infinite" }}>⚓</div>
      <div style={{ fontFamily: ffd, fontSize: 11, letterSpacing: 4, color: "rgba(80,60,40,0.4)", animation: "breathe 2s ease-in-out infinite" }}>LOADING MARKET</div>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}} @keyframes breathe{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
    </div>
  );

  return (
    <div style={{ background: C.bgG, minHeight: "100vh", fontFamily: ff, color: C.txt, position: "relative", transition: "background .6s ease, color .4s ease" }}>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Spectral+SC:wght@400;500;600;700&display=swap" rel="stylesheet" />
      {!isDk && <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.3, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")` }} />}

      {notif && <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 200, padding: "10px 22px", borderRadius: 6, background: notif.t === "success" ? C.gBg : notif.t === "error" ? C.rBg : C.card, border: `1px solid ${notif.t === "success" ? C.gB : notif.t === "error" ? C.rB : C.brd}`, color: notif.t === "success" ? C.g : notif.t === "error" ? C.r : C.txt, fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "slideIn .25s ease-out", maxWidth: "90vw", textAlign: "center", backdropFilter: "blur(8px)" }}>{notif.m}</div>}

      {/* Event popup */}
      {eventPop && (
        <div style={{ position: "fixed", inset: 0, zIndex: 160, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setEventPop(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...CRD, padding: "26px 28px", maxWidth: 380, width: "90%", textAlign: "center", animation: "popIn .35s cubic-bezier(.4,0,.2,1)", border: `1px solid ${eventPop.eff > 0 ? C.gB : C.rB}`, boxShadow: `0 8px 40px ${eventPop.eff > 0 ? "rgba(34,120,60,0.15)" : "rgba(160,50,40,0.15)"}` }}>
            <div style={{ fontSize: 44, marginBottom: 8, animation: "float 2s ease-in-out infinite" }}>{eventPop.emoji}</div>
            <div style={{ fontFamily: ffd, fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 4, color: eventPop.eff > 0 ? C.g : C.r }}>{eventPop.title}</div>
            <div style={{ fontSize: 13, color: C.txtM, lineHeight: 1.6, fontStyle: "italic", marginBottom: 6 }}>{eventPop.desc}</div>
            <div style={{ fontSize: 11, color: C.txtD }}>{eventPop.eff > 0 ? "📈 +" : "📉 "}{(eventPop.eff * 100).toFixed(0)}% → {eventPop.targets.map(t => ALL_GOODS.find(x => x.id === t)?.emoji).join(" ")}</div>
            <button onClick={() => setEventPop(null)} style={{ ...BTN, padding: "7px 22px", marginTop: 10, fontSize: 10, fontWeight: 600, color: C.txtM }}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Claim popup */}
      {claim && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(3px)" }} onClick={() => setClaim(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...CRD, padding: "26px 30px", maxWidth: 350, width: "90%", textAlign: "center", animation: "popIn .4s ease-out" }}>
            <div style={{ fontSize: 40, marginBottom: 6 }}>{claim.icon}</div>
            <div style={{ fontFamily: ffd, fontSize: 12, fontWeight: 600, letterSpacing: 2, marginBottom: 6 }}>{claim.text}</div>
            <div style={{ fontFamily: ffd, fontSize: 26, fontWeight: 700, color: C.g }}>+{claim.amt} ÐC</div>
            {claim.streak > 1 && <div style={{ fontSize: 11, color: C.g, marginTop: 3 }}>🔥 {claim.streak}-day streak{claim.amt > DAILY_BASE ? ` (+${claim.amt - DAILY_BASE} bonus)` : ""}</div>}
            {claim.interest > 0 && <div style={{ fontSize: 10, color: C.g, marginTop: 4 }}>💰 Savings: +{claim.interest.toFixed(2)}</div>}
            {claim.loanInt > 0 && <div style={{ fontSize: 10, color: C.r, marginTop: 2 }}>📋 Loan: +{claim.loanInt.toFixed(2)} owed</div>}
            {claim.loanForced && <div style={{ fontSize: 11, color: C.r, marginTop: 4, fontWeight: 700 }}>⚠️ Overdue loan — assets liquidated!</div>}
            <button onClick={() => setClaim(null)} style={{ ...BTN, padding: "7px 22px", marginTop: 10, fontSize: 10, fontWeight: 600, color: C.txtM }}>Continue</button>
          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {confirmAction && (
        <div style={{ position: "fixed", inset: 0, zIndex: 170, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setConfirmAction(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...CRD, padding: "22px 26px", maxWidth: 340, width: "90%", textAlign: "center", animation: "popIn .3s ease-out" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>⚠️</div>
            <div style={{ fontSize: 13, color: C.txtM, lineHeight: 1.6, marginBottom: 12 }}>{confirmAction.msg}</div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setConfirmAction(null)} style={{ ...BTN, padding: "8px 18px", fontSize: 10, fontWeight: 600, color: C.txtM }}>Cancel</button>
              <button onClick={() => { confirmAction.fn(); setConfirmAction(null); }} style={{ ...BTN, padding: "8px 18px", fontSize: 10, fontWeight: 700, color: C.r, borderColor: C.rB, background: C.rBg }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      {info && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(3px)", padding: 16 }} onClick={() => setInfo(false)}>
          <div onClick={e => e.stopPropagation()} style={{ ...CRD, padding: "20px 18px 14px", maxWidth: 460, width: "100%", maxHeight: "85vh", overflowY: "auto", animation: "fadeUp .3s ease-out" }}>
            <div style={{ fontFamily: ffd, fontSize: 14, fontWeight: 700, letterSpacing: 2, marginBottom: 10, textAlign: "center" }}>How the Market Works</div>
            {[
              { i: "💹", t: "How Trading Works", b: "Buy low, sell high. Prices move when players trade — big buys push prices up, big sells push them down. A 0.3% fee applies to every trade. 2s cooldown between trades." },
              { i: "⚡", t: "Market Events", b: "Random events shift prices: storms, wars, panics, booms, crashes. They're the main volatility driver. Watch for them and trade accordingly." },
              { i: "☀️", t: "Daily Dubloons", b: `Log in daily to claim ${DAILY_BASE} ÐC. Build streaks for bonuses: +${STREAK_BONUS}/day, 7th day: +${STREAK_7_BONUS} extra. Invest it — holding cash loses value to inflation.` },
              { i: "📊", t: "Supply & Scarcity", b: "Each commodity has limited shares. High demand + low supply = rising prices. When supply runs critically low, new shares are issued (diluting price ~8%)." },
              { i: "📈", t: "Inflation", b: "Every daily claim adds money to the economy. More money chasing the same goods = prices rise over time. This is a speculative market — ride the waves." },
              { i: "🏆", t: "Leagues & Rankings", b: "Climb by growing net worth: Driftwood → Bronze → Silver → Gold → Diamond → Legendary. Compete on the global leaderboard." },
              { i: "🔒", t: "Bank (1,000 ÐC to unlock)", b: `Savings earn ${(BANK_SAVE_RATE * 100).toFixed(1)}%/day compound interest. Loans up to ${MAX_LOAN_MULT}× NW at ${(BANK_LOAN_RATE * 100)}%/day — repay within ${LOAN_DEADLINE} logins or forced liquidation (wallet → savings → holdings → shorts).` },
              { i: "📉", t: "Short Selling (Bank required)", b: `Bet against a commodity. Profit when prices fall. ${(SHORT_COLLATERAL * 100).toFixed(0)}% collateral required. ${(SHORT_BORROW_RATE * 100).toFixed(1)}%/day borrow fee. Margin call at ${(SHORT_MARGIN_CALL * 100).toFixed(0)}% loss = auto-liquidation.` },
              { i: "💰", t: "Liquidity Risk", b: "Trade fees fund market reserves. If reserves run low, large sells may not fill. Plan your exits." },
              { i: "🖤", t: "???", b: "Look carefully at the header..." },
            ].map((x, i) => (
              <div key={i} style={{ marginBottom: 7, padding: "7px 9px", background: C.inp, borderRadius: 4, border: `1px solid ${C.brdL}` }}>
                <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 1 }}>{x.i} {x.t}</div>
                <div style={{ fontSize: 11, color: C.txtM, lineHeight: 1.5 }}>{x.b}</div>
              </div>
            ))}
            <button onClick={() => setInfo(false)} style={{ ...BTN, width: "100%", padding: "9px", fontSize: 10, fontWeight: 600, color: C.txtM, marginTop: 4 }}>Close</button>
          </div>
        </div>
      )}

      {/* Lore */}
      {showLore && sel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)", padding: 16 }} onClick={() => setShowLore(false)}>
          <div onClick={e => e.stopPropagation()} style={{ ...CRD, padding: "24px 20px", maxWidth: 420, width: "100%", textAlign: "center", animation: "fadeUp .3s ease-out" }}>
            <div style={{ fontSize: 34, marginBottom: 4 }}>{sel.emoji}</div>
            <div style={{ fontFamily: ffd, fontSize: 14, fontWeight: 700, letterSpacing: 2, marginBottom: 10 }}>{sel.name}</div>
            <div style={{ fontSize: 13, color: C.txtM, lineHeight: 1.7, fontStyle: "italic", textAlign: "left" }}>{sel.lore}</div>
            <div style={{ marginTop: 10, padding: "6px 10px", background: C.inp, borderRadius: 4, border: `1px solid ${C.brdL}`, fontSize: 10, color: C.txtD, display: "flex", justifyContent: "space-around" }}>
              <span>Shares: <strong style={{ color: C.txt }}>{(mk.commodities[sel.id]?.totalShares || sel.shares).toLocaleString()}</strong></span>
              <span>Vol: <strong style={{ color: sel.vol > 0.15 ? C.r : C.txt }}>{(sel.vol * 100).toFixed(0)}%</strong></span>
            </div>
            <button onClick={() => setShowLore(false)} style={{ ...BTN, padding: "7px 20px", marginTop: 10, fontSize: 10, fontWeight: 600, color: C.txtM }}>Close</button>
          </div>
        </div>
      )}

      {/* ═══ MAIN ═══ */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 20px 40px", position: "relative", zIndex: 1 }}>
        <header style={{ textAlign: "center", marginBottom: 8, paddingBottom: 10, borderBottom: `1px solid ${C.brdL}` }}>
          <div style={{ fontSize: 10, letterSpacing: 4, textTransform: "uppercase", color: C.acc, marginBottom: 6, cursor: "pointer", userSelect: "none" }} onClick={handleEgg}>Est. Commercium</div>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontFamily: ffd, fontSize: 34, fontWeight: 700, letterSpacing: 6, margin: 0 }}>MARKET</h1>
            <button onClick={() => setInfo(true)} style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${C.brd}`, background: C.inp, color: C.txtD, fontSize: 11, fontFamily: ffd, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>?</button>
            <button onClick={() => { const next = !audioOn; setAudioOn(next); if (!audioStarted.current) { AudioEngine.init(); audioStarted.current = true; } if (next) { AudioEngine.startMusic(isDk ? "dark" : "light"); AudioEngine.setVolume(0.5); } else { AudioEngine.stopMusic(); AudioEngine.setVolume(0); } }} style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${C.brd}`, background: audioOn ? C.gBg : C.inp, color: audioOn ? C.g : C.txtD, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .3s" }}>{audioOn ? "🔊" : "🔇"}</button>
          </div>
          {mk && <div style={{ fontSize: 9, color: C.txtD, marginTop: 2 }}>👥 {lb.length.toLocaleString()} trader{lb.length !== 1 ? "s" : ""} worldwide</div>}
          <div style={{ fontSize: 9, color: C.txtD, marginTop: 2 }}>📅 Day {getCurrentDay()} · <span style={{ color: C.g }}>{dayClock.h}h {dayClock.m}m {dayClock.s}s</span> until next day</div>
          {!pl ? (autoSignIn ? <div style={{ marginTop: 8, fontSize: 11, color: C.txtD }}>Loading...</div> :
            <div style={{ display: "flex", gap: 8, maxWidth: 300, margin: "10px auto 0" }}>
              <input value={nameIn} onChange={e => setNameIn(e.target.value)} onKeyDown={e => e.key === "Enter" && signIn()} placeholder="Trader name..." maxLength={24} style={{ ...INP, flex: 1, padding: "8px 12px", fontSize: 14 }} />
              <button onClick={signIn} style={{ ...BTN, padding: "8px 14px", fontSize: 10, fontWeight: 600, color: C.txtM }}>Sign In</button>
            </div>
          ) : (
            <div style={{ marginTop: 4 }}>
              <span style={{ fontSize: 13, color: C.txtM, fontStyle: "italic" }}>{pl.name}</span>
              <span style={{ fontSize: 11, marginLeft: 8, color: league.col, fontWeight: 600 }}>{league.emoji} {league.name}</span>
              <button onClick={() => setShowLeagues(true)} style={{ marginLeft: 4, width: 16, height: 16, borderRadius: "50%", border: `1px solid ${C.brd}`, background: C.inp, color: C.txtD, fontSize: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", verticalAlign: "middle" }}>🏆</button>
              {pl.streak > 1 && <span style={{ fontSize: 11, marginLeft: 6, color: C.txtD }}>🔥{pl.streak}</span>}
              <button onClick={() => setConfirmAction({ msg: "Sign out? Your progress is saved locally, but you won't be able to access it from another device.", fn: signOut })} style={{ marginLeft: 8, background: "none", border: "none", color: C.txtD, fontSize: 9, cursor: "pointer", textDecoration: "underline", textDecorationColor: C.brdL }}>sign out</button>
            </div>
          )}
        </header>

        {/* Macro */}
        <div style={{ ...CRD, padding: "6px 12px", marginBottom: 8, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4, fontSize: 9, alignItems: "center" }}>
          <span style={{ color: C.txtD, display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: C.g, display: "inline-block", animation: "pulse 2s infinite" }} /><strong>LIVE</strong></span>
          <span style={{ color: C.txtD }}><strong>SUPPLY</strong> <span style={{ color: C.txt, fontWeight: 700 }}>{ms.toFixed(0)}</span></span>
          <span style={{ color: C.txtD }}><strong>LIQUIDITY</strong> <span style={{ color: C.txt, fontWeight: 700 }}>{(mk.bankReserves || 0).toFixed(0)}</span></span>
          <span style={{ color: C.txtD }}><strong>INFLATION</strong> <span style={{ color: C.r, fontWeight: 700 }}>{((infF - 1) * 100).toFixed(1)}%</span></span>
        </div>

        {/* Stats */}
        {pl && (
          <div style={{ display: "flex", justifyContent: "center", gap: 14, padding: "6px 0", marginBottom: 8, borderBottom: `1px solid ${C.brdL}`, flexWrap: "wrap" }}>
            {[
              { l: "Wallet", v: (pl.wallet || 0).toFixed(1) },
              { l: "Holdings", v: holdVal.toFixed(1) },
              ...(Object.keys(pl.shorts || {}).length > 0 ? [{ l: "Shorts", v: (shortVal >= 0 ? "+" : "") + shortVal.toFixed(1), c: shortVal >= 0 ? C.g : C.r }] : []),
              ...(bankUnlocked ? [{ l: "Savings", v: (pl.savings || 0).toFixed(1) }] : []),
              ...(pl.loan > 0 ? [{ l: `Loan (${Math.max(0, LOAN_DEADLINE - ((pl.loginCount || 0) - (pl.loanDay || 0)))}d)`, v: `-${pl.loan.toFixed(1)}`, c: C.r }] : []),
              { l: "Net Worth", v: nw.toFixed(1), b: true },
            ].map((s, i, a) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: ffd, fontSize: s.b ? 18 : 14, fontWeight: 700, color: s.c || C.txt }}>{s.v}</div>
                  <div style={{ fontSize: 7, letterSpacing: 1.5, textTransform: "uppercase", color: C.txtD }}>{s.l}</div>
                </div>
                {i < a.length - 1 && <div style={{ width: 1, height: 18, background: C.brdL }} />}
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        {pl && (
          <div style={{ display: "flex", justifyContent: "center", gap: 0, marginBottom: 14, flexWrap: "wrap" }}>
            {["market", ...(bm ? ["black market"] : []), "bank", "portfolio", "rankings"].map(t => (
              <button key={t} onClick={() => {
                AudioEngine.playSfx("click");
                setTab(t); setSel(null);
                if (t === "rankings") loadS("mkt-lb-v13", true).then(d => d?.players && setLb(d.players));
              }} style={{ padding: "6px 11px", background: "none", border: "none", cursor: "pointer", fontFamily: ffd, fontSize: 9, fontWeight: 600, letterSpacing: 2, color: tab === t ? (t === "black market" ? C.r : C.txt) : C.txtD, borderBottom: tab === t ? `2px solid ${t === "black market" ? C.r : C.acc}` : "2px solid transparent", textTransform: "capitalize", opacity: t === "bank" && !bankUnlocked ? 0.4 : 1 }}>{t === "bank" && !bankUnlocked ? "🔒 Bank" : t}</button>
            ))}
          </div>
        )}

        {!pl && (
          <div style={{ textAlign: "center", padding: 32, animation: "fadeUp .6s ease-out" }}>
            <div style={{ ...CRD, padding: "32px 24px", maxWidth: 400, margin: "0 auto" }}>
              <div style={{ fontSize: 48, marginBottom: 14, animation: "float 3s ease-in-out infinite" }}>🏴‍☠️</div>
              <div style={{ fontFamily: ffd, fontSize: 13, letterSpacing: 3, marginBottom: 8, animation: "fadeUp .6s ease-out .2s both" }}>Loading your account...</div>
              <div style={{ fontSize: 12, color: C.txtM, lineHeight: 1.6, fontStyle: "italic", animation: "fadeUp .6s ease-out .3s both" }}>Trade commodities · ride the events · climb the ranks</div>
              <button onClick={() => setInfo(true)} style={{ ...BTN, padding: "8px 18px", marginTop: 16, fontSize: 10, color: C.txtM, animation: "fadeUp .6s ease-out .4s both" }}>How it works →</button>
            </div>
          </div>
        )}

        {/* ═══ MARKET LIST ═══ */}
        {pl && (tab === "market" || tab === "black market") && !sel && (
          <div>
            {tab === "black market" && <div style={{ textAlign: "center", marginBottom: 10 }}><div style={{ fontFamily: ffd, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: C.r }}>🖤 The Black Market</div><div style={{ fontSize: 8, color: C.txtD, marginTop: 2 }}>👤 {(mk.bmPlayers || 1).toLocaleString()} smuggler{(mk.bmPlayers || 1) !== 1 ? "s" : ""} active</div></div>}
            <div style={{ display: "grid", gridTemplateColumns: tab === "black market" ? "1fr" : "1fr 1fr", gap: 6 }}>
              {(tab === "black market" ? [BLACK_GOOD] : COMMODITIES).map((g, idx) => {
                const cd = mk.commodities[g.id]; if (!cd) return null;
                const snaps = cd.snaps || []; const last = cd.last;
                // Daily: filter to last 24h for card view
                const dayMs = 864e5;
                const daySnaps = snaps.filter(s => Date.now() - s.t < dayMs);
                const chartSnaps = daySnaps.length > 2 ? daySnaps : snaps.slice(-40);
                const first = chartSnaps.length > 0 ? chartSnaps[0].p : g.base;
                const ch = first > 0 ? ((last - first) / first * 100) : 0; const up = ch >= 0;
                const held = pl.holdings[g.id] || 0;
                return (
                  <button key={g.id} onClick={() => { AudioEngine.playSfx("click"); setSel(g); setTMode("buy"); setTQty(""); setTfr("1D"); }}
                    style={{ ...CRD, padding: "10px 10px 6px", cursor: "pointer", textAlign: "left", transition: "all .2s ease", display: "flex", flexDirection: "column", animation: `cardIn .4s ease-out ${idx * 0.05}s both` }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.brdH; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.brd; e.currentTarget.style.transform = ""; }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 16 }}>{g.emoji}</span>
                        <span style={{ fontFamily: ffd, fontSize: 9, fontWeight: 600, letterSpacing: 0.5 }}>{g.short}</span>
                      </div>
                      <span style={{ fontSize: 8, fontWeight: 700, color: up ? C.g : C.r }}>{up ? "▲" : "▼"}{Math.abs(ch).toFixed(1)}%</span>
                    </div>
                    <div style={{ fontFamily: ffd, fontSize: 14, fontWeight: 700, marginBottom: 1 }}>{last.toFixed(4)}</div>
                    <div style={{ height: 30, marginBottom: 2 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartSnaps.length > 80 ? chartSnaps.filter((_,i) => i % Math.ceil(chartSnaps.length/80) === 0) : chartSnaps}>
                          <defs><linearGradient id={`g-${g.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={up ? C.g : C.r} stopOpacity={0.15} /><stop offset="100%" stopColor={up ? C.g : C.r} stopOpacity={0} /></linearGradient></defs>
                          <Area type="monotone" dataKey="p" stroke={up ? C.g : C.r} strokeWidth={1.5} fill={`url(#g-${g.id})`} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: C.txtD }}>
                      <span>{cd.playerHeld.toLocaleString()} traded</span>
                      {held > 0 && <span style={{ color: C.acc, fontWeight: 700 }}>⬤ {held}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ DETAIL ═══ */}
        {pl && (tab === "market" || tab === "black market") && sel && (() => {
          const g = sel; const cd = mk.commodities[g.id]; if (!cd) return null;
          const snaps = cd.snaps || []; const chartData = filterSnaps(snaps, tfr);
          const fv = g.base * getInflationFactor(ms, mk?.totalClaims || 0); const last = cd.last;
          // % change relative to selected timeframe
          const first = chartData.length > 0 ? chartData[0].p : g.base;
          const ch = first > 0 ? ((last - first) / first * 100) : 0; const up = ch >= 0;
          const { bid, ask } = getSpread(last, g.vol, cd.bankHeld, cd.totalShares);
          const held = pl.holdings[g.id] || 0;
          const q = parseInt(tQty) || 0;
          const tp = tMode === "buy" || tMode === "cover" ? ask : bid;
          const cost = +(q * tp).toFixed(4);
          const maxBuy = Math.min(Math.floor(pl.wallet / (ask * (1 + TRADE_FEE))), cd.bankHeld);
          const mCap = +(last * cd.totalShares).toFixed(2);
          const shortPos = (pl.shorts || {})[g.id];
          const shortPnl = shortPos ? +((shortPos.entry - last) * shortPos.qty).toFixed(2) : 0;
          return (
            <div style={{ animation: "fadeUp .3s ease-out" }}>
              <button onClick={() => setSel(null)} style={{ background: "none", border: "none", color: C.txtM, fontFamily: ff, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 8 }}>← Back</button>
              <div style={{ ...CRD, padding: "22px 16px 12px", marginBottom: 8, position: "relative" }}>
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", width: 24, height: 24, borderRadius: "50%", background: g.id === "contraband" ? "radial-gradient(circle,#333,#111)" : "radial-gradient(circle,#b84a3a,#8a3028)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#f5e8d8", boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>{g.emoji}</div>
                <div style={{ textAlign: "center", marginTop: 2 }}>
                  <div style={{ fontFamily: ffd, fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>{g.name}</div>
                  <button onClick={() => setShowLore(true)} style={{ background: "none", border: "none", color: C.txtM, fontStyle: "italic", fontSize: 10, cursor: "pointer", textDecoration: "underline", textDecorationColor: C.brdL, marginTop: 2 }}>{g.desc} — lore →</button>
                  <div style={{ fontFamily: ffd, fontSize: 26, fontWeight: 700, marginTop: 6 }}>{last.toFixed(4)} <span style={{ fontSize: 11, color: C.txtM }}>ÐC</span></div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: up ? C.g : C.r }}>{up ? "▲" : "▼"} {Math.abs(ch).toFixed(2)}%</div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 4, fontSize: 9, color: C.txtD, flexWrap: "wrap" }}>
                    <span>Bid <strong style={{ color: C.g }}>{bid.toFixed(4)}</strong></span>
                    <span>Ask <strong style={{ color: C.r }}>{ask.toFixed(4)}</strong></span>
                    <span>Fair <strong>{fv.toFixed(4)}</strong></span>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 0, marginTop: 8, marginBottom: 4 }}>
                  {["1D", "1W", "1M", "ALL"].map(t => (
                    <button key={t} onClick={() => setTfr(t)} style={{ padding: "3px 8px", background: "none", border: "none", cursor: "pointer", fontFamily: ffd, fontSize: 8, fontWeight: 600, letterSpacing: 1, color: tfr === t ? C.txt : C.txtD, borderBottom: tfr === t ? `1px solid ${C.acc}` : "1px solid transparent" }}>{t}</button>
                  ))}
                </div>
                <div style={{ height: 110 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={up ? C.g : C.r} stopOpacity={0.1} /><stop offset="100%" stopColor={up ? C.g : C.r} stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="t" hide /><YAxis domain={["auto", "auto"]} hide />
                      <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 4, fontFamily: ff, fontSize: 10 }} labelFormatter={() => ""} formatter={v => [v.toFixed(4) + " ÐC", "Price"]} />
                      <Area type="monotone" dataKey="p" stroke={up ? C.g : C.r} strokeWidth={1.5} fill="url(#dg)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 4, fontSize: 8, color: C.txtD, flexWrap: "wrap" }}>
                  <span>Supply: <strong>{cd.totalShares.toLocaleString()}</strong></span>
                  <span>MCap: <strong>{mCap > 1000 ? (mCap / 1000).toFixed(1) + "K" : mCap.toFixed(0)}</strong></span>
                  <span>Traded: <strong>{cd.playerHeld.toLocaleString()}</strong></span>
                </div>
              </div>
              {/* Position card */}
              {(held > 0 || shortPos) && (
                <div style={{ ...CRD, padding: "10px 14px", marginBottom: 8, animation: "fadeUp .3s ease-out" }}>
                  <div style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: C.txtD, marginBottom: 6, fontWeight: 600 }}>Your Position</div>
                  {held > 0 && (() => {
                    const cb = (pl.costBasis || {})[g.id] || 0;
                    const val = +(held * last).toFixed(2);
                    const cost = +(held * cb).toFixed(2);
                    const pnl = +(val - cost).toFixed(2);
                    const pnlPct = cost > 0 ? ((val / cost - 1) * 100).toFixed(1) : 0;
                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: C.gBg, borderRadius: 4, border: `1px solid ${C.gB}`, marginBottom: shortPos ? 5 : 0 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.g }}>LONG</div>
                          <div style={{ fontSize: 10, color: C.txtM }}>{held.toLocaleString()} shares · avg {cb.toFixed(4)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: ffd, fontSize: 14, fontWeight: 700 }}>{val.toFixed(2)} <span style={{ fontSize: 9, color: C.txtD }}>ÐC</span></div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: pnl >= 0 ? C.g : C.r }}>{pnl >= 0 ? "▲" : "▼"} {Math.abs(pnl).toFixed(2)} ({pnlPct}%)</div>
                        </div>
                      </div>
                    );
                  })()}
                  {shortPos && (() => {
                    const dailyFee = +(shortPos.qty * last * SHORT_BORROW_RATE).toFixed(2);
                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: C.rBg, borderRadius: 4, border: `1px solid ${C.rB}` }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.r }}>SHORT</div>
                          <div style={{ fontSize: 10, color: C.txtM }}>{shortPos.qty.toLocaleString()} shares · entry {shortPos.entry.toFixed(4)}</div>
                          <div style={{ fontSize: 8, color: C.r }}>Coll: {shortPos.collateral.toFixed(2)} · Fee: {dailyFee}/day</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: ffd, fontSize: 14, fontWeight: 700 }}>{shortPos.collateral.toFixed(2)} <span style={{ fontSize: 9, color: C.txtD }}>ÐC</span></div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: shortPnl >= 0 ? C.g : C.r }}>{shortPnl >= 0 ? "▲" : "▼"} {Math.abs(shortPnl).toFixed(2)} ({(shortPos.entry > 0 ? ((shortPos.entry - last) / shortPos.entry * 100).toFixed(1) : 0)}%)</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {/* Trade */}
              <div style={{ ...CRD, padding: "14px 16px" }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                  <button onClick={() => setTMode("buy")} style={{ ...BTN, flex: 1, padding: "7px 4px", fontSize: 9, fontWeight: 600, background: tMode === "buy" ? C.gBg : "transparent", borderColor: tMode === "buy" ? C.gB : C.brd, color: tMode === "buy" ? C.g : C.txtD }}>Buy</button>
                  <button onClick={() => setTMode("sell")} style={{ ...BTN, flex: 1, padding: "7px 4px", fontSize: 9, fontWeight: 600, background: tMode === "sell" ? C.rBg : "transparent", borderColor: tMode === "sell" ? C.rB : C.brd, color: tMode === "sell" ? C.r : C.txtD }}>Sell</button>
                  {bankUnlocked && <button onClick={() => setTMode("short")} style={{ ...BTN, flex: 1, padding: "7px 4px", fontSize: 9, fontWeight: 600, background: tMode === "short" ? "rgba(168,85,247,0.08)" : "transparent", borderColor: tMode === "short" ? "rgba(168,85,247,0.3)" : C.brd, color: tMode === "short" ? "#a855f7" : C.txtD }}>Short</button>}
                  {bankUnlocked && shortPos && <button onClick={() => setTMode("cover")} style={{ ...BTN, flex: 1, padding: "7px 4px", fontSize: 9, fontWeight: 600, background: tMode === "cover" ? "rgba(168,85,247,0.08)" : "transparent", borderColor: tMode === "cover" ? "rgba(168,85,247,0.3)" : C.brd, color: tMode === "cover" ? "#a855f7" : C.txtD }}>Cover</button>}
                </div>
                {tMode === "short" && <div style={{ fontSize: 9, color: "#a855f7", marginBottom: 6, padding: "4px 8px", background: "rgba(168,85,247,0.05)", borderRadius: 3, border: "1px solid rgba(168,85,247,0.15)" }}>⚡ Shorting requires {(SHORT_COLLATERAL * 100).toFixed(0)}% collateral. Margin call at {(SHORT_MARGIN_CALL * 100).toFixed(0)}% loss.</div>}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 7, letterSpacing: 2, textTransform: "uppercase", color: C.txtD }}>Quantity</span>
                  <span style={{ fontSize: 9, color: C.txtM }}>{tMode === "buy" ? `Max ${maxBuy.toLocaleString()}` : tMode === "sell" ? `Hold ${held}` : tMode === "short" ? `Avail ${cd.bankHeld.toLocaleString()}` : `Short ${shortPos?.qty || 0}`}</span>
                </div>
                <div style={{ display: "flex", gap: 5, marginBottom: 7 }}>
                  <input type="number" value={tQty} onChange={e => setTQty(e.target.value)} placeholder="0" style={{ ...INP, flex: 1, padding: "8px 10px", fontSize: 15, fontWeight: 700 }} />
                  <button onClick={() => setTQty(String(tMode === "buy" ? maxBuy : tMode === "sell" ? held : tMode === "short" ? Math.min(cd.bankHeld, Math.floor(pl.wallet / (bid * SHORT_COLLATERAL))) : shortPos?.qty || 0))} style={{ ...BTN, padding: "8px 10px", fontSize: 8, fontWeight: 600, color: C.txtD }}>MAX</button>
                </div>
                {q > 0 && <div style={{ padding: "6px 10px", background: C.inp, borderRadius: 4, border: `1px solid ${C.brdL}`, marginBottom: 7, fontSize: 11, display: "flex", justifyContent: "space-between" }}><span style={{ color: C.txtM }}>{q} × {tp.toFixed(4)}{tMode === "short" ? ` + ${(SHORT_COLLATERAL * 100).toFixed(0)}% coll.` : ""}</span><span style={{ fontWeight: 700 }}>= {(tMode === "short" ? +(q * bid * SHORT_COLLATERAL).toFixed(4) : cost).toFixed(4)} ÐC</span></div>}
                <button onClick={() => {
                  if (q <= 0) return;
                  const isAllSell = tMode === "sell" && q >= (pl.holdings[sel.id] || 0);
                  const isBigShort = tMode === "short" && q * bid * SHORT_COLLATERAL > pl.wallet * 0.5;
                  if (isAllSell) setConfirmAction({ msg: `Sell ALL ${q} ${sel.name}? This empties your position.`, fn: doTrade });
                  else if (isBigShort) setConfirmAction({ msg: `Short ${q} ${sel.name}? This locks ${(q * bid * SHORT_COLLATERAL).toFixed(0)} ÐC as collateral (${(SHORT_BORROW_RATE * 100).toFixed(1)}%/day borrow fee).`, fn: doTrade });
                  else doTrade();
                }} disabled={q <= 0} style={{ ...BTN, display: "block", width: "100%", padding: "10px", fontSize: 10, fontWeight: 600, background: q <= 0 ? "transparent" : (tMode === "short" || tMode === "cover") ? "rgba(168,85,247,0.08)" : tMode === "buy" ? C.gBg : C.rBg, borderColor: q <= 0 ? C.brd : (tMode === "short" || tMode === "cover") ? "rgba(168,85,247,0.3)" : tMode === "buy" ? C.gB : C.rB, color: q <= 0 ? C.txtD : (tMode === "short" || tMode === "cover") ? "#a855f7" : tMode === "buy" ? C.g : C.r, cursor: q <= 0 ? "default" : "pointer" }}>
                  {{ buy: "Buy", sell: "Sell", short: "Open Short", cover: "Close Short" }[tMode]}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ═══ BANK ═══ */}
        {pl && tab === "bank" && !bankUnlocked && (
          <div style={{ animation: "fadeUp .3s ease-out", textAlign: "center", padding: "30px 0" }}>
            <div style={{ ...CRD, padding: "30px 24px", maxWidth: 360, margin: "0 auto" }}>
              <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.4 }}>🏦</div>
              <div style={{ fontFamily: ffd, fontSize: 14, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>The Bank</div>
              <div style={{ fontSize: 12, color: C.txtM, fontStyle: "italic", marginBottom: 14 }}>Savings accounts, loans, and leverage — for established traders only.</div>
              <div style={{ padding: "10px 14px", background: C.inp, borderRadius: 4, border: `1px solid ${C.brdL}`, marginBottom: 10 }}>
                <div style={{ fontSize: 9, letterSpacing: 2, color: C.txtD, textTransform: "uppercase", marginBottom: 4 }}>Requirement</div>
                <div style={{ fontFamily: ffd, fontSize: 20, fontWeight: 700 }}>{BANK_UNLOCK_NW.toLocaleString()} ÐC <span style={{ fontSize: 10, color: C.txtD }}>net worth</span></div>
              </div>
              <div style={{ height: 6, background: C.brdL, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${Math.min(100, (nw / BANK_UNLOCK_NW) * 100)}%`, background: `linear-gradient(90deg, ${C.g}, ${C.acc})`, borderRadius: 3, transition: "width .5s" }} />
              </div>
              <div style={{ fontSize: 10, color: C.txtM }}>{nw.toFixed(0)} / {BANK_UNLOCK_NW.toLocaleString()} ÐC <span style={{ fontWeight: 700, color: C.g }}>({((nw / BANK_UNLOCK_NW) * 100).toFixed(0)}%)</span></div>
              <div style={{ marginTop: 14, fontSize: 10, color: C.txtD, lineHeight: 1.5 }}>
                <div>💰 Savings: {(BANK_SAVE_RATE * 100).toFixed(1)}% daily interest</div>
                <div>📋 Loans: up to {MAX_LOAN_MULT}× net worth at {(BANK_LOAN_RATE * 100)}%/day</div>
                <div>⏰ {LOAN_DEADLINE}-login repayment deadline</div>
              </div>
            </div>
          </div>
        )}
        {pl && tab === "bank" && bankUnlocked && (
          <div style={{ animation: "fadeUp .3s ease-out" }}>
            <div style={{ textAlign: "center", marginBottom: 10 }}><div style={{ fontSize: 26 }}>🏦</div><div style={{ fontFamily: ffd, fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>The Bank</div></div>
            <div style={{ ...CRD, padding: "8px 12px", marginBottom: 8, display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 4 }}>
              <div style={{ textAlign: "center" }}><div style={{ fontFamily: ffd, fontSize: 13, fontWeight: 700 }}>{(mk.bankReserves || 0).toFixed(0)}</div><div style={{ fontSize: 7, letterSpacing: 1, color: C.txtD }}>RESERVES</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontFamily: ffd, fontSize: 13, fontWeight: 700, color: C.g }}>{(BANK_SAVE_RATE * 100).toFixed(1)}%</div><div style={{ fontSize: 7, letterSpacing: 1, color: C.txtD }}>SAVE</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontFamily: ffd, fontSize: 13, fontWeight: 700, color: C.r }}>{(BANK_LOAN_RATE * 100)}%</div><div style={{ fontSize: 7, letterSpacing: 1, color: C.txtD }}>LOAN</div></div>
            </div>
            <div style={{ display: "flex", marginBottom: 8, justifyContent: "center" }}>
              {["savings", "loans"].map(t => (<button key={t} onClick={() => { setBTab(t); setBAmt(""); }} style={{ padding: "5px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: ffd, fontSize: 9, fontWeight: 600, letterSpacing: 2, color: bTab === t ? C.txt : C.txtD, borderBottom: bTab === t ? `2px solid ${C.acc}` : "2px solid transparent", textTransform: "capitalize" }}>{t}</button>))}
            </div>
            {bTab === "savings" ? (
              <div style={{ ...CRD, padding: "14px 16px" }}>
                <div style={{ textAlign: "center", marginBottom: 8 }}>
                  <div style={{ fontFamily: ffd, fontSize: 22, fontWeight: 700 }}>{(pl.savings || 0).toFixed(2)} <span style={{ fontSize: 11, color: C.txtM }}>ÐC</span></div>
                  <div style={{ fontSize: 9, color: C.g, marginTop: 2 }}>{(BANK_SAVE_RATE * 100).toFixed(1)}% daily (compounds each login)</div>
                </div>
                <input type="number" value={bAmt} onChange={e => setBAmt(e.target.value)} placeholder="Amount..." style={{ ...INP, width: "100%", padding: "8px 10px", fontSize: 15, fontWeight: 700, marginBottom: 6, boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={bDeposit} style={{ ...BTN, flex: 1, padding: "8px", fontSize: 9, fontWeight: 600, color: C.g, background: C.gBg, borderColor: C.gB }}>Deposit</button>
                  <button onClick={bWithdraw} style={{ ...BTN, flex: 1, padding: "8px", fontSize: 9, fontWeight: 600, color: C.r, background: C.rBg, borderColor: C.rB }}>Withdraw</button>
                </div>
              </div>
            ) : (() => {
              const dLeft = pl.loanDay ? Math.max(0, LOAN_DEADLINE - ((pl.loginCount || 0) - pl.loanDay)) : LOAN_DEADLINE;
              const mx = Math.max(0, +(nw * MAX_LOAN_MULT - (pl.loan || 0)).toFixed(2));
              return (
                <div style={{ ...CRD, padding: "14px 16px" }}>
                  <div style={{ textAlign: "center", marginBottom: 8 }}>
                    <div style={{ fontFamily: ffd, fontSize: 22, fontWeight: 700, color: (pl.loan || 0) > 0 ? C.r : C.txt }}>{(pl.loan || 0).toFixed(2)} <span style={{ fontSize: 11, color: C.txtM }}>ÐC</span></div>
                    {pl.loan > 0 && <div style={{ fontSize: 10, color: dLeft <= 1 ? C.r : C.txtM, fontWeight: dLeft <= 1 ? 700 : 400, marginTop: 2 }}>⏰ {dLeft} login{dLeft !== 1 ? "s" : ""} left{dLeft <= 1 ? " — URGENT!" : ""}</div>}
                    <div style={{ fontSize: 9, color: C.r, marginTop: 2 }}>{(BANK_LOAN_RATE * 100)}%/day · {LOAN_DEADLINE}-login deadline</div>
                    <div style={{ fontSize: 9, color: C.txtD, marginTop: 2 }}>Available: {mx.toFixed(2)} ÐC</div>
                  </div>
                  <input type="number" value={bAmt} onChange={e => setBAmt(e.target.value)} placeholder="Amount..." style={{ ...INP, width: "100%", padding: "8px 10px", fontSize: 15, fontWeight: 700, marginBottom: 6, boxSizing: "border-box" }} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { const a = parseFloat(bAmt); const mx = Math.max(0, +(nw * MAX_LOAN_MULT - (pl.loan || 0)).toFixed(2)); if (a > mx * 0.5) setConfirmAction({ msg: `Borrow ${a?.toFixed(0)} ÐC at ${(BANK_LOAN_RATE * 100)}%/day interest? Repay within ${LOAN_DEADLINE} logins or all assets are liquidated.`, fn: bBorrow }); else bBorrow(); }} style={{ ...BTN, flex: 1, padding: "8px", fontSize: 9, fontWeight: 600, color: C.g, background: C.gBg, borderColor: C.gB }}>Borrow</button>
                    <button onClick={bRepay} style={{ ...BTN, flex: 1, padding: "8px", fontSize: 9, fontWeight: 600, color: C.r, background: C.rBg, borderColor: C.rB }}>Repay</button>
                  </div>
                  {pl.loan > 0 && <div style={{ fontSize: 9, color: C.r, marginTop: 6, textAlign: "center", fontStyle: "italic" }}>⚠️ Overdue = forced asset liquidation</div>}
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══ PORTFOLIO ═══ */}
        {pl && tab === "portfolio" && (() => {
          const holdings = Object.entries(pl.holdings || {}).filter(([, q]) => q > 0);
          let totalCost = 0, totalVal = 0;
          holdings.forEach(([id, qty]) => {
            const cost = (pl.costBasis || {})[id] || 0;
            totalCost += cost * qty;
            totalVal += qty * (prices[id] || 0);
          });
          const totalReturn = totalCost > 0 ? ((totalVal - totalCost) / totalCost * 100) : 0;
          const totalPnL = totalVal - totalCost;
          // Investment return: NW minus all cash received from claims = pure trading profit
          const claimed = pl.totalClaimed || DAILY_BASE;
          const investReturn = nw - claimed;
          const investPct = claimed > 0 ? ((nw - claimed) / claimed * 100) : 0;
          // NW history for chart
          const hist = [...(pl.nwHistory || []), { t: Date.now(), v: +nw.toFixed(2) }];
          const chartUp = hist.length > 1 ? hist[hist.length - 1].v >= hist[0].v : true;
          return (
          <div style={{ animation: "fadeUp .3s ease-out" }}>
            <div style={{ ...CRD, padding: 16, textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontFamily: ffd, fontSize: 26, fontWeight: 700 }}>{nw.toFixed(2)} <span style={{ fontSize: 11, color: C.txtM }}>ÐC</span></div>
              <div style={{ color: league.col, fontSize: 10, fontWeight: 600 }}>{league.emoji} {league.name}</div>
              
              {/* NW History Chart */}
              {hist.length > 1 && (
                <div style={{ height: 80, marginTop: 8, marginBottom: 4 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hist}>
                      <defs><linearGradient id="nwG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={chartUp ? C.g : C.r} stopOpacity={0.15} /><stop offset="100%" stopColor={chartUp ? C.g : C.r} stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="t" hide /><YAxis domain={["auto", "auto"]} hide />
                      <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.brd}`, borderRadius: 4, fontFamily: ff, fontSize: 10 }} labelFormatter={() => ""} formatter={v => [v.toFixed(2) + " ÐC", "Net Worth"]} />
                      <Area type="monotone" dataKey="v" stroke={chartUp ? C.g : C.r} strokeWidth={1.5} fill="url(#nwG)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Returns row */}
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
                {holdings.length > 0 && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 7, letterSpacing: 1.5, textTransform: "uppercase", color: C.txtD }}>Holdings P&L</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: totalReturn >= 0 ? C.g : C.r }}>
                      {totalReturn >= 0 ? "▲" : "▼"}{Math.abs(totalReturn).toFixed(1)}% <span style={{ fontWeight: 400, fontSize: 9 }}>({totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(2)})</span>
                    </div>
                  </div>
                )}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 7, letterSpacing: 1.5, textTransform: "uppercase", color: C.txtD }}>Investment Return</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: investReturn >= 0 ? C.g : C.r }}>
                    {investReturn >= 0 ? "▲" : "▼"}{Math.abs(investPct).toFixed(1)}% <span style={{ fontWeight: 400, fontSize: 9 }}>({investReturn >= 0 ? "+" : ""}{investReturn.toFixed(2)})</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 8, color: C.txtD, marginTop: 3 }}>Total claimed: {claimed.toFixed(0)} ÐC · Investment return = NW − claims</div>

              {!bankUnlocked && <div style={{ fontSize: 10, color: C.txtD, marginTop: 4 }}>🔒 Bank unlocks at {BANK_UNLOCK_NW} ÐC ({((nw / BANK_UNLOCK_NW) * 100).toFixed(0)}%)</div>}
              <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                {[{ l: "Cash", v: (pl.wallet || 0).toFixed(1) }, { l: "Holdings", v: holdVal.toFixed(1) }, ...(Object.keys(pl.shorts || {}).length > 0 ? [{ l: "Shorts", v: (shortVal >= 0 ? "+" : "") + shortVal.toFixed(1), c: shortVal >= 0 ? C.g : C.r }] : []), ...(bankUnlocked ? [{ l: "Savings", v: (pl.savings || 0).toFixed(1) }] : []), ...(pl.loan > 0 ? [{ l: "Debt", v: `-${pl.loan.toFixed(1)}`, c: C.r }] : [])].map((x, i) => (
                  <div key={i}><div style={{ fontSize: 8, color: C.txtD }}>{x.l}</div><div style={{ fontFamily: ffd, fontSize: 13, fontWeight: 700, color: x.c || C.txt }}>{x.v}</div></div>
                ))}
              </div>
            </div>
            {holdings.length === 0 && Object.entries(pl.shorts || {}).filter(([, s]) => s.qty > 0).length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: C.txtM, fontStyle: "italic", fontSize: 12 }}>No positions yet — start trading!</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {holdings.map(([id, qty]) => {
                  const g = ALL_GOODS.find(x => x.id === id); if (!g) return null;
                  const last = mk.commodities[id]?.last || 0.10;
                  const avg = (pl.costBasis || {})[id] || 0;
                  const val = qty * last;
                  const cost = qty * avg;
                  const pnl = val - cost;
                  const pnlPct = cost > 0 ? ((val - cost) / cost * 100) : 0;
                  return (
                    <div key={id} onClick={() => { AudioEngine.playSfx("click"); setTab(g.id === "contraband" ? "black market" : "market"); setSel(g); setTMode("sell"); }}
                      style={{ padding: "8px 12px", background: C.gBg, borderRadius: 5, border: `1px solid ${C.gB}`, cursor: "pointer", transition: "all .2s" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${C.gB}`; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{g.emoji}</span>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontFamily: ffd, fontSize: 10, fontWeight: 600 }}>{g.short || g.name}</span>
                              <span style={{ fontSize: 8, fontWeight: 700, color: C.g, letterSpacing: 1 }}>LONG</span>
                            </div>
                            <div style={{ fontSize: 9, color: C.txtM }}>{qty.toLocaleString()} shares · avg {avg.toFixed(4)}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: ffd, fontSize: 14, fontWeight: 700 }}>{val.toFixed(2)} <span style={{ fontSize: 9, color: C.txtD }}>ÐC</span></div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: pnl >= 0 ? C.g : C.r }}>{pnl >= 0 ? "▲" : "▼"} {Math.abs(pnl).toFixed(2)} ({Math.abs(pnlPct).toFixed(1)}%)</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {Object.entries(pl.shorts || {}).filter(([, s]) => s.qty > 0).map(([id, sh]) => {
                  const g = ALL_GOODS.find(x => x.id === id); if (!g) return null;
                  const last = mk.commodities[id]?.last || 0.10;
                  const pnl = +((sh.entry - last) * sh.qty).toFixed(2);
                  const pnlPct = sh.entry > 0 ? ((sh.entry - last) / sh.entry * 100) : 0;
                  const dailyFee = +(sh.qty * last * SHORT_BORROW_RATE).toFixed(2);
                  return (
                    <div key={id} onClick={() => { AudioEngine.playSfx("click"); setTab(g.id === "contraband" ? "black market" : "market"); setSel(g); setTMode("cover"); }}
                      style={{ padding: "8px 12px", background: C.rBg, borderRadius: 5, border: `1px solid ${C.rB}`, cursor: "pointer", transition: "all .2s" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${C.rB}`; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{g.emoji}</span>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontFamily: ffd, fontSize: 10, fontWeight: 600 }}>{g.short || g.name}</span>
                              <span style={{ fontSize: 8, fontWeight: 700, color: C.r, letterSpacing: 1 }}>SHORT</span>
                            </div>
                            <div style={{ fontSize: 9, color: C.txtM }}>{sh.qty.toLocaleString()} shares · entry {sh.entry.toFixed(4)}</div>
                            <div style={{ fontSize: 8, color: C.r }}>Coll: {sh.collateral.toFixed(2)} · Fee: {dailyFee}/day</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: ffd, fontSize: 14, fontWeight: 700 }}>{sh.collateral.toFixed(2)} <span style={{ fontSize: 9, color: C.txtD }}>ÐC</span></div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: pnl >= 0 ? C.g : C.r }}>{pnl >= 0 ? "▲" : "▼"} {Math.abs(pnl).toFixed(2)} ({Math.abs(pnlPct).toFixed(1)}%)</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Trade History */}
            {tradeLog.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: C.txtD, marginBottom: 4, fontWeight: 600 }}>📜 Recent Trades</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {tradeLog.slice(0, 8).map((t, i) => (
                    <div key={i} style={{ padding: "5px 9px", background: C.inp, borderRadius: 4, border: `1px solid ${C.brdL}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span>{t.emoji}</span>
                        <span style={{ fontWeight: 600, color: t.mode === "buy" ? C.g : t.mode === "sell" ? C.r : "#a855f7", fontSize: 8, letterSpacing: 1 }}>{{ buy: "BUY", sell: "SELL", short: "SHORT", cover: "COVER" }[t.mode]}</span>
                        <span style={{ color: C.txtM }}>{t.qty} × {t.price.toFixed(4)}</span>
                      </div>
                      <span style={{ color: C.txtD, fontSize: 8 }}>{new Date(t.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* ═══ RANKINGS ═══ */}
        {pl && tab === "rankings" && (
          <div style={{ animation: "fadeUp .3s ease-out" }}>
            <div style={{ textAlign: "center", marginBottom: 8, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
              <div style={{ fontFamily: ffd, fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>Rankings</div>
              <button onClick={() => setShowLeagues(true)} style={{ width: 20, height: 20, borderRadius: "50%", border: `1px solid ${C.brd}`, background: C.inp, color: C.txtD, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🏆</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 3, marginBottom: 8 }}>
              {LEAGUES.map(l => { const n = lb.filter(p => getLeague(p.netWorth).id === l.id).length; if (!n) return null; return <span key={l.id} style={{ fontSize: 8, padding: "2px 6px", borderRadius: 10, background: C.inp, border: `1px solid ${C.brdL}`, color: l.col, fontWeight: 600 }}>{l.emoji} {n}</span>; })}
            </div>
            {lb.length === 0 ? <div style={{ textAlign: "center", padding: 20, color: C.txtM, fontStyle: "italic", fontSize: 12 }}>Empty</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {lb.map((p, i) => {
                  const isMe = p.name === pl.name; const lg = getLeague(p.netWorth);
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                  return (
                    <div key={p.name} style={{ ...CRD, padding: "7px 11px", background: isMe ? (isDk ? "rgba(255,255,255,0.05)" : "rgba(120,90,50,0.06)") : CRD.background, borderColor: isMe ? C.brdH : C.brd, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: C.inp, border: `1px solid ${C.brdL}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: ffd, fontSize: medal ? 11 : 8, fontWeight: 700 }}>{medal || i + 1}</div>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{p.name}{isMe && <span style={{ fontSize: 8, color: C.txtD }}> (you)</span>}</span>
                        <span style={{ fontSize: 9, color: lg.col }}>{lg.emoji}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontFamily: ffd, fontSize: 12, fontWeight: 700 }}>{p.netWorth.toFixed(0)} <span style={{ fontSize: 8, color: C.txtD }}>ÐC</span></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Leagues popup */}
        {showLeagues && (
          <div style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)", padding: 16 }} onClick={() => setShowLeagues(false)}>
            <div onClick={e => e.stopPropagation()} style={{ ...CRD, padding: "22px 20px", maxWidth: 380, width: "100%", animation: "fadeUp .3s ease-out" }}>
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>🏆</div>
                <div style={{ fontFamily: ffd, fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>Leagues</div>
                <div style={{ fontSize: 10, color: C.txtM, fontStyle: "italic", marginTop: 2 }}>Rank up by growing your net worth</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {LEAGUES.map((l, i) => {
                  const isCurrent = league.id === l.id;
                  const count = lb.filter(p => getLeague(p.netWorth).id === l.id).length;
                  const progress = isCurrent && l.max < Infinity ? Math.min(100, ((nw - l.min) / (l.max - l.min)) * 100) : isCurrent ? 100 : 0;
                  return (
                    <div key={l.id} style={{ padding: "10px 12px", background: isCurrent ? (isDk ? "rgba(255,255,255,0.06)" : "rgba(120,90,50,0.06)") : C.inp, borderRadius: 5, border: `1px solid ${isCurrent ? l.col + "40" : C.brdL}`, position: "relative", overflow: "hidden" }}>
                      {isCurrent && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${progress}%`, background: l.col + "12", transition: "width .3s" }} />}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 18 }}>{l.emoji}</span>
                          <div>
                            <div style={{ fontFamily: ffd, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: isCurrent ? l.col : C.txt }}>{l.name}{isCurrent ? " ←" : ""}</div>
                            <div style={{ fontSize: 9, color: C.txtD }}>{l.min.toLocaleString()}{l.max < Infinity ? ` — ${l.max.toLocaleString()}` : "+"} ÐC</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {count > 0 && <div style={{ fontSize: 9, color: C.txtM }}>{count} trader{count !== 1 ? "s" : ""}</div>}
                          {isCurrent && l.max < Infinity && <div style={{ fontSize: 8, color: l.col, fontWeight: 600 }}>{(l.max - nw).toFixed(0)} to next</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setShowLeagues(false)} style={{ ...BTN, width: "100%", padding: "9px", marginTop: 10, fontSize: 10, fontWeight: 600, color: C.txtM }}>Close</button>
            </div>
          </div>
        )}

        <footer style={{ textAlign: "center", marginTop: 16, paddingTop: 8, borderBottom: `1px solid ${C.brdL}` }}>
          <p style={{ fontSize: 9, fontStyle: "italic", color: C.txtF }}>Trade commodities · ride the events · climb the ranks</p>
        </footer>
      </div>

      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes popIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
        @keyframes breathe{0%,100%{opacity:.85}50%{opacity:1}}
        @keyframes cardIn{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes glow{0%,100%{box-shadow:0 0 2px rgba(45,122,62,0.1)}50%{box-shadow:0 0 8px rgba(45,122,62,0.2)}}
        input[type="number"]::-webkit-inner-spin-button,input[type="number"]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
        input[type="number"]{-moz-appearance:textfield}
        *{box-sizing:border-box}
        ::selection{background:rgba(160,90,50,0.2)}
        button{transition:all .2s ease !important}
        button:active{transform:scale(.97) !important}
      `}</style>
    </div>
  );
}
