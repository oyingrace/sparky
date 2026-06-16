import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sparky",
  description: "Commitment infrastructure with social betting on Sui Testnet",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Sparky",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
