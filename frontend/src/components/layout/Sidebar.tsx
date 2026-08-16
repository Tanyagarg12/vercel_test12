"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { SunMobilityLogo, SunMobilityWordmark } from "./SunMobilityLogo";
import {
  Activity,
  BatteryCharging,
  Bell,
  LayoutGrid,
  Map,
  Plug,
  Settings,
  Sparkles,
  Warehouse,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  badge?: number;
}

export function Sidebar({ alertCount }: { alertCount: number }) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { href: "/", label: "Dashboard", icon: LayoutGrid },
    { href: "/live-monitoring", label: "Live Monitoring", icon: Activity },
    { href: "/stations", label: "Stations", icon: Warehouse },
    { href: "/chargers", label: "Chargers", icon: Plug },
    { href: "/batteries", label: "Batteries", icon: BatteryCharging },
    { href: "/ai-predictions", label: "AI Predictions", icon: Sparkles },
    { href: "/alerts", label: "Alerts", icon: Bell, badge: alertCount },
    { href: "/map-view", label: "Map View", icon: Map },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="flex h-screen w-[212px] flex-none flex-col border-r border-[var(--border-hairline)] bg-[var(--surface-1)]">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5" aria-label="SUN MOBILITY — dashboard">
        <SunMobilityLogo size={38} />
        <SunMobilityWordmark />
      </Link>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-[var(--series-1)]/10 text-[var(--series-1)]"
                  : "text-text-secondary hover:bg-[var(--surface-2)] hover:text-text-primary",
              )}
            >
              <Icon size={16} strokeWidth={2} className="flex-none" />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--status-critical)] px-1.5 text-[11px] font-semibold text-white">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
