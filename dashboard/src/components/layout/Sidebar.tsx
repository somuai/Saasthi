"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Users, 
  UserSquare2, 
  BarChart3, 
  BellRing,
  Settings,
  MapPin,
  GitBranch,
  IndianRupee,
  PieChart,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";

interface RouteItem {
  label: string;
  icon: LucideIcon;
  href: string;
  show: boolean;
}

interface RouteGroup {
  section: string;
  items: RouteItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isSupervisor = !!user?.is_supervisor;

  const routeGroups: RouteGroup[] = [
    {
      section: "Overview",
      items: [
        { label: "Home", icon: Home, href: "/", show: true },
        { label: "Live Command Map", icon: MapPin, href: "/map", show: true },
      ],
    },
    {
      section: "Clinical",
      items: [
        { label: "Patients", icon: UserSquare2, href: "/patients", show: true },
        { label: "Risk Triage", icon: ShieldAlert, href: "/triage", show: !isSupervisor },
        { label: "Referrals", icon: GitBranch, href: "/referrals", show: true },
      ],
    },
    {
      section: "Operations",
      items: [
        { label: "Workers", icon: Users, href: "/workers", show: isSupervisor },
        { label: "Incentives", icon: IndianRupee, href: "/incentives", show: isSupervisor },
        { label: "Analytics", icon: PieChart, href: "/analytics", show: true },
        { label: "Reports", icon: BarChart3, href: "/reports", show: true },
      ],
    },
    {
      section: "System",
      items: [
        { label: "Alerts", icon: BellRing, href: "/alerts", show: true },
        { label: "Settings", icon: Settings, href: "/settings", show: true },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#1e293b] text-white w-64 flex-shrink-0 shadow-xl">
      <div className="flex flex-col items-center justify-center py-6 px-4 border-b border-slate-700/50 space-y-3">
        <Image
          src="/shaasthi-mark.png"
          alt="Shaasthi Logo"
          width={56}
          height={66}
          className="rounded-lg shadow-sm object-contain"
        />
        <h1 className="text-xl font-bold tracking-tight">Saasthi Admin</h1>
      </div>
      <div className="flex-1 py-4 px-3 space-y-5 overflow-y-auto">
        {routeGroups.map((group) => {
          const visibleItems = group.items.filter(r => r.show);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.section}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-3 mb-2">
                {group.section}
              </p>
              <div className="space-y-1">
                {visibleItems.map((route) => (
                  <Link
                    key={route.href}
                    href={route.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium",
                      pathname === route.href || (pathname.startsWith(route.href) && route.href !== "/")
                        ? "bg-[#416CAF] text-white shadow-md shadow-blue-500/10"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <route.icon className="h-4.5 w-4.5" />
                    {route.label}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
