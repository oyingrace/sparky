"use client";

import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/goals", label: "Goals" },
  { href: "/markets", label: "Markets" },
  { href: "/notifications", label: "Alerts" },
  { href: "/profile", label: "Profile" },
  { href: "/pool", label: "Pool" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="app-header">
      <div>
        <Link href="/" className="brand">
          Sparky
        </Link>
        <nav className="nav-links">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname.startsWith(l.href) ? "nav-active" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <ConnectButton />
    </header>
  );
}
