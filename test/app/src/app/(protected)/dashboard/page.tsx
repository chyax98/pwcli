"use client";

import {
  Activity,
  Bell,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

const STATS = [
  {
    label: "Total Users",
    value: 12842,
    icon: Users,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    testId: "stat-users",
  },
  {
    label: "Active Sessions",
    value: 384,
    icon: Activity,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    testId: "stat-sessions",
  },
  {
    label: "Orders Today",
    value: 1204,
    icon: ShoppingCart,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    testId: "stat-orders",
  },
  {
    label: "Revenue",
    value: 98432,
    icon: TrendingUp,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    prefix: "$",
    testId: "stat-revenue",
  },
];

const NOTIFICATIONS = [
  { id: "n1", type: "info", title: "System update completed", time: "2 min ago", read: false },
  {
    id: "n2",
    type: "warning",
    title: "High memory usage detected",
    time: "15 min ago",
    read: false,
  },
  {
    id: "n3",
    type: "success",
    title: "Backup completed successfully",
    time: "1 hour ago",
    read: true,
  },
  {
    id: "n4",
    type: "error",
    title: "Failed login attempt detected",
    time: "2 hours ago",
    read: true,
  },
  {
    id: "n5",
    type: "info",
    title: "New user registration: alice@example.com",
    time: "3 hours ago",
    read: true,
  },
];

const QUICK_ACTIONS = [
  { label: "Run Diagnostics", href: "/network", testId: "action-diagnostics" },
  { label: "Test Forms", href: "/forms", testId: "action-forms" },
  { label: "Test Interactions", href: "/interactions", testId: "action-interactions" },
  { label: "Test Modals", href: "/modals", testId: "action-modals" },
];

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 800;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className="count-up">
      {prefix}
      {display.toLocaleString()}
    </span>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user);
      })
      .catch(() => {});
  }, []);

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div data-testid="dashboard-page" aria-label="Dashboard">
      {/* Welcome */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-zinc-100 mb-1"
          data-testid="dashboard-welcome"
          aria-label="Welcome message"
        >
          Welcome back{user ? `, ${user.name}` : ""}!
        </h1>
        <p className="text-zinc-500 text-sm">
          Here&apos;s an overview of the pwcli test environment.
          {user && (
            <span
              className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-600/20 text-indigo-400 border border-indigo-600/30"
              data-testid="user-role-badge"
            >
              <Star size={10} aria-hidden="true" />
              {user.role}
            </span>
          )}
        </p>
      </div>

      {/* Stats Grid */}
      <section aria-label="Statistics" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              data-testid={stat.testId}
              aria-label={`${stat.label}: ${stat.prefix ?? ""}${stat.value.toLocaleString()}`}
              className={`bg-zinc-900 border ${stat.border} rounded-xl p-4 card-glow transition-all duration-200`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-zinc-500 font-medium">{stat.label}</span>
                <div
                  className={`w-8 h-8 rounded-lg ${stat.bg} border ${stat.border} flex items-center justify-center`}
                >
                  <Icon size={14} className={stat.color} aria-hidden="true" />
                </div>
              </div>
              <div className={`text-2xl font-bold ${stat.color} tabular-nums`}>
                <AnimatedNumber value={stat.value} prefix={stat.prefix} />
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notifications */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl card-glow">
          <button
            data-testid="notifications-toggle"
            aria-expanded={notificationsOpen}
            aria-controls="notifications-list"
            onClick={() => setNotificationsOpen((v) => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors rounded-t-xl"
          >
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-zinc-400" aria-hidden="true" />
              <span className="text-sm font-medium text-zinc-200">Notifications</span>
              {unreadCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white"
                  data-testid="notification-badge"
                  aria-label={`${unreadCount} unread`}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            {notificationsOpen ? (
              <ChevronUp size={16} className="text-zinc-500" aria-hidden="true" />
            ) : (
              <ChevronDown size={16} className="text-zinc-500" aria-hidden="true" />
            )}
          </button>

          {notificationsOpen && (
            <ul
              id="notifications-list"
              data-testid="notifications-list"
              aria-label="Notifications list"
              className="divide-y divide-zinc-800"
            >
              {notifications.map((n) => (
                <li
                  key={n.id}
                  data-testid={`notification-${n.id}`}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${!n.read ? "bg-zinc-800/30" : ""}`}
                >
                  <div
                    className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      n.type === "error"
                        ? "bg-red-500"
                        : n.type === "warning"
                          ? "bg-amber-500"
                          : n.type === "success"
                            ? "bg-green-500"
                            : "bg-blue-500"
                    }`}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-zinc-200">{n.title}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{n.time}</div>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      data-testid={`mark-read-${n.id}`}
                      aria-label={`Mark "${n.title}" as read`}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex-shrink-0 transition-colors"
                    >
                      Mark read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 card-glow">
          <h2 className="text-sm font-medium text-zinc-200 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            {QUICK_ACTIONS.map((action) => (
              <a
                key={action.href}
                href={action.href}
                data-testid={action.testId}
                aria-label={action.label}
                className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-150 group"
              >
                {action.label}
                <ChevronDown
                  size={14}
                  className="text-zinc-600 group-hover:text-zinc-400 -rotate-90 transition-transform"
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
