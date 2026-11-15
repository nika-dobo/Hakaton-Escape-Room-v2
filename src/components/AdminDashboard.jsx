import React, { useState, useEffect } from 'react';
import {
  Users,
  Trophy,
  Clock,
  RotateCcw,
  Trash2,
  UserPlus,
  Activity,
  CheckCircle2,
  AlertOctagon,
  Sliders,
  Lock,
  Wifi,
  Copy,
  Check,
  KeyRound,
  Cloud,
} from 'lucide-react';
import { TOTAL_ROOMS, getRoomById } from '../data/rooms';
import {
  formatSecondsMMSS,
  getSortedPlayers,
  INITIAL_FREE_HINTS,
  getCloudDbUrl,
  setCloudDbUrl,
  updateAdminPassword,
  getScoringSettings,
  POINTS_CORRECT,
  POINTS_WRONG,
  POINTS_PAID_HINT,
  POINTS_SKIP,
} from '../services/realtimeStore';

function formatSafeAriaName(rawName) {
  const cleaned = String(rawName || '')
    .replace(/[<>"']/g, '')
    .trim();
  return cleaned || 'Player';
}

function getStatusBadge(status) {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        cls: 'border-cyber-cyan/40 bg-cyber-cyan/10 text-cyber-cyan',
      };
    case 'completed':
      return {
        label: 'Completed',
        cls: 'border-cyber-emerald/40 bg-cyber-emerald/10 text-cyber-emerald',
      };
    case 'timeout':
      return {
        label: 'Time Out',
        cls: 'border-cyber-crimson/40 bg-cyber-crimson/10 text-cyber-crimson',
      };
    case 'left':
      return {
        label: 'Left Game',
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

export default function AdminDashboard({
  storeState,
  onUpdateTimer,
  onUpdateScoring,
  onAdjustScore,
  onResetAll,
  onRemovePlayer,
  onSeedDemo,
  onLockAdmin,
}) {
  const scoring = getScoringSettings(storeState);
  const [now, setNow] = useState(() => Date.now());
  const [durationInput, setDurationInput] = useState(
    String(storeState.settings?.globalDurationMinutes || 60)
  );
  const [applyToActive, setApplyToActive] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [adminToast, setAdminToast] = useState('');
  const [copiedUrl, setCopiedUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [cloudUrlInput, setCloudUrlInput] = useState(() => getCloudDbUrl());
  const [pointsCorrectInput, setPointsCorrectInput] = useState(String(scoring.pointsCorrect));
  const [pointsWrongInput, setPointsWrongInput] = useState(String(scoring.pointsWrong));
  const [pointsHintInput, setPointsHintInput] = useState(String(scoring.pointsPaidHint));
  const [pointsSkipInput, setPointsSkipInput] = useState(String(scoring.pointsSkip));
  const [freeHintsInput, setFreeHintsInput] = useState(String(scoring.freeHintsCount));
  const [customScorePlayerId, setCustomScorePlayerId] = useState(null);
  const [customScoreAmount, setCustomScoreAmount] = useState('50');

  // Tick every second so all active players' countdown timers stay live in real time
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Only sync form inputs when actual setting values or updatedAt change, not on every poll object reference
  useEffect(() => {
    setDurationInput(String(storeState.settings?.globalDurationMinutes || 60));
  }, [storeState.settings?.globalDurationMinutes]);

  useEffect(() => {
    const latest = getScoringSettings(storeState);
    setPointsCorrectInput(String(latest.pointsCorrect));
    setPointsWrongInput(String(latest.pointsWrong));
    setPointsHintInput(String(latest.pointsPaidHint));
    setPointsSkipInput(String(latest.pointsSkip));
    setFreeHintsInput(String(latest.freeHintsCount));
  }, [
    storeState.settings?.pointsCorrect,
    storeState.settings?.pointsWrong,
    storeState.settings?.pointsPaidHint,
    storeState.settings?.pointsSkip,
    storeState.settings?.freeHintsCount,
  ]);

  useEffect(() => {
    if (!confirmReset) return undefined;
    const t = window.setTimeout(() => setConfirmReset(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirmReset]);

  const showNotice = (msg) => {
    setAdminToast(msg);
    window.setTimeout(() => setAdminToast(''), 2800);
  };

  const sortedPlayers = getSortedPlayers(storeState, now);
  const activeCount = sortedPlayers.filter((p) => p.effectiveStatus === 'active').length;
  const completedCount = sortedPlayers.filter((p) => p.effectiveStatus === 'completed').length;
  const timeoutCount = sortedPlayers.filter((p) => p.effectiveStatus === 'timeout').length;
  const topScore = sortedPlayers.length > 0 ? sortedPlayers[0].score : 0;
  const lanUrls = storeState.lanUrls || [];

  const handleApplyTimer = (e) => {
    e.preventDefault();
    const mins = Math.max(1, Math.min(240, Number(durationInput) || 60));
    onUpdateTimer(mins, applyToActive);
    setDurationInput(String(mins));
    showNotice(`Global timer updated to ${mins} minutes.`);
  };

  const handleResetClick = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    onResetAll();
    setConfirmReset(false);
    showNotice('All player sessions cleared across all devices.');
  };

  const handleCopyUrl = (url) => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedUrl(url);
      window.setTimeout(() => setCopiedUrl(''), 2000);
    });
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (newPassword.trim().length < 4) {
      showNotice('Password must be at least 4 characters.');
      return;
    }
    updateAdminPassword(newPassword.trim());
    setNewPassword('');
    showNotice('Admin password updated across all devices.');
  };

  const handleSaveCloudUrl = (e) => {
    e.preventDefault();
    setCloudDbUrl(cloudUrlInput);
    showNotice(
      cloudUrlInput.trim()
        ? 'Cloud Realtime DB connected for internet multi-device sync.'
        : 'Cloud Realtime DB disconnected (using built-in server sync).'
    );
  };

  const handleSaveScoring = (e) => {
    e.preventDefault();
    onUpdateScoring({
      pointsCorrect: Number(pointsCorrectInput) || 0,
      pointsWrong: Number(pointsWrongInput) || 0,
      pointsPaidHint: Number(pointsHintInput) || 0,
      pointsSkip: Number(pointsSkipInput) || 0,
      freeHintsCount: Math.max(0, Math.min(50, Number(freeHintsInput) || 0)),
    });
    showNotice('Scoring configuration updated in real time.');
  };

  const handleResetScoringDefaults = () => {
    onUpdateScoring({
      pointsCorrect: POINTS_CORRECT,
      pointsWrong: POINTS_WRONG,
      pointsPaidHint: POINTS_PAID_HINT,
      pointsSkip: POINTS_SKIP,
      freeHintsCount: INITIAL_FREE_HINTS,
    });
    showNotice('Scoring configuration restored to defaults.');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header & Quick Telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-cyber-text sm:text-3xl">
              Admin Command &amp; Live Leaderboard
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyber-emerald/30 bg-cyber-emerald/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-cyber-emerald">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyber-emerald" />
              MULTI-DEVICE REAL-TIME
            </span>
          </div>
          <p className="mt-1 text-sm text-cyber-muted">
            Monitors every player entering from any tab, browser, or connected device in real time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {adminToast ? (
            <div
              role="status"
              className="rounded-xl border border-cyber-cyan/50 bg-cyber-cyan/10 px-4 py-2 font-mono text-xs font-semibold text-cyber-cyan"
            >
              {adminToast}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onLockAdmin}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-cyber-border bg-cyber-surface px-4 py-2 text-xs font-semibold text-cyber-muted transition-colors hover:border-cyber-amber/50 hover:text-cyber-amber"
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Lock Admin Panel
          </button>
        </div>
      </div>

      {/* Multi-Device Join Banner */}
      <section
        aria-label="Multi-device connection info"
        className="cyber-panel rounded-2xl border-cyber-cyan/30 p-4 sm:p-5"
      >
        <div className="grid gap-4 lg:grid-cols-12 lg:items-center">
          <div className="space-y-2 lg:col-span-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyber-cyan">
              <Wifi className="h-4 w-4" aria-hidden="true" />
              Join from Other Devices (LAN / Wi-Fi)
            </div>
            <p className="text-xs leading-relaxed text-cyber-muted">
              Anyone opening the link below on their phone, tablet, or laptop will immediately
              appear in the table as soon as they enter their name.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {(lanUrls.length > 0 ? lanUrls : [window.location.origin]).map((url) => (
                <div
                  key={url}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyber-border bg-cyber-bg px-3 py-1.5 font-mono text-xs text-cyber-text"
                >
                  <span>{url}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(url)}
                    className="inline-flex items-center gap-1 rounded bg-cyber-surfaceElevated px-2 py-0.5 text-[11px] text-cyber-cyan hover:bg-cyber-cyan/20"
                  >
                    {copiedUrl === url ? (
                      <>
                        <Check className="h-3 w-3" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
            {/* Change Admin Password */}
            <form
              onSubmit={handlePasswordChange}
              className="rounded-xl border border-cyber-border bg-cyber-bg/70 p-3.5"
            >
              <label
                htmlFor="change-admin-pass"
                className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-cyber-text"
              >
                <KeyRound className="h-3.5 w-3.5 text-cyber-emerald" aria-hidden="true" />
                Change Admin Password
              </label>
              <div className="flex gap-2">
                <input
                  id="change-admin-pass"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password..."
                  className="min-h-[38px] min-w-0 flex-1 rounded-lg border border-cyber-border bg-cyber-surface px-3 py-1.5 font-mono text-xs text-cyber-text placeholder:text-slate-500 focus:border-cyber-emerald focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[38px] shrink-0 rounded-lg bg-cyber-emerald px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Save
                </button>
              </div>
            </form>

            {/* Optional Firebase Cloud Sync for external networks */}
            <form
              onSubmit={handleSaveCloudUrl}
              className="rounded-xl border border-cyber-border bg-cyber-bg/70 p-3.5"
            >
              <label
                htmlFor="cloud-db-url"
                className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-cyber-text"
              >
                <Cloud className="h-3.5 w-3.5 text-cyber-cyan" aria-hidden="true" />
                Optional Firebase DB URL (Cloud Sync)
              </label>
              <div className="flex gap-2">
                <input
                  id="cloud-db-url"
                  type="url"
                  value={cloudUrlInput}
                  onChange={(e) => setCloudUrlInput(e.target.value)}
                  placeholder="https://your-db.firebaseio.com"
                  className="min-h-[38px] min-w-0 flex-1 rounded-lg border border-cyber-border bg-cyber-surface px-3 py-1.5 font-mono text-xs text-cyber-text placeholder:text-slate-500 focus:border-cyber-cyan focus:outline-none"
                />
                <button
                  type="submit"
                  className="min-h-[38px] shrink-0 rounded-lg border border-cyber-cyan/50 bg-cyber-cyan/15 px-3 py-1.5 text-xs font-bold text-cyber-cyan hover:bg-cyber-cyan/25"
                >
                  Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="cyber-panel rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-cyber-muted">
            <span>Total Players</span>
            <Users className="h-4 w-4 text-cyber-cyan" aria-hidden="true" />
          </div>
          <div className="tabular-nums mt-2 font-mono text-2xl font-bold text-cyber-text">
            {sortedPlayers.length}
          </div>
        </div>

        <div className="cyber-panel rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-cyber-muted">
            <span>Active Now</span>
            <Activity className="h-4 w-4 text-cyber-cyan" aria-hidden="true" />
          </div>
          <div className="tabular-nums mt-2 font-mono text-2xl font-bold text-cyber-cyan">
            {activeCount}
          </div>
        </div>

        <div className="cyber-panel rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-cyber-muted">
            <span>Completed</span>
            <CheckCircle2 className="h-4 w-4 text-cyber-emerald" aria-hidden="true" />
          </div>
          <div className="tabular-nums mt-2 font-mono text-2xl font-bold text-cyber-emerald">
            {completedCount}
          </div>
        </div>

        <div className="cyber-panel rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-cyber-muted">
            <span>Time Out</span>
            <AlertOctagon className="h-4 w-4 text-cyber-crimson" aria-hidden="true" />
          </div>
          <div className="tabular-nums mt-2 font-mono text-2xl font-bold text-cyber-crimson">
            {timeoutCount}
          </div>
        </div>

        <div className="cyber-panel col-span-2 rounded-xl p-4 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-cyber-muted">
            <span>Top Score</span>
            <Trophy className="h-4 w-4 text-cyber-amber" aria-hidden="true" />
          </div>
          <div className="tabular-nums mt-2 font-mono text-2xl font-bold text-cyber-amber">
            {topScore}
          </div>
        </div>
      </div>

      {/* Global Timer & Session Controls */}
      <section
        aria-label="Global session and timer controls"
        className="cyber-panel rounded-2xl p-5"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <form onSubmit={handleApplyTimer} className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyber-text">
              <Sliders className="h-4 w-4 text-cyber-cyan" aria-hidden="true" />
              Global Timer Configuration
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <label htmlFor="global-timer-minutes" className="text-xs text-cyber-muted">
                  Minutes:
                </label>
                <input
                  id="global-timer-minutes"
                  type="number"
                  min={1}
                  max={240}
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  className="tabular-nums min-h-[44px] w-24 rounded-lg border border-cyber-border bg-cyber-bg px-3 py-2 font-mono text-sm font-semibold text-cyber-text focus:border-cyber-cyan focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[15, 30, 45, 60, 90].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDurationInput(String(preset))}
                    className={`min-h-[44px] rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold transition-colors ${
                      Number(durationInput) === preset
                        ? 'border-cyber-cyan/70 bg-cyber-cyan/15 text-cyber-cyan'
                        : 'border-cyber-border bg-cyber-bg text-cyber-muted hover:text-cyber-text'
                    }`}
                  >
                    {preset}m
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-cyber-cyan px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-300"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Apply Timer
              </button>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-cyber-muted">
              <input
                type="checkbox"
                checked={applyToActive}
                onChange={(e) => setApplyToActive(e.target.checked)}
                className="h-4 w-4 rounded border-cyber-border bg-cyber-bg accent-cyber-cyan"
              />
              Also update countdown deadline for currently active players
            </label>
          </form>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onSeedDemo();
                showNotice('Demo players added to live leaderboard.');
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-cyber-border bg-cyber-surfaceElevated px-4 py-2.5 text-xs font-semibold text-cyber-text transition-colors hover:border-cyber-cyan/50 hover:text-cyber-cyan"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Spawn Demo Players
            </button>

            <button
              type="button"
              onClick={handleResetClick}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors ${
                confirmReset
                  ? 'border-cyber-crimson bg-cyber-crimson text-white'
                  : 'border-cyber-crimson/50 bg-cyber-crimson/10 text-cyber-crimson hover:bg-cyber-crimson/20'
              }`}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {confirmReset ? 'Confirm Reset All Sessions' : 'Reset / Clear Sessions'}
            </button>
          </div>
        </div>
      </section>

      {/* Scoring & Rules Configuration */}
      <section
        aria-label="Scoring and rules configuration"
        className="cyber-panel rounded-2xl p-5"
      >
        <form onSubmit={handleSaveScoring} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyber-text">
              <Sliders className="h-4 w-4 text-cyber-emerald" aria-hidden="true" />
              Scoring &amp; Rules Configuration
            </div>
            <span className="text-xs text-cyber-muted">
              Use negative numbers (e.g. -25) for penalties and positive numbers (e.g. 100) for rewards
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div>
              <label
                htmlFor="cfg-correct-pts"
                className="mb-1.5 block text-xs font-medium text-cyber-emerald"
              >
                Correct Answer (+)
              </label>
              <input
                id="cfg-correct-pts"
                type="number"
                value={pointsCorrectInput}
                onChange={(e) => setPointsCorrectInput(e.target.value)}
                className="tabular-nums min-h-[42px] w-full rounded-lg border border-cyber-border bg-cyber-bg px-3 py-2 font-mono text-sm font-semibold text-cyber-text focus:border-cyber-emerald focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="cfg-wrong-pts"
                className="mb-1.5 block text-xs font-medium text-cyber-crimson"
              >
                Wrong Answer (-)
              </label>
              <input
                id="cfg-wrong-pts"
                type="number"
                value={pointsWrongInput}
                onChange={(e) => setPointsWrongInput(e.target.value)}
                className="tabular-nums min-h-[42px] w-full rounded-lg border border-cyber-border bg-cyber-bg px-3 py-2 font-mono text-sm font-semibold text-cyber-text focus:border-cyber-crimson focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="cfg-hint-pts"
                className="mb-1.5 block text-xs font-medium text-cyber-amber"
              >
                Paid Hint (-)
              </label>
              <input
                id="cfg-hint-pts"
                type="number"
                value={pointsHintInput}
                onChange={(e) => setPointsHintInput(e.target.value)}
                className="tabular-nums min-h-[42px] w-full rounded-lg border border-cyber-border bg-cyber-bg px-3 py-2 font-mono text-sm font-semibold text-cyber-text focus:border-cyber-amber focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="cfg-skip-pts"
                className="mb-1.5 block text-xs font-medium text-cyber-muted"
              >
                Skip Room (0 / -)
              </label>
              <input
                id="cfg-skip-pts"
                type="number"
                value={pointsSkipInput}
                onChange={(e) => setPointsSkipInput(e.target.value)}
                className="tabular-nums min-h-[42px] w-full rounded-lg border border-cyber-border bg-cyber-bg px-3 py-2 font-mono text-sm font-semibold text-cyber-text focus:border-cyber-cyan focus:outline-none"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label
                htmlFor="cfg-free-hints"
                className="mb-1.5 block text-xs font-medium text-cyber-cyan"
              >
                Free Hints (New Players)
              </label>
              <input
                id="cfg-free-hints"
                type="number"
                min={0}
                max={50}
                value={freeHintsInput}
                onChange={(e) => setFreeHintsInput(e.target.value)}
                className="tabular-nums min-h-[42px] w-full rounded-lg border border-cyber-border bg-cyber-bg px-3 py-2 font-mono text-sm font-semibold text-cyber-text focus:border-cyber-cyan focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="submit"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-cyber-emerald px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Save Scoring Config
            </button>

            <button
              type="button"
              onClick={handleResetScoringDefaults}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-cyber-border bg-cyber-bg px-4 py-2 text-xs font-semibold text-cyber-muted transition-colors hover:text-cyber-text"
            >
              Reset Defaults (+100 / -25 / -50 / 0)
            </button>
          </div>
        </form>
      </section>

      {/* Live Monitoring & Leaderboard Table */}
      <section
        aria-label="Live player leaderboard"
        className="cyber-panel overflow-hidden rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-cyber-border px-5 py-4">
          <h2 className="text-base font-bold text-cyber-text">
            Live Operatives Monitor ({sortedPlayers.length})
          </h2>
          <span className="font-mono text-xs text-cyber-muted">
            Global Limit: {storeState.settings?.globalDurationMinutes || 60}m
          </span>
        </div>

        {sortedPlayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <Users className="mb-3 h-10 w-10 text-slate-600" aria-hidden="true" />
            <h3 className="text-base font-semibold text-cyber-text">No Active Sessions Yet</h3>
            <p className="mt-1 max-w-md text-sm text-cyber-muted">
              Open the Player View on any device or tab and enter a player name, or spawn demo
              players to inspect real-time leaderboard sorting.
            </p>
            <button
              type="button"
              onClick={() => {
                onSeedDemo();
                showNotice('Demo players added to live leaderboard.');
              }}
              className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-cyber-cyan/50 bg-cyber-cyan/10 px-4 py-2 text-sm font-semibold text-cyber-cyan transition-colors hover:bg-cyber-cyan/20"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Spawn Demo Players
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-cyber-border bg-cyber-bg/70 font-mono text-[11px] uppercase tracking-wider text-cyber-muted">
                  <th className="px-2 py-2.5">Rank</th>
                  <th className="px-2 py-2.5">Player</th>
                  <th className="px-2 py-2.5">Room</th>
                  <th className="px-2 py-2.5">Time</th>
                  <th className="px-2 py-2.5">Score</th>
                  <th className="px-2 py-2.5">Hints</th>
                  <th className="px-2 py-2.5">Skipped</th>
                  <th className="px-2 py-2.5">Tabs</th>
                  <th className="px-2 py-2.5">Status</th>
                  <th className="px-2 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyber-border/70">
                {sortedPlayers.map((player, index) => {
                  const statusBadge = getStatusBadge(player.effectiveStatus);
                  const roomInfo = getRoomById(player.currentRoom);
                  const progressPct = Math.round(
                    ((player.completedRooms || 0) / TOTAL_ROOMS) * 100
                  );
                  const rank = index + 1;
                  const urgentTimer =
                    player.effectiveStatus === 'active' && player.liveRemainingSeconds <= 60;
                  const safeAriaName = formatSafeAriaName(player.name);
                  const playerTotalFree =
                    player.initialFreeHints ?? scoring.freeHintsCount;

                  return (
                    <tr
                      key={player.id}
                      className="transition-colors hover:bg-cyber-surfaceElevated/60"
                    >
                      <td className="px-2 py-2.5">
                        <span
                          className={`tabular-nums inline-flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-bold ${
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

                      <td className="max-w-[140px] px-2 py-2.5">
                        <div
                          className="truncate font-mono text-xs font-semibold text-cyber-text"
                          title={player.name}
                        >
                          {player.name}
                        </div>
                        <div
                          className="mt-0.5 truncate text-[10px] text-cyber-muted"
                          title={player.lastEvent || 'Connected'}
                        >
                          {player.lastEvent || 'Connected'}
                        </div>
                      </td>

                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="tabular-nums font-mono text-xs font-bold text-cyber-text">
                            {player.currentRoom}/{TOTAL_ROOMS}
                          </span>
                          <span className="rounded border border-cyber-border bg-cyber-bg px-1 py-0.5 font-mono text-[9px] text-cyber-cyan">
                            {roomInfo.category}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-cyber-bg">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyber-cyan to-cyber-emerald"
                            style={{ width: `${Math.max(3, progressPct)}%` }}
                          />
                        </div>
                      </td>

                      <td className="px-2 py-2.5">
                        <span
                          className={`tabular-nums font-mono text-xs font-bold ${
                            urgentTimer
                              ? 'animate-pulse text-cyber-crimson'
                              : player.effectiveStatus === 'timeout'
                              ? 'text-cyber-crimson'
                              : 'text-cyber-text'
                          }`}
                        >
                          {formatSecondsMMSS(player.liveRemainingSeconds)}
                        </span>
                      </td>

                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`tabular-nums font-mono text-xs font-bold ${
                              player.score >= 0 ? 'text-cyber-emerald' : 'text-cyber-crimson'
                            }`}
                          >
                            {player.score}
                          </span>
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onAdjustScore(player.id, -25)}
                              title="Subtract 25 points"
                              aria-label={`Subtract 25 points from ${safeAriaName}`}
                              className="rounded border border-cyber-crimson/40 bg-cyber-crimson/10 px-1 py-0.5 font-mono text-[10px] font-bold text-cyber-crimson transition-colors hover:bg-cyber-crimson/25"
                            >
                              -25
                            </button>
                            <button
                              type="button"
                              onClick={() => onAdjustScore(player.id, 25)}
                              title="Add 25 points"
                              aria-label={`Add 25 points to ${safeAriaName}`}
                              className="rounded border border-cyber-emerald/40 bg-cyber-emerald/10 px-1 py-0.5 font-mono text-[10px] font-bold text-cyber-emerald transition-colors hover:bg-cyber-emerald/25"
                            >
                              +25
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCustomScorePlayerId((prev) =>
                                  prev === player.id ? null : player.id
                                )
                              }
                              title="Custom score adjustment"
                              aria-label={`Custom score adjustment for ${safeAriaName}`}
                              className="rounded border border-cyber-border bg-cyber-bg px-1 py-0.5 font-mono text-[10px] font-semibold text-cyber-muted transition-colors hover:border-cyber-cyan/50 hover:text-cyber-cyan"
                            >
                              ±
                            </button>
                          </div>
                        </div>

                        {customScorePlayerId === player.id ? (
                          <div className="mt-1.5 flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              max={10000}
                              value={customScoreAmount}
                              onChange={(e) => setCustomScoreAmount(e.target.value)}
                              aria-label={`Custom points amount for ${safeAriaName}`}
                              className="tabular-nums w-14 rounded border border-cyber-border bg-cyber-bg px-1.5 py-0.5 font-mono text-[11px] text-cyber-text focus:border-cyber-cyan focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const amt = Math.abs(Number(customScoreAmount) || 0);
                                if (amt > 0) onAdjustScore(player.id, -amt);
                              }}
                              className="rounded bg-cyber-crimson/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyber-crimson hover:bg-cyber-crimson/35"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const amt = Math.abs(Number(customScoreAmount) || 0);
                                if (amt > 0) onAdjustScore(player.id, amt);
                              }}
                              className="rounded bg-cyber-emerald/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyber-emerald hover:bg-cyber-emerald/35"
                            >
                              +
                            </button>
                          </div>
                        ) : null}

                        {player.wrongAttempts > 0 ? (
                          <div className="tabular-nums mt-0.5 text-[10px] text-cyber-muted">
                            {player.wrongAttempts} wrong
                          </div>
                        ) : null}
                      </td>

                      <td className="px-2 py-2.5">
                        <div className="tabular-nums font-mono text-xs font-semibold text-cyber-text">
                          {player.hintsUsed || 0} used
                        </div>
                        <div className="tabular-nums text-[10px] text-cyber-muted">
                          {player.freeHintsRemaining}/{playerTotalFree} free
                        </div>
                      </td>

                      <td className="px-2 py-2.5">
                        <span
                          className={`tabular-nums inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                            (player.skippedCount || 0) > 0
                              ? 'border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber'
                              : 'border-cyber-border bg-cyber-bg text-cyber-muted'
                          }`}
                        >
                          {player.skippedCount || 0}
                        </span>
                      </td>

                      <td className="px-2 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <span
                            className={`tabular-nums inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                              (player.tabSwitches || 0) > 0
                                ? 'border-cyber-crimson/40 bg-cyber-crimson/10 text-cyber-crimson'
                                : 'border-cyber-emerald/30 bg-cyber-emerald/10 text-cyber-emerald'
                            }`}
                          >
                            {(player.tabSwitches || 0) > 0
                              ? `Yes (${player.tabSwitches}×)`
                              : 'No (0×)'}
                          </span>
                          {player.effectiveStatus === 'active' && player.isTabAway ? (
                            <span className="inline-flex items-center rounded-full border border-cyber-crimson/60 bg-cyber-crimson/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyber-crimson animate-pulse">
                              AWAY
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-2 py-2.5">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold ${statusBadge.cls}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>

                      <td className="px-2 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onRemovePlayer(player.id)}
                          aria-label={`Remove ${safeAriaName} session`}
                          title="Remove player session"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-cyber-border text-cyber-muted transition-colors hover:border-cyber-crimson/60 hover:bg-cyber-crimson/10 hover:text-cyber-crimson"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
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
