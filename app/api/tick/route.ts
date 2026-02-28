import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { doTick, seededRng, tickSeed } from "@/lib/engine";
import { getCurrentDay, ALL_COMMODITIES } from "@/lib/constants";

// This endpoint should be called by a cron job every 15 seconds
// In production: Supabase pg_cron, Vercel Cron, or an external scheduler
// Protect with a secret key

export async function POST(req: NextRequest) {
  try {
    // ─── Auth: verify cron secret ───
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const currentDay = getCurrentDay();

    // ─── Load current state ───
    const [commoditiesRes, marketRes] = await Promise.all([
      supabase.from("commodities").select("*"),
      supabase.from("market_state").select("*").single(),
    ]);

    const commodities = commoditiesRes.data || [];
    const market = marketRes.data!;

    // ─── Day rollover check ───
    if (currentDay > market.current_day) {
      // New day! Reset daily volumes, update day counter
      await supabase.from("commodities").update({ volume_today: 0 }).gte("id", "");
      await supabase.from("players").update({ ad_claimed_today: false }).gte("id", "");
      await supabase.from("market_state").update({
        current_day: currentDay,
        day_start_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
    }

    // ─── Count active players ───
    const { count: playerCount } = await supabase
      .from("players").select("*", { count: "exact", head: true });

    // ─── Calculate tick number (seconds since day start / 15) ───
    const dayStart = new Date(market.day_start_at);
    const tickNum = Math.floor((Date.now() - dayStart.getTime()) / 15000);

    // ─── Build price map ───
    const prices: Record<string, number> = {};
    const bases: Record<string, number> = {};
    commodities.forEach(c => {
      prices[c.id] = c.price;
      bases[c.id] = c.base_price;
    });

    // ─── Run tick with seeded RNG (deterministic per day+tick) ───
    const rng = seededRng(tickSeed(currentDay, tickNum));
    const result = doTick({
      prices,
      bases,
      playerCount: playerCount || 1,
      ticksSinceEvent: market.ticks_since_event,
      dayRng: rng,
    });

    // ─── Write updated prices ───
    for (const commodity of commodities) {
      const newPrice = result.prices[commodity.id];
      if (newPrice !== undefined && newPrice !== commodity.price) {
        await supabase.from("commodities").update({
          price: newPrice,
        }).eq("id", commodity.id);
      }
    }

    // ─── Save price snapshot (for charts) ───
    const snapshots = ALL_COMMODITIES.map(g => ({
      commodity_id: g.id,
      day: currentDay,
      tick: tickNum,
      price: result.prices[g.id] || 0.10,
    }));
    await supabase.from("price_snapshots").upsert(snapshots);

    // ─── Log event if one fired ───
    if (result.event) {
      await supabase.from("events_log").insert({
        day: currentDay,
        tick: tickNum,
        event_name: result.event.name,
        event_emoji: result.event.emoji,
        targets: result.event.targets,
        effect: result.event.effect,
        description: result.event.desc,
      });
    }

    // ─── Update market state ───
    await supabase.from("market_state").update({
      ticks_since_event: result.ticksSinceEvent,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);

    // ─── Margin call check on all shorts ───
    const { data: allShorts } = await supabase.from("shorts").select("*");
    if (allShorts) {
      for (const s of allShorts) {
        const price = result.prices[s.commodity_id] || 0;
        const loss = (price - s.entry_price) * s.quantity;
        if (loss > s.collateral * 0.85) {
          // Margin call — force close
          const netReturn = Math.max(0, s.collateral - loss);
          await supabase.from("players").update({
            wallet: supabase.rpc ? 0 : 0, // Would use RPC for atomic increment
          }).eq("id", s.player_id);
          // For now, just delete the short and return remaining collateral
          const { data: player } = await supabase.from("players").select("wallet").eq("id", s.player_id).single();
          if (player) {
            await supabase.from("players").update({
              wallet: +(player.wallet + netReturn).toFixed(4),
            }).eq("id", s.player_id);
          }
          await supabase.from("shorts").delete().eq("player_id", s.player_id).eq("commodity_id", s.commodity_id);
          // Return shares to bank
          await supabase.from("commodities").update({
            bank_held: (commodities.find(c => c.id === s.commodity_id)?.bank_held || 0) + s.quantity,
            player_held: Math.max(0, (commodities.find(c => c.id === s.commodity_id)?.player_held || 0) - s.quantity),
          }).eq("id", s.commodity_id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      day: currentDay,
      tick: tickNum,
      event: result.event?.name || null,
      ticksSinceEvent: result.ticksSinceEvent,
    });

  } catch (e: any) {
    console.error("Tick error:", e);
    return NextResponse.json({ error: e.message || "Tick failed" }, { status: 500 });
  }
}
