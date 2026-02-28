import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ═══ Browser client (used in React components) ═══
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ═══ Server client with service role (used in API routes) ═══
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ═══ Database types ═══
export interface Player {
  id: string;
  name: string;
  wallet: number;
  savings: number;
  loan: number;
  loan_due_day: number | null;
  total_claimed: number;
  last_claim_day: number;
  ad_claimed_today: boolean;
  streak: number;
  bank_unlocked: boolean;
  created_at: string;
}

export interface Holding {
  player_id: string;
  commodity_id: string;
  quantity: number;
  cost_basis: number;
}

export interface Short {
  player_id: string;
  commodity_id: string;
  quantity: number;
  entry_price: number;
  collateral: number;
}

export interface CommodityRow {
  id: string;
  price: number;
  bank_held: number;
  player_held: number;
  total_shares: number;
  volume_today: number;
}

export interface PriceSnapshot {
  commodity_id: string;
  day: number;
  tick: number;
  price: number;
  timestamp: string;
}

export interface MarketState {
  id: number;
  current_day: number;
  day_start_at: string;
  money_supply: number;
  total_claims: number;
  bank_reserves: number;
  updated_at: string;
}

export interface TradeRecord {
  id: number;
  player_id: string;
  commodity_id: string;
  action: string;
  quantity: number;
  price: number;
  day: number;
  created_at: string;
}
