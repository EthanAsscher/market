"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Market from "@/components/GameArtifact";

export default function GamePage() {
  const [ready, setReady] = useState(false);
  const [userName, setUserName] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      const { data: player } = await supabase
        .from("players")
        .select("name")
        .eq("id", session.user.id)
        .single();
      if (player) setUserName(player.name);
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.push("/");
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f0e8" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>⚓</div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "rgba(80,60,40,0.4)", marginTop: 12 }}>LOADING MARKET</div>
        </div>
      </div>
    );
  }

  return <Market autoSignIn={userName} onSignOut={handleSignOut} />;
}
