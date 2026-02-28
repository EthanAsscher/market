import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(req.url);
    const commodityId = searchParams.get("commodity");
    const days = parseInt(searchParams.get("days") || "7");

    if (commodityId) {
      // Fetch specific commodity history
      const { data: snapshots } = await supabase
        .from("price_snapshots")
        .select("*")
        .eq("commodity_id", commodityId)
        .order("day", { ascending: false })
        .order("tick", { ascending: false })
        .limit(days * 5760); // ~5760 ticks per day at 15s intervals

      return NextResponse.json({ snapshots: snapshots || [] });
    }

    // Fetch all current prices + market state
    const [commoditiesRes, marketRes, eventsRes] = await Promise.all([
      supabase.from("commodities").select("*"),
      supabase.from("market_state").select("*").single(),
      supabase.from("events_log").select("*").order("fired_at", { ascending: false }).limit(10),
    ]);

    return NextResponse.json({
      commodities: commoditiesRes.data || [],
      market: marketRes.data,
      recentEvents: eventsRes.data || [],
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
