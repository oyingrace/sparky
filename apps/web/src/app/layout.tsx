import type { Metadata, Viewport } from "next";
import { Figtree, JetBrains_Mono, Libre_Baskerville } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

export const dynamic = "force-dynamic";

const display = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display",
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Sparky",
  description: "Commit, stake, prove, and settle on Sui Testnet",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Sparky",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#12141a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
    >
      <body>
        <Providers>
          <div className="page-enter">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
