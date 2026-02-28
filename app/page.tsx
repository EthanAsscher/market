"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LandingPage() {
  const [mode, setMode] = useState<"landing" | "signin" | "signup">("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Check if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push("/game");
      else setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f4]">
        <div className="text-center">
          <div className="text-4xl animate-float mb-4">⚓</div>
          <div className="font-serif text-sm text-gray-400 animate-breathe tracking-[4px] uppercase">
            Loading Market
          </div>
        </div>
      </div>
    );
  }

  const handleSignUp = async () => {
    setError("");
    if (username.trim().length < 2) { setError("Name must be at least 2 characters"); return; }
    if (username.trim().length > 24) { setError("Name must be under 24 characters"); return; }
    if (!email || !password) { setError("Email and password required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      // Check if username is taken
      const { data: existing } = await supabase
        .from("players")
        .select("name")
        .ilike("name", username.trim())
        .single();
      
      if (existing) { setError("That name is already taken"); setLoading(false); return; }

      // Sign up
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (authError) { setError(authError.message); setLoading(false); return; }
      if (!data.user) { setError("Something went wrong"); setLoading(false); return; }

      // Create player row
      const { error: playerError } = await supabase.from("players").insert({
        id: data.user.id,
        name: username.trim(),
        wallet: 0,
        last_claim_day: 0,
      });
      if (playerError) { setError(playerError.message); setLoading(false); return; }

      router.push("/game");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    }
    setLoading(false);
  };

  const handleSignIn = async () => {
    setError("");
    if (!email || !password) { setError("Email and password required"); return; }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }
    router.push("/game");
  };

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/game` },
    });
  };

  const inputStyle = "w-full px-4 py-3 rounded-lg border border-gray-200 bg-white font-serif text-sm focus:outline-none focus:border-gray-400 transition-colors";
  const btnPrimary = "w-full py-3 rounded-lg bg-[#2d4a2d] text-white font-serif text-sm font-semibold hover:bg-[#3a5c3a] transition-colors disabled:opacity-50";
  const btnSecondary = "w-full py-3 rounded-lg border border-gray-200 bg-white font-serif text-sm font-medium hover:bg-gray-50 transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f4] px-4">
      <div className="w-full max-w-sm">
        {/* Landing */}
        {mode === "landing" && (
          <div className="text-center animate-fadeUp">
            <div className="text-6xl mb-3 animate-float">🏴‍☠️</div>
            <h1 className="font-serif text-3xl font-bold text-gray-900 mb-1 tracking-tight">
              Market
            </h1>
            <p className="font-serif text-sm text-gray-500 mb-8">
              Trade exotic commodities. Build your fortune.
            </p>

            <div className="space-y-3">
              <button onClick={() => setMode("signup")} className={btnPrimary}>
                Create Account
              </button>
              <button onClick={() => setMode("signin")} className={btnSecondary}>
                Sign In
              </button>
              <button onClick={handleGoogleSignIn} className={btnSecondary + " flex items-center justify-center gap-2"}>
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>
            </div>

            <p className="mt-6 text-xs text-gray-400">
              A new market day every 24 hours
            </p>
          </div>
        )}

        {/* Sign Up */}
        {mode === "signup" && (
          <div className="animate-fadeUp">
            <button onClick={() => { setMode("landing"); setError(""); }} className="text-sm text-gray-400 mb-4 hover:text-gray-600">
              ← Back
            </button>
            <h2 className="font-serif text-2xl font-bold text-gray-900 mb-1">Create Account</h2>
            <p className="font-serif text-sm text-gray-500 mb-6">Choose your trading name wisely, Captain</p>

            <div className="space-y-3">
              <input
                type="text" placeholder="Trading Name" value={username}
                onChange={e => setUsername(e.target.value)} className={inputStyle}
                maxLength={24} autoFocus
              />
              <input
                type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)} className={inputStyle}
              />
              <input
                type="password" placeholder="Password (6+ characters)" value={password}
                onChange={e => setPassword(e.target.value)} className={inputStyle}
                onKeyDown={e => e.key === "Enter" && handleSignUp()}
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button onClick={handleSignUp} disabled={loading} className={btnPrimary}>
                {loading ? "Creating..." : "Set Sail ⚓"}
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-gray-400">
              Already have an account?{" "}
              <button onClick={() => { setMode("signin"); setError(""); }} className="underline hover:text-gray-600">
                Sign in
              </button>
            </p>
          </div>
        )}

        {/* Sign In */}
        {mode === "signin" && (
          <div className="animate-fadeUp">
            <button onClick={() => { setMode("landing"); setError(""); }} className="text-sm text-gray-400 mb-4 hover:text-gray-600">
              ← Back
            </button>
            <h2 className="font-serif text-2xl font-bold text-gray-900 mb-1">Welcome Back</h2>
            <p className="font-serif text-sm text-gray-500 mb-6">Your fleet awaits, Captain</p>

            <div className="space-y-3">
              <input
                type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)} className={inputStyle}
                autoFocus
              />
              <input
                type="password" placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)} className={inputStyle}
                onKeyDown={e => e.key === "Enter" && handleSignIn()}
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button onClick={handleSignIn} disabled={loading} className={btnPrimary}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <button onClick={handleGoogleSignIn} className={btnSecondary + " flex items-center justify-center gap-2"}>
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-gray-400">
              Need an account?{" "}
              <button onClick={() => { setMode("signup"); setError(""); }} className="underline hover:text-gray-600">
                Create one
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
