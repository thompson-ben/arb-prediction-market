"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Terminal" },
  { href: "/disagreements", label: "Disagreements" },
  { href: "/review", label: "Review" },
  { href: "/history", label: "History" },
  { href: "/validation", label: "Validation" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-30 border-b border-white/10 bg-[#070a11]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        <span className="mr-3 font-mono text-sm font-semibold tracking-tight text-white">
          ARB<span className="text-emerald-400">·</span>TERMINAL
        </span>
        {LINKS.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded px-3 py-1.5 text-sm transition ${
                active
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
