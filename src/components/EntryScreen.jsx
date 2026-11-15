import React, { useState, useEffect } from 'react';
import { Code2, Layers, Cpu, ArrowRight, Sparkles, AlertTriangle, X } from 'lucide-react';
import { isPlayerNameTaken } from '../services/realtimeStore';

export default function EntryScreen({
  onJoin,
  globalDurationMinutes,
  scoringSettings,
  initialName = '',
  sessionNotice = '',
  onDismissNotice,
}) {
  const pointsCorrect = scoringSettings?.pointsCorrect ?? 100;
  const freeHintsCount = scoringSettings?.freeHintsCount ?? 3;
  const [nickname, setNickname] = useState(initialName);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialName && !nickname) {
      setNickname(initialName);
    }
  }, [initialName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      setError('Please enter at least 2 characters for your player handle.');
      return;
    }
    if (isPlayerNameTaken(trimmed)) {
      setError(
        'This player name is already taken. Please choose a different handle or ask the admin to clear your session.'
      );
      return;
    }
    setError('');
    const result = onJoin(trimmed);
    if (result && result.ok === false) {
      setError(result.error || 'This player name is already taken.');
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-88px)] max-w-4xl flex-col justify-center px-4 py-8 sm:px-6">
      {sessionNotice ? (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-cyber-amber/50 bg-cyber-amber/10 px-4 py-3 text-sm text-amber-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-cyber-amber" aria-hidden="true" />
            <span>{sessionNotice}</span>
          </div>
          {onDismissNotice ? (
            <button
              type="button"
              onClick={onDismissNotice}
              aria-label="Dismiss notification"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-amber-200 hover:bg-cyber-amber/20"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="cyber-panel relative overflow-hidden rounded-2xl p-6 sm:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyber-cyan/10 blur-3xl"
        />

        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="min-w-0 space-y-5 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-md border border-cyber-cyan/30 bg-cyber-cyan/10 px-3 py-1 font-mono text-xs font-semibold text-cyber-cyan">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              SYSTEM ACCESS REQUIRED
            </div>

            <h1 className="break-words text-2xl font-bold tracking-tight text-cyber-text sm:text-4xl">
              Escape the 50-Room Web Engineering Gauntlet
            </h1>

            <p className="max-w-prose text-sm leading-relaxed text-cyber-muted sm:text-base">
              Decrypt 50 sequential code challenges spanning{' '}
              <span className="font-semibold text-cyber-text">HTML</span>,{' '}
              <span className="font-semibold text-cyber-text">CSS</span>, and{' '}
              <span className="font-semibold text-cyber-text">JavaScript</span>. Every room scales
              in complexity. Solve fast, guard your points, and beat the countdown clock.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3 pt-2" noValidate>
              <div>
                <label
                  htmlFor="player-nickname"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-cyber-muted"
                >
                  Operative Callsign (Player Name)
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="player-nickname"
                    type="text"
                    autoFocus
                    maxLength={32}
                    value={nickname}
                    onChange={(e) => {
                      setNickname(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="e.g. NeoCoder_42"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? 'nickname-error' : undefined}
                    className="min-h-[48px] flex-1 rounded-xl border border-cyber-border bg-cyber-bg px-4 py-3 font-mono text-base text-cyber-text placeholder:text-slate-500 focus:border-cyber-cyan focus:outline-none focus:ring-2 focus:ring-cyber-cyan/30"
                  />
                  <button
                    type="submit"
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-cyber-cyan px-6 py-3 text-sm font-bold text-slate-950 transition-all duration-150 hover:bg-cyan-300 active:scale-[0.98]"
                  >
                    Enter Briefing Room
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                {error ? (
                  <p
                    id="nickname-error"
                    role="alert"
                    className="mt-2 text-xs font-medium text-cyber-crimson"
                  >
                    {error}
                  </p>
                ) : null}
              </div>
            </form>
          </div>

          <div className="min-w-0 space-y-3 lg:col-span-5">
            <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-4">
              <div className="mb-3 flex items-center justify-between border-b border-cyber-border pb-2">
                <span className="font-mono text-xs font-semibold text-cyber-muted">
                  CHALLENGE SECTORS
                </span>
                <span className="font-mono text-xs text-cyber-cyan">50 ROOMS</span>
              </div>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-cyber-text">
                    <Code2 className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    HTML Sector
                  </span>
                  <span className="font-mono text-xs text-cyber-muted">Rooms 01–15</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-cyber-text">
                    <Layers className="h-4 w-4 text-cyber-cyan" aria-hidden="true" />
                    CSS Sector
                  </span>
                  <span className="font-mono text-xs text-cyber-muted">Rooms 16–32</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-cyber-text">
                    <Cpu className="h-4 w-4 text-cyber-emerald" aria-hidden="true" />
                    JavaScript Sector
                  </span>
                  <span className="font-mono text-xs text-cyber-muted">Rooms 33–50</span>
                </li>
              </ul>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-3">
                <div className="font-mono text-lg font-bold text-cyber-emerald">
                  {pointsCorrect >= 0 ? `+${pointsCorrect}` : pointsCorrect}
                </div>
                <div className="text-[11px] text-cyber-muted">Per Room</div>
              </div>
              <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-3">
                <div className="font-mono text-lg font-bold text-cyber-amber">
                  {freeHintsCount} Free
                </div>
                <div className="text-[11px] text-cyber-muted">Hints Included</div>
              </div>
              <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-3">
                <div className="tabular-nums font-mono text-lg font-bold text-cyber-cyan">
                  {globalDurationMinutes}m
                </div>
                <div className="text-[11px] text-cyber-muted">Time Limit</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
