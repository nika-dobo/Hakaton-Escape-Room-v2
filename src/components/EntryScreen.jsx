import React, { useState } from 'react';
import { Play, Code2, Layers, Cpu, Clock, Award, HelpCircle } from 'lucide-react';

export default function EntryScreen({ onJoin, globalDurationMinutes }) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = nickname.trim();
    if (cleaned.length < 2) {
      setError('Please enter a player name or callsign (at least 2 characters).');
      return;
    }
    setError('');
    onJoin(cleaned);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="cyber-panel relative overflow-hidden rounded-2xl p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyber-cyan/70 to-transparent" />

        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="space-y-5 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-md border border-cyber-cyan/30 bg-cyber-cyan/10 px-3 py-1 font-mono text-xs font-semibold text-cyber-cyan">
              SYSTEM ACCESS REQUIRED
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-cyber-text sm:text-4xl">
              Escape the 50-Room Web Engineering Gauntlet
            </h1>

            <p className="max-w-prose text-base leading-relaxed text-cyber-muted">
              Decode HTML structure traps, CSS specificity puzzles, and JavaScript async
              mysteries before the system clock hits zero. Your progress streams live to the
              Admin Leaderboard.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
              <div>
                <label
                  htmlFor="player-nickname"
                  className="mb-2 block text-sm font-semibold text-cyber-text"
                >
                  Player Name / Callsign
                </label>
                <input
                  id="player-nickname"
                  type="text"
                  maxLength={32}
                  autoFocus
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g., CyberNova or Alex_Dev"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'nickname-error' : undefined}
                  className="min-h-[48px] w-full rounded-xl border border-cyber-border bg-cyber-bg px-4 py-3 font-mono text-base text-cyber-text placeholder:text-slate-500 focus:border-cyber-cyan focus:outline-none focus:ring-2 focus:ring-cyber-cyan/30"
                />
                {error ? (
                  <p id="nickname-error" className="mt-2 text-sm font-medium text-cyber-crimson">
                    {error}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-cyber-cyan px-6 py-3 text-base font-bold text-slate-950 transition-all duration-150 hover:bg-cyan-300 active:scale-[0.99] sm:w-auto"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                Enter Briefing Room
              </button>
            </form>
          </div>

          <div className="space-y-3 lg:col-span-5">
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

            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-3 text-center">
                <Clock className="mx-auto mb-1 h-4 w-4 text-cyber-cyan" aria-hidden="true" />
                <div className="tabular-nums font-mono text-sm font-bold text-cyber-text">
                  {globalDurationMinutes}m
                </div>
                <div className="text-[11px] text-cyber-muted">Time Limit</div>
              </div>
              <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-3 text-center">
                <Award className="mx-auto mb-1 h-4 w-4 text-cyber-emerald" aria-hidden="true" />
                <div className="tabular-nums font-mono text-sm font-bold text-cyber-emerald">
                  +100
                </div>
                <div className="text-[11px] text-cyber-muted">Per Room</div>
              </div>
              <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-3 text-center">
                <HelpCircle className="mx-auto mb-1 h-4 w-4 text-cyber-amber" aria-hidden="true" />
                <div className="tabular-nums font-mono text-sm font-bold text-cyber-amber">
                  3 Free
                </div>
                <div className="text-[11px] text-cyber-muted">Hints Total</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
