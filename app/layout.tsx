import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "IIST Placement Portal",
    template: "%s | IIST Placement Portal",
  },
  description:
    "Indian Institute of Space Science and Technology — Career Development & Placement Management Portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Phase 6: reading the per-request nonce here (set by middleware.ts) is
  // required for Next's nonce-based CSP support — calling headers() in a
  // Server Component in the request path is how Next detects the nonce and
  // applies it to its own inline bootstrap/hydration scripts automatically.
  // We have no custom inline <script> tags of our own to nonce explicitly.
  // See https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
  headers().get("x-nonce");

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
