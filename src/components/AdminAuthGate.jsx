import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ArrowLeft, ShieldAlert } from 'lucide-react';
import { verifyAdminPassword } from '../services/realtimeStore';

export default function AdminAuthGate({ onAuthenticated, onBackToPlayer }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const triggerError = () => {
    setError('Access denied: Invalid administrator password.');
    setShake(false);
    window.requestAnimationFrame(() => {
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleaned = password.trim();
    if (!cleaned) {
      setError('Please enter the administrator password.');
      return;
    }

    if (verifyAdminPassword(cleaned)) {
      setError('');
      onAuthenticated();
      return;
    }

    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'VERIFY_ADMIN', password: cleaned }),
      });
      if (res.ok) {
        setError('');
        onAuthenticated();
        return;
      }
    } catch {
      // Offline fallback already checked above
    }

    triggerError();
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-20">
      <div
        className={`cyber-panel overflow-hidden rounded-2xl p-6 sm:p-8 ${
          shake ? 'animate-shake animate-flashRed border-cyber-crimson/80' : ''
        }`}
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyber-emerald/40 bg-cyber-emerald/10 text-cyber-emerald shadow-[0_0_24px_rgba(16,185,129,0.2)]">
            <Lock className="h-7 w-7" aria-hidden="true" />
          </div>

          <span className="mb-2 rounded-full border border-cyber-emerald/30 bg-cyber-emerald/10 px-3 py-0.5 font-mono text-[11px] font-semibold text-cyber-emerald">
            RESTRICTED SECTOR
          </span>

          <h1 className="text-2xl font-bold text-cyber-text">Admin Panel Locked</h1>
          <p className="mt-1.5 text-sm text-cyber-muted">
            Enter the administrator password to access real-time player monitoring and global
            controls.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label
              htmlFor="admin-password-input"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-cyber-muted"
            >
              Admin Password
            </label>
            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                id="admin-password-input"
                type={showPassword ? 'text' : 'password'}
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter admin password..."
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'admin-auth-error' : undefined}
                className="min-h-[48px] w-full rounded-xl border border-cyber-border bg-cyber-bg pl-10 pr-11 py-3 font-mono text-sm text-cyber-text placeholder:text-slate-500 focus:border-cyber-emerald focus:outline-none focus:ring-2 focus:ring-cyber-emerald/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-cyber-muted hover:text-cyber-text"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>

            {error ? (
              <p
                id="admin-auth-error"
                role="alert"
                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-cyber-crimson"
              >
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="submit"
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-cyber-emerald px-5 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.99]"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              Unlock Admin Dashboard
            </button>

            <button
              type="button"
              onClick={onBackToPlayer}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-cyber-border bg-cyber-surface px-4 py-2.5 text-xs font-semibold text-cyber-muted transition-colors hover:border-slate-600 hover:text-cyber-text"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Player View
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
