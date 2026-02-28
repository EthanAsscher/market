import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { commodity_id, new_price, quantity, action } = body;

    if (!commodity_id || !new_price || !quantity || !action) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: comm } = await supabase
      .from("commodities")
      .select("*")
      .eq("id", commodity_id)
      .single();

    if (!comm) {
      return NextResponse.json({ error: "Unknown commodity" }, { status: 404 });
    }

    const isBuy = action === "buy" || action === "cover";
    const updates = {
      price: new_price,
      bank_held: isBuy ? comm.bank_held - quantity : comm.bank_held + quantity,
      player_held: isBuy ? comm.player_held + quantity : Math.max(0, comm.player_held - quantity),
      volume_today: comm.volume_today + quantity,
    };

    await supabase.from("commodities").update(updates).eq("id", commodity_id);

    return NextResponse.json({ success: true, price: new_price });
  } catch (e) {
    console.error("Price update error:", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
