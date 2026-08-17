import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import logoImg from "@/assets/logo.png";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Flag,
  ArrowRightLeft,
  Coins,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronRight,
  FileText,
  Heart,
  Activity,
  Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

const ALL_ROLES = [
  "admin", "supervisor", "auditor", "referral_partner",
  "state_admin", "district_officer", "block_manager",
] as const;

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  { path: "/god-view", label: "God View", icon: Map, roles: ["admin", "supervisor", "district_officer", "block_manager"] as const },
  { path: "/doctor/dashboard", label: "Doctor Dashboard", icon: Activity, roles: ["admin", "auditor", "referral_partner"] as const },
  { path: "/patients", label: "Patients", icon: Users, roles: ALL_ROLES },
  { path: "/maternal", label: "Pregnancy Register", icon: Heart, roles: ["admin", "supervisor", "auditor", "state_admin", "district_officer", "block_manager"] as const },
  { path: "/ashas", label: "ASHA Workers", icon: Stethoscope, roles: ["admin", "supervisor", "auditor", "state_admin", "district_officer", "block_manager"] as const },
  { path: "/flags", label: "Flags", icon: Flag, roles: ["admin", "supervisor", "auditor", "state_admin", "district_officer", "block_manager"] as const },
  { path: "/referrals", label: "Referrals", icon: ArrowRightLeft, roles: ALL_ROLES },
  { path: "/incentives", label: "Incentives", icon: Coins, roles: ["admin", "supervisor", "auditor", "state_admin", "district_officer", "block_manager"] as const },
  { path: "/reports", label: "Monthly Reports", icon: FileText, roles: ["admin", "supervisor", "auditor", "state_admin", "district_officer", "block_manager"] as const },
  { path: "/admin", label: "Admin", icon: Shield, roles: ["admin"] as const },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/50 font-sans">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-all duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-slate-200/60 shadow-premium transition-all duration-300 ease-in-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100/80">
          <Link to="/" className="flex items-center gap-2.5 group" onClick={() => setSidebarOpen(false)}>
            <img src={logoImg} alt="Shaasthi Logo" className="h-8 w-8 object-contain rounded-lg shadow-sm group-hover:scale-105 transition-transform duration-200" />
            <div>
              <div className="text-sm font-bold text-slate-900 tracking-tight">Shaasthi</div>
              <div className="text-[10px] font-semibold text-teal-650 tracking-wide uppercase -mt-0.5">Supervisor Portal</div>
            </div>
          </Link>
          <button
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems
            .filter((item) => (item.roles as readonly string[]).includes(user?.role || ""))
            .map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-teal-50/80 text-teal-800 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.12)] font-semibold"
                    : "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900"
                )}
              >
                <Icon className={cn(
                  "h-4.5 w-4.5 flex-shrink-0 transition-colors",
                  isActive ? "text-teal-600" : "text-slate-400 group-hover:text-slate-600"
                )} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute right-3.5 flex h-1.5 w-1.5 rounded-full bg-teal-650" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/30">
          <div className="flex items-center gap-3 mb-4 p-2 rounded-xl bg-white border border-slate-100 shadow-sm">
            <Avatar className="h-9 w-9 border border-slate-100 shadow-inner">
              <AvatarFallback className="bg-gradient-to-br from-teal-500 to-teal-700 text-white text-xs font-bold">
                {(user?.first_name?.[0] || user?.phone?.[0] || "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-800 truncate">
                {user?.first_name || user?.phone || "User"}
              </div>
              <div className="text-[10px] text-teal-600 font-bold uppercase tracking-wider capitalize">{user?.role || "—"}</div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all duration-200 rounded-xl"
            onClick={logout}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Log out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden flex items-center h-14 px-4 bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm z-30">
          <button
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 mr-2 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="Shaasthi Logo" className="h-7 w-7 object-contain rounded-md" />
            <span className="font-bold text-sm text-slate-900 tracking-tight">Shaasthi</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
