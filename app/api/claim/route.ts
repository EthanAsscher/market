import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { createClient as createAuthClient } from "@supabase/supabase-js";
import { getCurrentDay, DAILY_CLAIM } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient();

    // Auth — get user from cookie/header
    const token = req.cookies.get("sb-access-token")?.value
      || req.headers.get("authorization")?.replace("Bearer ", "");
    
    const anonClient = createAuthClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Load player
    const { data: player, error } = await supabase
      .from("players").select("*").eq("id", user.id).single();
    if (error) throw error;

    const currentDay = getCurrentDay();

    // Check if already claimed today
    if (player.last_claim_day >= currentDay) {
      return NextResponse.json({ error: "Already claimed today! Come back tomorrow." }, { status: 400 });
    }

    // Calculate streak
    const newStreak = player.last_claim_day === currentDay - 1 ? player.streak + 1 : 1;

    // Update player
    const { error: updateError } = await supabase.from("players").update({
      wallet: +(player.wallet + DAILY_CLAIM).toFixed(4),
      total_claimed: +(player.total_claimed + DAILY_CLAIM).toFixed(4),
      last_claim_day: currentDay,
      ad_claimed_today: false,  // Reset ad claim for new day
      streak: newStreak,
    }).eq("id", user.id);
    if (updateError) throw updateError;

    // Update market money supply
    await supabase.from("market_state").update({
      money_supply: supabase.rpc ? undefined : 0, // Will use RPC for atomic increment
      total_claims: player.total_claimed + 1,
    }).eq("id", 1);

    return NextResponse.json({
      success: true,
      amount: DAILY_CLAIM,
      streak: newStreak,
      wallet: +(player.wallet + DAILY_CLAIM).toFixed(4),
      day: currentDay,
    });

  } catch (e: any) {
    console.error("Claim error:", e);
    return NextResponse.json({ error: e.message || "Claim failed" }, { status: 500 });
  }
}
