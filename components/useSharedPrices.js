"use client";
import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function useSharedPrices(enabled) {
  const [prices, setPrices] = useState(null);
  const supabase = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    // Create client
    supabase.current = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Fetch initial prices
    const fetchPrices = async () => {
      const { data } = await supabase.current
        .from("commodities")
        .select("*");
      if (data) {
        const map = {};
        data.forEach(c => {
          map[c.id] = {
            price: parseFloat(c.price),
            bankHeld: c.bank_held,
            playerHeld: c.player_held,
            totalShares: c.total_shares,
            volumeToday: c.volume_today,
          };
        });
        setPrices(map);
      }
    };

    fetchPrices();

    // Subscribe to realtime price updates
    const channel = supabase.current
      .channel("commodity-prices")
      .on("postgres_changes", 
        { event: "UPDATE", schema: "public", table: "commodities" },
        (payload) => {
          const c = payload.new;
          setPrices(prev => ({
            ...prev,
            [c.id]: {
              price: parseFloat(c.price),
              bankHeld: c.bank_held,
              playerHeld: c.player_held,
              totalShares: c.total_shares,
              volumeToday: c.volume_today,
            }
          }));
        }
      )
      .subscribe();

    // Also poll every 15s as backup in case realtime misses
    const poll = setInterval(fetchPrices, 15000);

    return () => {
      clearInterval(poll);
      if (supabase.current) supabase.current.removeChannel(channel);
    };
  }, [enabled]);

  return prices;
}
