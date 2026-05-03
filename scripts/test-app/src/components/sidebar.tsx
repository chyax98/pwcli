"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FormInput,
  MousePointer2,
  Layers,
  Zap,
  ExternalLink,
  Network,
  LogOut,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
  { href: "/forms", label: "Forms", icon: FormInput, testId: "nav-forms" },
  { href: "/interactions", label: "Interactions", icon: MousePointer2, testId: "nav-interactions" },
  { href: "/modals", label: "Modals", icon: Layers, testId: "nav-modals" },
  { href: "/dynamic", label: "Dynamic", icon: Zap, testId: "nav-dynamic" },
  { href: "/tabs", label: "Multi-Tab", icon: ExternalLink, testId: "nav-tabs" },
  { href: "/network", label: "Network", icon: Network, testId: "nav-network" },
];

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      data-testid="sidebar"
      aria-label="Main navigation"
      className="fixed left-0 top-0 h-full w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col z-40"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-zinc-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Terminal size={16} className="text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold text-zinc-100">pwcli</div>
          <div className="text-xs text-zinc-500">Test App</div>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Sidebar navigation" className="flex-1 py-3 overflow-y-auto">
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-testid={item.testId}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-indigo-600/20 text-indigo-400 border border-indigo-600/30"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                  )}
                >
                  <Icon size={16} className={cn(isActive ? "text-indigo-400" : "text-zinc-500")} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-800">
        <button
          data-testid="sidebar-logout"
          onClick={handleLogout}
          aria-label="Log out"
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-all duration-150"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
