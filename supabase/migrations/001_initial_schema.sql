-- ═══════════════════════════════════════════════════════════
--  MARKET — Database Schema
--  Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════

-- ─── Players ───
create table public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  name text unique not null check (char_length(name) between 2 and 24),
  wallet decimal not null default 0,
  savings decimal not null default 0,
  loan decimal not null default 0,
  loan_due_day int,
  total_claimed decimal not null default 0,
  last_claim_day int not null default 0,
  ad_claimed_today boolean not null default false,
  streak int not null default 0,
  bank_unlocked boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─── Holdings (long positions) ───
create table public.holdings (
  player_id uuid not null references public.players(id) on delete cascade,
  commodity_id text not null,
  quantity int not null default 0,
  cost_basis decimal not null default 0,
  primary key (player_id, commodity_id)
);

-- ─── Short Positions ───
create table public.shorts (
  player_id uuid not null references public.players(id) on delete cascade,
  commodity_id text not null,
  quantity int not null default 0,
  entry_price decimal not null,
  collateral decimal not null,
  primary key (player_id, commodity_id)
);

-- ─── Market State (single row) ───
create table public.market_state (
  id int primary key default 1 check (id = 1),
  current_day int not null default 1,
  day_start_at timestamptz not null default now(),
  money_supply decimal not null default 0,
  total_claims int not null default 0,
  bank_reserves decimal not null default 10000,
  ticks_since_event int not null default 0,
  updated_at timestamptz not null default now()
);

-- ─── Commodities (live prices) ───
create table public.commodities (
  id text primary key,
  price decimal not null,
  base_price decimal not null,
  bank_held int not null,
  player_held int not null default 0,
  total_shares int not null,
  volume_today int not null default 0
);

-- ─── Price Snapshots (for charts) ───
create table public.price_snapshots (
  commodity_id text not null references public.commodities(id),
  day int not null,
  tick int not null,
  price decimal not null,
  created_at timestamptz not null default now(),
  primary key (commodity_id, day, tick)
);

-- ─── Events Log ───
create table public.events_log (
  id bigserial primary key,
  day int not null,
  tick int not null,
  event_name text not null,
  event_emoji text,
  targets text[] not null,
  effect decimal not null,
  description text,
  fired_at timestamptz not null default now()
);

-- ─── Trade History ───
create table public.trades (
  id bigserial primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  commodity_id text not null,
  action text not null check (action in ('buy', 'sell', 'short', 'cover')),
  quantity int not null,
  price decimal not null,
  total decimal not null,
  day int not null,
  created_at timestamptz not null default now()
);

-- ═══ INDEXES ═══
create index idx_trades_player on public.trades(player_id, created_at desc);
create index idx_trades_day on public.trades(day);
create index idx_snapshots_commodity_day on public.price_snapshots(commodity_id, day desc);
create index idx_events_day on public.events_log(day);

-- ═══ ROW LEVEL SECURITY ═══
alter table public.players enable row level security;
alter table public.holdings enable row level security;
alter table public.shorts enable row level security;
alter table public.market_state enable row level security;
alter table public.commodities enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.events_log enable row level security;
alter table public.trades enable row level security;

-- Players: read own, read names for leaderboard
create policy "Players can read own data" on public.players
  for select using (auth.uid() = id);
create policy "Anyone can read player names" on public.players
  for select using (true);
create policy "Service role manages players" on public.players
  for all using (auth.role() = 'service_role');

-- Holdings: own data only
create policy "Players can read own holdings" on public.holdings
  for select using (auth.uid() = player_id);
create policy "Service role manages holdings" on public.holdings
  for all using (auth.role() = 'service_role');

-- Shorts: own data only
create policy "Players can read own shorts" on public.shorts
  for select using (auth.uid() = player_id);
create policy "Service role manages shorts" on public.shorts
  for all using (auth.role() = 'service_role');

-- Market state: everyone can read
create policy "Anyone can read market state" on public.market_state
  for select using (true);
create policy "Service role manages market" on public.market_state
  for all using (auth.role() = 'service_role');

-- Commodities: everyone can read
create policy "Anyone can read commodities" on public.commodities
  for select using (true);
create policy "Service role manages commodities" on public.commodities
  for all using (auth.role() = 'service_role');

-- Price snapshots: everyone can read
create policy "Anyone can read snapshots" on public.price_snapshots
  for select using (true);
create policy "Service role manages snapshots" on public.price_snapshots
  for all using (auth.role() = 'service_role');

-- Events: everyone can read
create policy "Anyone can read events" on public.events_log
  for select using (true);
create policy "Service role manages events" on public.events_log
  for all using (auth.role() = 'service_role');

-- Trades: own data only
create policy "Players can read own trades" on public.trades
  for select using (auth.uid() = player_id);
create policy "Service role manages trades" on public.trades
  for all using (auth.role() = 'service_role');

-- ═══ SEED DATA ═══

-- Market state
insert into public.market_state (current_day, day_start_at, money_supply, bank_reserves)
values (1, now(), 10000, 10000);

-- Commodities
insert into public.commodities (id, price, base_price, bank_held, total_shares) values
  ('spices',     0.10, 0.10, 500000,  500000),
  ('silk',       0.10, 0.10, 200000,  200000),
  ('rum',        0.10, 0.10, 800000,  800000),
  ('gems',       0.10, 0.10, 150000,  150000),
  ('parrots',    0.10, 0.10, 1000000, 1000000),
  ('cannons',    0.10, 0.10, 300000,  300000),
  ('tulips',     0.10, 0.10, 2000000, 2000000),
  ('contraband', 0.10, 0.10, 100000,  100000);

-- ═══ REALTIME ═══
-- Enable realtime on commodities so clients get live price updates
alter publication supabase_realtime add table public.commodities;
alter publication supabase_realtime add table public.market_state;
alter publication supabase_realtime add table public.events_log;
