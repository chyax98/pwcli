"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent, ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, AlertCircle, RotateCcw } from "lucide-react";

const CODE_LENGTH = 6;

export default function MfaPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(CODE_LENGTH).fill(null));

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = "";
      setDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const newDigits = Array(CODE_LENGTH).fill("");
    pasted.split("").forEach((ch, i) => { newDigits[i] = ch; });
    setDigits(newDigits);
    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[focusIndex]?.focus();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < CODE_LENGTH) {
      setError("Please enter all 6 digits");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        setDigits(Array(CODE_LENGTH).fill(""));
        inputRefs.current[0]?.focus();
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleResend() {
    setCountdown(60);
    setCanResend(false);
    setError("");
    setDigits(Array(CODE_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
  }

  return (
    <div
      className="min-h-screen bg-zinc-950 flex items-center justify-center p-4"
      data-testid="mfa-page"
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center mb-4">
            <ShieldCheck size={24} className="text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100 mb-1">Two-factor authentication</h1>
          <p className="text-sm text-zinc-500 text-center">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 card-glow">
          <form onSubmit={handleSubmit} noValidate data-testid="mfa-form" aria-label="MFA verification form">
            {error && (
              <div
                data-testid="mfa-error"
                role="alert"
                aria-live="assertive"
                className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 text-sm mb-4"
              >
                <AlertCircle size={14} aria-hidden="true" />
                {error}
              </div>
            )}

            {/* OTP Inputs */}
            <div
              data-testid="mfa-code-inputs"
              className="flex gap-2 justify-center mb-6"
              role="group"
              aria-label="One-time code digits"
            >
              {Array.from({ length: CODE_LENGTH }, (_, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  data-testid={`mfa-digit-${i}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  aria-label={`Digit ${i + 1} of 6`}
                  value={digits[i]}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  className="w-11 h-12 text-center text-lg font-bold bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors caret-indigo-500"
                />
              ))}
            </div>

            <button
              type="submit"
              data-testid="mfa-submit"
              disabled={loading || digits.join("").length < CODE_LENGTH}
              aria-label="Verify code"
              aria-busy={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-150 mb-4"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
              ) : (
                "Verify"
              )}
            </button>

            {/* Resend */}
            <div className="text-center">
              {canResend ? (
                <button
                  type="button"
                  data-testid="mfa-resend"
                  onClick={handleResend}
                  aria-label="Resend code"
                  className="flex items-center gap-1.5 mx-auto text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  Resend code
                </button>
              ) : (
                <p className="text-sm text-zinc-500" data-testid="mfa-countdown" aria-live="polite">
                  Resend in{" "}
                  <span className="text-zinc-300 font-mono tabular-nums">{countdown}s</span>
                </p>
              )}
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-4">
          Test code:{" "}
          <span className="font-mono text-zinc-400" data-testid="mfa-hint">123456</span>
        </p>
      </div>
    </div>
  );
}
