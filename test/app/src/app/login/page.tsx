"use client";

import { AlertCircle, Eye, EyeOff, LogIn, Terminal } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }

      if (data.requiresMfa) {
        router.push("/login/mfa");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-zinc-950 flex items-center justify-center p-4"
      data-testid="login-page"
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Terminal size={20} className="text-white" />
          </div>
          <div>
            <div className="text-lg font-bold text-zinc-100">pwcli Test App</div>
            <div className="text-xs text-zinc-500">Browser Automation Target</div>
          </div>
        </div>

        {/* Card */}
        <div
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 card-glow"
          data-testid="login-card"
        >
          <h1 className="text-lg font-semibold text-zinc-100 mb-1">Sign in</h1>
          <p className="text-sm text-zinc-500 mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} noValidate data-testid="login-form" aria-label="Login form">
            {/* Error */}
            {error && (
              <div
                data-testid="login-error"
                role="alert"
                aria-live="assertive"
                className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 text-sm mb-4"
              >
                <AlertCircle size={14} aria-hidden="true" />
                {error}
              </div>
            )}

            {/* Email */}
            <div className="mb-4">
              <label htmlFor="email" className="block text-xs font-medium text-zinc-400 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                data-testid="login-email"
                name="email"
                autoComplete="email"
                required
                aria-required="true"
                aria-label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo@test.com"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="mb-4">
              <label htmlFor="password" className="block text-xs font-medium text-zinc-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  data-testid="login-password"
                  name="password"
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  aria-label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2.5 pr-10 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
                <button
                  type="button"
                  data-testid="login-toggle-password"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2 mb-6">
              <input
                id="remember"
                type="checkbox"
                data-testid="login-remember"
                name="remember"
                aria-label="Remember me"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-1 cursor-pointer accent-indigo-600"
              />
              <label
                htmlFor="remember"
                className="text-sm text-zinc-400 cursor-pointer select-none"
              >
                Remember me
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              data-testid="login-submit"
              disabled={loading}
              aria-label="Sign in"
              aria-busy={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
              {loading ? (
                <div
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <LogIn size={16} aria-hidden="true" />
              )}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        {/* Test accounts hint */}
        <div
          data-testid="login-test-accounts"
          aria-label="Test accounts"
          className="mt-4 p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl text-xs text-zinc-500"
        >
          <div className="font-medium text-zinc-400 mb-2">Test accounts</div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-zinc-400">demo@test.com</span>
              <span className="font-mono">password123</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">admin@test.com</span>
              <span className="font-mono">admin123</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">mfa@test.com</span>
              <span className="font-mono">password123 + MFA: 123456</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
