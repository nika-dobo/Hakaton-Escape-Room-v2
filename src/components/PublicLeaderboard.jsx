import React, { useState, useEffect } from 'react';
import { Trophy, Users, ArrowLeft, RotateCcw, Clock } from 'lucide-react';
import { TOTAL_ROOMS } from '../data/rooms';
import { formatSecondsMMSS, getSortedPlayers } from '../services/realtimeStore';

function getStatusPill(status) {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        cls: 'border-cyber-cyan/40 bg-cyber-cyan/10 text-cyber-cyan',
      };
    case 'completed':
      return {
        label: 'Escaped',
        cls: 'border-cyber-emerald/40 bg-cyber-emerald/10 text-cyber-emerald',
      };
    case 'timeout':
      return {
        label: 'Time Out',
        cls: 'border-cyber-crimson/40 bg-cyber-crimson/10 text-cyber-crimson',
      };
    case 'left':
      return {
        label: 'Paused',
        cls: 'border-cyber-amber/50 bg-cyber-amber/15 text-cyber-amber',
      };
    case 'disconnected':
      return {
        label: 'Disconnected',
        cls: 'border-slate-500/60 bg-slate-800/80 text-slate-300',
      };
    default:
      return {
        label: 'Briefing',
        cls: 'border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber',
      };
  }
}

export default function PublicLeaderboard({
  storeState,
  currentPlayer,
  onBackToPlayer,
  onStartNewRun,
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const localSorted = getSortedPlayers(storeState, now);
  const serverPublic = Array.isArray(storeState?.publicLeaderboard)
    ? storeState.publicLeaderboard
    : [];
  const entries =
    serverPublic.length >= localSorted.length && serverPublic.length > 0
      ? serverPublic
      : localSorted;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber">
            <Trophy className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-cyber-text sm:text-3xl">
              Live Escape Leaderboard
            </h1>
            <p className="text-sm text-cyber-muted">
              Real-time rankings across all operatives in the 50-room gauntlet
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToPlayer}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-cyber-border bg-cyber-surface px-4 py-2.5 text-xs font-semibold text-cyber-text transition-colors hover:border-cyber-cyan/60 hover:text-cyber-cyan"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Arena
          </button>

          {currentPlayer &&
          (currentPlayer.status === 'completed' || currentPlayer.status === 'timeout') ? (
            <button
              type="button"
              onClick={onStartNewRun}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-cyber-cyan px-4 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-300"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Start New Player Run
            </button>
          ) : null}
        </div>
      </div>

      <section
        aria-label="Public player rankings"
        className="cyber-panel overflow-hidden rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-cyber-border px-5 py-4">
          <h2 className="text-base font-bold text-cyber-text">
            Operative Standings ({entries.length})
          </h2>
          <span className="font-mono text-xs text-cyber-emerald">LIVE AUTO-REFRESH</span>
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <Users className="mb-3 h-10 w-10 text-slate-600" aria-hidden="true" />
            <h3 className="text-base font-semibold text-cyber-text">No Operatives Ranked Yet</h3>
            <p className="mt-1 max-w-md text-sm text-cyber-muted">
              Start a run from the Player View to appear on the live leaderboard.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-cyber-border bg-cyber-bg/70 font-mono text-xs uppercase tracking-wider text-cyber-muted">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Operative</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Time Left</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border/70">
                {entries.map((entry, idx) => {
                  const rank = idx + 1;
                  const pill = getStatusPill(entry.effectiveStatus || entry.status);
                  const cleared = Number(entry.completedRooms) || 0;
                  const pct = Math.round((cleared / TOTAL_ROOMS) * 100);
                  const isMe =
                    currentPlayer &&
                    String(currentPlayer.name || '').toLowerCase() ===
                      String(entry.name || '').toLowerCase();

                  return (
                    <tr
                      key={`${entry.name}_${idx}`}
                      className={`transition-colors ${
                        isMe
                          ? 'bg-cyber-cyan/10 hover:bg-cyber-cyan/15'
                          : 'hover:bg-cyber-surfaceElevated/60'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`tabular-nums inline-flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                            rank === 1
                              ? 'border border-amber-400/50 bg-amber-400/15 text-amber-300'
                              : rank === 2
                              ? 'border border-slate-400/50 bg-slate-400/15 text-slate-200'
                              : rank === 3
                              ? 'border border-orange-500/50 bg-orange-500/15 text-orange-300'
                              : 'bg-cyber-bg text-cyber-muted'
                          }`}
                        >
                          #{rank}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-mono font-semibold text-cyber-text">
                          <span className="truncate max-w-[200px]">{entry.name}</span>
                          {isMe ? (
                            <span className="rounded border border-cyber-cyan/40 bg-cyber-cyan/15 px-1.5 py-0.5 text-[10px] font-bold text-cyber-cyan">
                              YOU
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-bold text-cyber-text">
                          {cleared} / {TOTAL_ROOMS} decrypted ({pct}%)
                        </div>
                        <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-cyber-bg">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyber-cyan to-cyber-emerald"
                            style={{ width: `${Math.max(3, pct)}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`tabular-nums font-mono text-base font-bold ${
                            (entry.score || 0) >= 0 ? 'text-cyber-emerald' : 'text-cyber-crimson'
                          }`}
                        >
                          {entry.score || 0} pts
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="tabular-nums inline-flex items-center gap-1 font-mono text-xs font-semibold text-cyber-text">
                          <Clock className="h-3 w-3 text-cyber-muted" aria-hidden="true" />
                          {formatSecondsMMSS(entry.liveRemainingSeconds ?? entry.remainingSeconds)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold ${pill.cls}`}
                        >
                          {pill.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
