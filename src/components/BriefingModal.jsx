import React from 'react';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Play,
  ArrowLeft,
  Layers,
} from 'lucide-react';
import { TOTAL_ROOMS } from '../data/rooms';
import {
  INITIAL_FREE_HINTS,
  POINTS_CORRECT,
  POINTS_PAID_HINT,
  POINTS_WRONG,
} from '../services/realtimeStore';

export default function BriefingModal({
  playerName,
  allocatedMinutes,
  scoringSettings,
  onStartGame,
  onLeaveSession,
}) {
  const pointsCorrect = scoringSettings?.pointsCorrect ?? POINTS_CORRECT;
  const pointsWrong = scoringSettings?.pointsWrong ?? POINTS_WRONG;
  const pointsPaidHint = scoringSettings?.pointsPaidHint ?? POINTS_PAID_HINT;
  const freeHintsCount = scoringSettings?.freeHintsCount ?? INITIAL_FREE_HINTS;
  return (
    <div
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12"
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-title"
    >
      <div className="cyber-panel overflow-hidden rounded-2xl">
        <div className="border-b border-cyber-border bg-cyber-surfaceElevated/90 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="briefing-title" className="text-xl font-bold text-cyber-text sm:text-2xl">
                  Mission Briefing &amp; Rules
                </h2>
                <p className="text-sm text-cyber-muted">
                  Operative: <span className="font-mono font-semibold text-cyber-cyan">{playerName}</span>
                </p>
              </div>
            </div>
            <span className="rounded-lg border border-cyber-cyan/30 bg-cyber-cyan/10 px-3 py-1 font-mono text-xs font-semibold text-cyber-cyan">
              TIMER PAUSED
            </span>
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-cyber-text">
                <Layers className="h-4 w-4 text-cyber-cyan" aria-hidden="true" />
                Total Rooms
              </div>
              <p className="text-sm leading-relaxed text-cyber-muted">
                <span className="font-mono font-bold text-cyber-text">{TOTAL_ROOMS} Rooms</span>{' '}
                progressing from easy to hard across HTML (1–15), CSS (16–32), and JavaScript (33–50).
              </p>
            </div>

            <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-cyber-text">
                <Clock className="h-4 w-4 text-cyber-cyan" aria-hidden="true" />
                Time Limit
              </div>
              <p className="text-sm leading-relaxed text-cyber-muted">
                You have{' '}
                <span className="tabular-nums font-mono font-bold text-cyber-cyan">
                  {allocatedMinutes} minutes
                </span>{' '}
                total. The live countdown starts immediately when you click Start Game.
              </p>
            </div>

            <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyber-text">
                <CheckCircle2 className="h-4 w-4 text-cyber-emerald" aria-hidden="true" />
                Scoring System
              </div>
              <ul className="space-y-1.5 text-sm text-cyber-muted">
                <li className="flex items-center justify-between">
                  <span>Passing a room</span>
                  <span className="tabular-nums font-mono font-bold text-cyber-emerald">
                    {pointsCorrect >= 0 ? `+${pointsCorrect}` : pointsCorrect} pts
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <XCircle className="h-3.5 w-3.5 text-cyber-crimson" aria-hidden="true" />
                    Every wrong submission
                  </span>
                  <span className="tabular-nums font-mono font-bold text-cyber-crimson">
                    {pointsWrong} pts
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyber-text">
                <Lightbulb className="h-4 w-4 text-cyber-amber" aria-hidden="true" />
                Hints Policy
              </div>
              <ul className="space-y-1.5 text-sm text-cyber-muted">
                <li className="flex items-center justify-between">
                  <span>Free hints (entire game)</span>
                  <span className="tabular-nums font-mono font-bold text-cyber-amber">
                    {freeHintsCount} Free
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Extra hints (max 1 per room)</span>
                  <span className="tabular-nums font-mono font-bold text-cyber-crimson">
                    {pointsPaidHint} pts each
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-cyber-cyan/20 bg-cyber-cyan/5 px-4 py-3 text-xs leading-relaxed text-cyber-muted">
            Tip: Wrong answers deduct <strong className="text-cyber-crimson">{pointsWrong} points</strong>{' '}
            every time you submit an incorrect solution until you solve the room. Read each code
            snippet carefully and verify your syntax before hitting Submit.
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-cyber-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onLeaveSession}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-cyber-border bg-cyber-surface px-4 py-2.5 text-sm font-medium text-cyber-muted transition-colors hover:border-slate-600 hover:text-cyber-text"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Change Name
            </button>

            <button
              type="button"
              onClick={onStartGame}
              className="inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-cyber-emerald px-8 py-3 text-base font-bold text-slate-950 shadow-[0_0_24px_rgba(16,185,129,0.28)] transition-all duration-150 hover:bg-emerald-400 active:scale-[0.99]"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Start Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
