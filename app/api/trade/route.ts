import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { createClient as createAuthClient } from "@supabase/supabase-js";
import { calcSpread, calcImpact } from "@/lib/engine";
import { ALL_COMMODITIES, SHORT_COLLATERAL, SHORT_BORROW_RATE, BANK_UNLOCK_NW } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    // ─── Auth ───
    const authHeader = req.headers.get("authorization");
    const supabase = createServiceClient();
    
    // Get user from session cookie
    const token = req.cookies.get("sb-access-token")?.value
      || authHeader?.replace("Bearer ", "");
    
    // Use anon client to verify the user
    const anonClient = createAuthClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // For Next.js with Supabase SSR, we get the session from cookies
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ─── Parse Request ───
    const body = await req.json();
    const { commodity_id, action, quantity } = body;

    if (!commodity_id || !action || !quantity || quantity <= 0) {
      return NextResponse.json({ error: "Invalid trade parameters" }, { status: 400 });
    }
    if (!["buy", "sell", "short", "cover"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const commodity = ALL_COMMODITIES.find(c => c.id === commodity_id);
    if (!commodity) {
      return NextResponse.json({ error: "Unknown commodity" }, { status: 400 });
    }

    // ─── Load Current State (use service role for writes) ───
    const [playerRes, holdingRes, shortRes, commodityRes, marketRes] = await Promise.all([
      supabase.from("players").select("*").eq("id", user.id).single(),
      supabase.from("holdings").select("*").eq("player_id", user.id).eq("commodity_id", commodity_id).maybeSingle(),
      supabase.from("shorts").select("*").eq("player_id", user.id).eq("commodity_id", commodity_id).maybeSingle(),
      supabase.from("commodities").select("*").eq("id", commodity_id).single(),
      supabase.from("market_state").select("*").single(),
    ]);

    if (playerRes.error) throw playerRes.error;
    const player = playerRes.data;
    const holding = holdingRes.data;
    const short = shortRes.data;
    const comm = commodityRes.data!;
    const market = marketRes.data!;

    // ─── Count players for spread/impact calc ───
    const { count: playerCount } = await supabase
      .from("players").select("*", { count: "exact", head: true });

    const { bid, ask } = calcSpread(comm.price, commodity.vol, playerCount || 1);
    const qty = Math.floor(quantity);

    let newWallet = player.wallet;
    let newHolding = holding ? { ...holding } : null;
    let newShort = short ? { ...short } : null;
    let newCommPrice = comm.price;
    let newBankHeld = comm.bank_held;
    let newPlayerHeld = comm.player_held;
    let tradeTotal = 0;

    // ─── Execute Trade ───
    switch (action) {
      case "buy": {
        const total = qty * ask;
        if (total > player.wallet) {
          return NextResponse.json({ error: `Insufficient funds. Need ${total.toFixed(2)} ÐC` }, { status: 400 });
        }
        if (qty > comm.bank_held) {
          return NextResponse.json({ error: "Not enough shares available" }, { status: 400 });
        }

        newWallet = +(player.wallet - total).toFixed(4);
        tradeTotal = total;
        newBankHeld -= qty;
        newPlayerHeld += qty;
        newCommPrice = calcImpact(comm.price, qty, comm.total_shares, "buy");

        // Update or create holding
        if (newHolding) {
          const prevQty = newHolding.quantity;
          const prevCost = newHolding.cost_basis;
          newHolding.cost_basis = +((prevCost * prevQty + total) / (prevQty + qty)).toFixed(6);
          newHolding.quantity += qty;
        } else {
          newHolding = { player_id: user.id, commodity_id, quantity: qty, cost_basis: ask };
        }
        break;
      }

      case "sell": {
        if (!holding || holding.quantity < qty) {
          return NextResponse.json({ error: "Insufficient holdings" }, { status: 400 });
        }

        const total = qty * bid;
        newWallet = +(player.wallet + total).toFixed(4);
        tradeTotal = total;
        newBankHeld += qty;
        newPlayerHeld -= qty;
        newCommPrice = calcImpact(comm.price, qty, comm.total_shares, "sell");

        newHolding = { ...holding, quantity: holding.quantity - qty };
        if (newHolding.quantity <= 0) newHolding = null; // Will delete
        break;
      }

      case "short": {
        const collateral = +(qty * ask * SHORT_COLLATERAL).toFixed(4);
        if (collateral > player.wallet) {
          return NextResponse.json({ error: `Need ${collateral.toFixed(2)} ÐC collateral` }, { status: 400 });
        }
        if (qty > comm.bank_held) {
          return NextResponse.json({ error: "Not enough shares to borrow" }, { status: 400 });
        }

        newWallet = +(player.wallet - collateral).toFixed(4);
        tradeTotal = collateral;
        newPlayerHeld += qty;
        newCommPrice = calcImpact(comm.price, qty, comm.total_shares, "sell");

        if (newShort) {
          const totalQty = newShort.quantity + qty;
          newShort.entry_price = +((newShort.entry_price * newShort.quantity + ask * qty) / totalQty).toFixed(6);
          newShort.quantity = totalQty;
          newShort.collateral = +(newShort.collateral + collateral).toFixed(4);
        } else {
          newShort = { player_id: user.id, commodity_id, quantity: qty, entry_price: ask, collateral };
        }
        break;
      }

      case "cover": {
        if (!short || short.quantity < qty) {
          return NextResponse.json({ error: "No short position to cover" }, { status: 400 });
        }

        const coverCost = qty * ask;
        const pnl = (short.entry_price - ask) * qty;
        const collateralReturn = +(short.collateral * (qty / short.quantity)).toFixed(4);
        const netReturn = +(collateralReturn + pnl).toFixed(4);
        
        if (netReturn < 0 && Math.abs(netReturn) > player.wallet) {
          return NextResponse.json({ error: "Insufficient funds to cover loss" }, { status: 400 });
        }

        newWallet = +(player.wallet + netReturn).toFixed(4);
        tradeTotal = coverCost;
        newPlayerHeld -= qty;
        newBankHeld += qty;
        newCommPrice = calcImpact(comm.price, qty, comm.total_shares, "cover");

        if (short.quantity - qty <= 0) {
          newShort = null; // Will delete
        } else {
          newShort = {
            ...short,
            quantity: short.quantity - qty,
            collateral: +(short.collateral - collateralReturn).toFixed(4),
          };
        }
        break;
      }
    }

    // ─── Write Updates (atomic) ───
    // Update player wallet
    await supabase.from("players").update({ wallet: newWallet }).eq("id", user.id);

    // Update commodity
    await supabase.from("commodities").update({
      price: newCommPrice,
      bank_held: newBankHeld,
      player_held: newPlayerHeld,
      volume_today: comm.volume_today + qty,
    }).eq("id", commodity_id);

    // Update holding
    if (newHolding && newHolding.quantity > 0) {
      await supabase.from("holdings").upsert(newHolding);
    } else if (holding) {
      await supabase.from("holdings").delete().eq("player_id", user.id).eq("commodity_id", commodity_id);
    }

    // Update short
    if (newShort && newShort.quantity > 0) {
      await supabase.from("shorts").upsert(newShort);
    } else if (short) {
      await supabase.from("shorts").delete().eq("player_id", user.id).eq("commodity_id", commodity_id);
    }

    // Log trade
    await supabase.from("trades").insert({
      player_id: user.id,
      commodity_id,
      action,
      quantity: qty,
      price: action === "buy" || action === "cover" ? ask : bid,
      total: tradeTotal,
      day: market.current_day,
    });

    return NextResponse.json({
      success: true,
      wallet: newWallet,
      price: newCommPrice,
      action,
      quantity: qty,
    });

  } catch (e: any) {
    console.error("Trade error:", e);
    return NextResponse.json({ error: e.message || "Trade failed" }, { status: 500 });
  }
}
