import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market — Pirate Trading Game",
  description: "Trade exotic commodities, build your fortune, and compete on the leaderboard. A new market day every 24 hours.",
  openGraph: {
    title: "Market — Pirate Trading Game",
    description: "Trade exotic commodities. Build your fortune. Daily market resets.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#faf8f4]">
        {children}
      </body>
    </html>
  );
}
