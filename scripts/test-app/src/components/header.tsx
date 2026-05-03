"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Bell, User } from "lucide-react";

interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function Header() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => { if (data.user) setUser(data.user); })
      .catch(() => {});
  }, []);

  return (
    <header
      data-testid="header"
      aria-label="Top header"
      className="fixed top-0 left-56 right-0 h-14 bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 flex items-center justify-between px-6 z-30"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 font-mono">
          pwcli-test-app v0.1.0
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button
          data-testid="header-notifications"
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all duration-150"
        >
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full" aria-hidden="true" />
        </button>

        {/* Theme toggle */}
        <button
          data-testid="theme-toggle"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => setIsDark((v) => !v)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all duration-150"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            data-testid="header-user-menu"
            aria-label="User menu"
            aria-expanded={showUserMenu}
            aria-haspopup="menu"
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 transition-all duration-150"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
              <User size={14} className="text-white" />
            </div>
            {user && (
              <div className="text-left hidden sm:block">
                <div className="text-xs font-medium text-zinc-200">{user.name}</div>
                <div className="text-xs text-zinc-500">{user.role}</div>
              </div>
            )}
          </button>

          {showUserMenu && (
            <div
              data-testid="user-menu-dropdown"
              role="menu"
              aria-label="User menu options"
              className="absolute right-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 z-50"
            >
              {user && (
                <div className="px-3 py-2 border-b border-zinc-700">
                  <div className="text-xs font-medium text-zinc-200 truncate">{user.email}</div>
                  <div className="text-xs text-zinc-500 capitalize">{user.role}</div>
                </div>
              )}
              <button
                role="menuitem"
                data-testid="user-menu-logout"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-zinc-700 transition-colors"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
