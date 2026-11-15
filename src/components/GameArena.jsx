import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Lightbulb,
  Send,
  Trophy,
  AlertTriangle,
  LogOut,
  CheckCircle2,
  XCircle,
  Terminal,
  ShieldCheck,
  RotateCcw,
  SkipForward,
  Pause,
} from 'lucide-react';
import { getRoomById, checkRoomAnswer, TOTAL_ROOMS } from '../data/rooms';
import {
  computeRemainingSeconds,
  formatSecondsMMSS,
  INITIAL_FREE_HINTS,
  POINTS_CORRECT,
  POINTS_PAID_HINT,
  POINTS_WRONG,
} from '../services/realtimeStore';

function getCategoryStyle(category) {
  if (category === 'HTML') {
    return 'border-amber-400/40 bg-amber-400/10 text-amber-300';
  }
  if (category === 'CSS') {
    return 'border-cyber-cyan/40 bg-cyber-cyan/10 text-cyber-cyan';
  }
  return 'border-cyber-emerald/40 bg-cyber-emerald/10 text-cyber-emerald';
}

export default function GameArena({
  player,
  scoringSettings,
  isTimerPaused = false,
  onSubmitAnswer,
  onUseHint,
  onSkipRoom,
  onTabFocusChange,
  onTimeout,
  onLeaveSession,
  onOpenLeaderboard,
}) {
  const pointsCorrect = scoringSettings?.pointsCorrect ?? POINTS_CORRECT;
  const pointsWrong = scoringSettings?.pointsWrong ?? POINTS_WRONG;
  const pointsPaidHint = scoringSettings?.pointsPaidHint ?? POINTS_PAID_HINT;
  const pointsSkip = scoringSettings?.pointsSkip ?? 0;
  const configuredFreeHints =
    player?.initialFreeHints ?? scoringSettings?.freeHintsCount ?? INITIAL_FREE_HINTS;
  const freeHintsLeft = Number(player.freeHintsRemaining) || 0;
  const totalFreeHints = Math.max(freeHintsLeft, configuredFreeHints);

  const [answerInput, setAnswerInput] = useState('');
  const [validationMsg, setValidationMsg] = useState('');
  const [feedbackAnim, setFeedbackAnim] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [confirmExit, setConfirmExit] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const inputRef = useRef(null);
  const animTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const isAwayRef = useRef(false);

  const pausedByAdmin = Boolean(isTimerPaused || player.isTimerPaused);
  const playerRef = useRef(player);
  playerRef.current = player;

  const room = getRoomById(player.currentRoom);
  const remainingSeconds = computeRemainingSeconds(
    player,
    now,
    player.allocatedMinutes,
    pausedByAdmin
  );
  const isHintUnlocked = (player.unlockedHintRooms || []).includes(room.id);
  const codeLines = room.codeSnippet.split('\n');

  // Tick every second while player is active (and not globally paused)
  useEffect(() => {
    if (player.status !== 'active' || pausedByAdmin) return undefined;
    setNow(Date.now());
    const interval = window.setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);
      const latestPlayer = playerRef.current;
      const rem = computeRemainingSeconds(
        latestPlayer,
        currentNow,
        latestPlayer.allocatedMinutes,
        false
      );
      if (rem <= 0) {
        onTimeout(latestPlayer.id);
      }
    }, 500);
    const onVisChange = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [player.id, player.status, pausedByAdmin, onTimeout]);

  // Detect tab switch / window blur while player is actively playing
  useEffect(() => {
    if (player.status !== 'active' || !onTabFocusChange) return undefined;

    const markAway = () => {
      if (!isAwayRef.current) {
        isAwayRef.current = true;
        onTabFocusChange(player.id, true);
      }
    };

    const markReturned = () => {
      if (isAwayRef.current && document.visibilityState === 'visible') {
        isAwayRef.current = false;
        onTabFocusChange(player.id, false);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        markAway();
      } else {
        markReturned();
      }
    };

    const handleBlur = () => {
      markAway();
    };

    const handleFocus = () => {
      markReturned();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [player.id, player.status, onTabFocusChange]);

  // Clear input & validation when moving to a new room
  useEffect(() => {
    setAnswerInput('');
    setValidationMsg('');
    setConfirmSkip(false);
    if (player.status === 'active') {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [player.currentRoom, player.status]);

  useEffect(() => {
    return () => {
      window.clearTimeout(animTimerRef.current);
      window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (type, title, subtitle) => {
    window.clearTimeout(toastTimerRef.current);
    setToast({ id: Date.now(), type, title, subtitle });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2400);
  };

  const triggerCardAnim = (kind) => {
    window.clearTimeout(animTimerRef.current);
    setFeedbackAnim(null);
    window.requestAnimationFrame(() => {
      setFeedbackAnim(kind);
      animTimerRef.current = window.setTimeout(() => {
        setFeedbackAnim(null);
      }, 700);
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (player.status !== 'active') return;

    if (!answerInput.trim()) {
      setValidationMsg('Enter an answer before submitting.');
      inputRef.current?.focus({ preventScroll: true });
      return;
    }

    setValidationMsg('');
    const isCorrect = checkRoomAnswer(room, answerInput);
    onSubmitAnswer(player.id, room.id, isCorrect);

    if (isCorrect) {
      triggerCardAnim('correct');
      showToast(
        'success',
        `${pointsCorrect >= 0 ? `+${pointsCorrect}` : pointsCorrect} PTS`,
        room.id === TOTAL_ROOMS
          ? 'Final room decrypted! Escape complete.'
          : `Room ${room.id} cleared — advancing to Room ${room.id + 1}.`
      );
      setAnswerInput('');
    } else {
      triggerCardAnim('wrong');
      setValidationMsg(
        `Incorrect answer. ${pointsWrong} points deducted — inspect the code carefully and try again.`
      );
      showToast('error', `${pointsWrong} PTS`, `Wrong attempt on Room ${room.id}.`);
      inputRef.current?.select();
    }
  };

  const handleHintClick = () => {
    if (player.status !== 'active' || isHintUnlocked) return;
    const usingFree = freeHintsLeft > 0;
    onUseHint(player.id, room.id);
    if (usingFree) {
      showToast(
        'hint',
        'FREE HINT UNLOCKED',
        `${freeHintsLeft - 1} of ${totalFreeHints} free hints remaining.`
      );
    } else {
      showToast(
        'warning',
        `${pointsPaidHint} PTS`,
        `Paid hint unlocked for Room ${room.id}.`
      );
    }
  };

  const handleConfirmSkipRoom = () => {
    if (player.status !== 'active') return;
    setConfirmSkip(false);
    onSkipRoom(player.id, room.id);
    setAnswerInput('');
    setValidationMsg('');
    const skipLabel = pointsSkip > 0 ? `+${pointsSkip}` : `${pointsSkip}`;
    showToast(
      'hint',
      `ROOM SKIPPED (${skipLabel} PTS)`,
      room.id === TOTAL_ROOMS
        ? 'Final room skipped — run completed.'
        : `Skipped Room ${room.id} — advancing to Room ${room.id + 1}.`
    );
  };

  const solvedCount = Number(player.completedRooms) || 0;
  const skippedCount = Number(player.skippedCount) || 0;
  const progressPct = Math.round((solvedCount / TOTAL_ROOMS) * 100);
  const timerUrgent = !pausedByAdmin && remainingSeconds <= 60;
  const timerWarning = !pausedByAdmin && remainingSeconds > 60 && remainingSeconds <= 300;

  if (player.status === 'completed' || player.status === 'timeout') {
    const escaped = player.status === 'completed';
    const totalHintsUsed = Math.max(
      Number(player.hintsUsed) || 0,
      Array.isArray(player.unlockedHintRooms) ? player.unlockedHintRooms.length : 0
    );
    const totalWrongAttempts = Number(player.wrongAttempts) || 0;

    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="cyber-panel overflow-hidden rounded-2xl p-6 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <div
              className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border ${
                escaped
                  ? 'border-cyber-emerald/50 bg-cyber-emerald/15 text-cyber-emerald shadow-[0_0_30px_rgba(16,185,129,0.25)]'
                  : 'border-cyber-crimson/50 bg-cyber-crimson/15 text-cyber-crimson shadow-[0_0_30px_rgba(239,68,68,0.25)]'
              }`}
            >
              {escaped ? (
                <Trophy className="h-8 w-8" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-8 w-8" aria-hidden="true" />
              )}
            </div>

            <span
              className={`mb-2 rounded-full border px-3 py-1 font-mono text-xs font-semibold ${
                escaped
                  ? 'border-cyber-emerald/40 bg-cyber-emerald/10 text-cyber-emerald'
                  : 'border-cyber-crimson/40 bg-cyber-crimson/10 text-cyber-crimson'
              }`}
            >
              {escaped ? 'ESCAPE SUCCESSFUL' : 'TIME EXPIRED'}
            </span>

            <h1 className="text-3xl font-bold text-cyber-text sm:text-4xl">
              {escaped
                ? `Congratulations, ${player.name}!`
                : `Time Out, ${player.name}`}
            </h1>
            <p className="mt-2 max-w-prose text-sm text-cyber-muted sm:text-base">
              {escaped
                ? 'All 50 security rooms across HTML, CSS, and JavaScript have been breached and verified.'
                : 'The countdown timer reached 00:00 before all 50 rooms were unlocked. Your final score has been recorded on the leaderboard.'}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-4 text-center">
              <div className="text-xs text-cyber-muted">Final Score</div>
              <div
                className={`tabular-nums mt-1 font-mono text-2xl font-bold ${
                  player.score >= 0 ? 'text-cyber-emerald' : 'text-cyber-crimson'
                }`}
              >
                {player.score}
              </div>
            </div>
            <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-4 text-center">
              <div className="text-xs text-cyber-muted">Rooms Cleared</div>
              <div className="tabular-nums mt-1 font-mono text-2xl font-bold text-cyber-cyan">
                {solvedCount}/{TOTAL_ROOMS}
              </div>
            </div>
            <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-4 text-center">
              <div className="text-xs text-cyber-muted">Time Left</div>
              <div className="tabular-nums mt-1 font-mono text-2xl font-bold text-cyber-text">
                {formatSecondsMMSS(remainingSeconds)}
              </div>
            </div>
            <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 p-4 text-center">
              <div className="text-xs text-cyber-muted">Hints / Errors</div>
              <div className="tabular-nums mt-1 font-mono text-2xl font-bold text-cyber-amber">
                {totalHintsUsed} / {totalWrongAttempts}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-cyber-cyan px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              View Live Leaderboard
            </button>
            <button
              type="button"
              onClick={onLeaveSession}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-cyber-border bg-cyber-surface px-6 py-3 text-sm font-semibold text-cyber-text transition-colors hover:border-slate-500"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Start New Player Run
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      {/* Floating Feedback Toast */}
      {toast ? (
        <div
          key={toast.id}
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-20 z-50 flex max-w-xs items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md animate-slideToast ${
            toast.type === 'success'
              ? 'border-cyber-emerald/60 bg-emerald-950/90 text-emerald-100'
              : toast.type === 'error'
              ? 'border-cyber-crimson/60 bg-red-950/90 text-red-100'
              : 'border-cyber-amber/60 bg-amber-950/90 text-amber-100'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-cyber-emerald" aria-hidden="true" />
          ) : toast.type === 'error' ? (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-cyber-crimson" aria-hidden="true" />
          ) : (
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-cyber-amber" aria-hidden="true" />
          )}
          <div>
            <div className="font-mono text-sm font-bold">{toast.title}</div>
            <div className="text-xs opacity-90">{toast.subtitle}</div>
          </div>
        </div>
      ) : null}

      {/* Exit Confirmation Modal */}
      {confirmExit ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-cyber-bg/80 p-4 backdrop-blur-sm"
        >
          <div className="cyber-panel w-full max-w-sm rounded-2xl border border-cyber-crimson/40 p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyber-crimson/40 bg-cyber-crimson/10 text-cyber-crimson">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="exit-confirm-title" className="text-base font-bold text-cyber-text">
                  Exit Current Session?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-cyber-muted">
                  Leaving now will pause your active run. You can rejoin later with the same callsign.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="rounded-lg border border-cyber-border bg-cyber-surface px-4 py-2 text-xs font-semibold text-cyber-text transition-colors hover:border-slate-500"
              >
                Stay in Room
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmExit(false);
                  onLeaveSession();
                }}
                className="rounded-lg bg-cyber-crimson px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-500"
              >
                Confirm Exit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Skip Room Confirmation Modal */}
      {confirmSkip ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="skip-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-cyber-bg/80 p-4 backdrop-blur-sm"
        >
          <div className="cyber-panel w-full max-w-sm rounded-2xl border border-cyber-amber/40 p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyber-amber/40 bg-cyber-amber/10 text-cyber-amber">
                <SkipForward className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="skip-confirm-title" className="text-base font-bold text-cyber-text">
                  Skip Room {String(room.id).padStart(2, '0')}?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-cyber-muted">
                  Skipping advances you to the next room ({pointsSkip >= 0 ? `+${pointsSkip}` : pointsSkip} pts) and will not count this room as decrypted.
                </p>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmSkip(false)}
                className="rounded-lg border border-cyber-border bg-cyber-surface px-4 py-2 text-xs font-semibold text-cyber-text transition-colors hover:border-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSkipRoom}
                className="rounded-lg bg-cyber-amber px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-400"
              >
                Confirm Skip
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Arena HUD Header */}
      <section
        aria-label="Player status telemetry"
        className="cyber-panel rounded-2xl p-4 sm:p-5"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {/* Player Name */}
          <div className="col-span-2 flex items-center justify-between gap-2 rounded-xl border border-cyber-border bg-cyber-bg/80 px-3.5 py-2.5 sm:col-span-1 sm:block">
            <div className="text-[11px] font-medium text-cyber-muted">Player</div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-sm font-bold text-cyber-text">
                {player.name}
              </span>
              <button
                type="button"
                onClick={() => setConfirmExit(true)}
                title="Exit current session"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-cyber-border text-cyber-muted transition-colors hover:border-cyber-crimson/50 hover:text-cyber-crimson"
                aria-label="Exit current player session"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Current Room */}
          <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 px-3.5 py-2.5">
            <div className="text-[11px] font-medium text-cyber-muted">Current Room</div>
            <div className="tabular-nums font-mono text-base font-bold text-cyber-cyan sm:text-lg">
              Room {player.currentRoom} / {TOTAL_ROOMS}
            </div>
          </div>

          {/* Current Score */}
          <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 px-3.5 py-2.5">
            <div className="text-[11px] font-medium text-cyber-muted">Score</div>
            <div
              className={`tabular-nums font-mono text-base font-bold sm:text-lg ${
                player.score >= 0 ? 'text-cyber-emerald' : 'text-cyber-crimson'
              }`}
            >
              {player.score} pts
            </div>
          </div>

          {/* Free Hints */}
          <div className="rounded-xl border border-cyber-border bg-cyber-bg/80 px-3.5 py-2.5">
            <div className="text-[11px] font-medium text-cyber-muted">Free Hints</div>
            <div className="tabular-nums font-mono text-base font-bold text-cyber-amber sm:text-lg">
              {freeHintsLeft} / {totalFreeHints}
            </div>
          </div>

          {/* Live Countdown Timer */}
          <div
            className={`rounded-xl border px-3.5 py-2.5 ${
              pausedByAdmin
                ? 'border-cyber-amber/70 bg-cyber-amber/15'
                : timerUrgent
                ? 'border-cyber-crimson/70 bg-cyber-crimson/10'
                : timerWarning
                ? 'border-cyber-amber/60 bg-cyber-amber/10'
                : 'border-cyber-border bg-cyber-bg/80'
            }`}
          >
            <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-cyber-muted">
              <span className="flex items-center gap-1">
                {pausedByAdmin ? (
                  <Pause className="h-3 w-3 text-cyber-amber" aria-hidden="true" />
                ) : (
                  <Clock className="h-3 w-3" aria-hidden="true" />
                )}
                Time Remaining
              </span>
              {pausedByAdmin ? (
                <span className="rounded border border-cyber-amber/50 bg-cyber-amber/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-cyber-amber">
                  PAUSED
                </span>
              ) : null}
            </div>
            <div
              className={`tabular-nums font-mono text-base font-bold sm:text-lg ${
                pausedByAdmin
                  ? 'text-cyber-amber'
                  : timerUrgent
                  ? 'animate-pulse text-cyber-crimson'
                  : timerWarning
                  ? 'text-cyber-amber'
                  : 'text-cyber-text'
              }`}
            >
              {formatSecondsMMSS(remainingSeconds)}
            </div>
          </div>
        </div>

        {pausedByAdmin ? (
          <div
            role="status"
            className="mt-3 flex items-center gap-2 rounded-xl border border-cyber-amber/50 bg-cyber-amber/10 px-3.5 py-2 text-xs font-medium text-cyber-amber"
          >
            <Pause className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            All countdown timers are paused by the Game Administrator.
          </div>
        ) : null}

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-cyber-muted">
            <span>Escape Progress</span>
            <span className="tabular-nums font-mono">
              {solvedCount} of {TOTAL_ROOMS} decrypted ({progressPct}%)
              {skippedCount > 0 ? ` • ${skippedCount} skipped` : ''}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-cyber-bg">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyber-cyan to-cyber-emerald transition-all duration-300"
              style={{ width: `${Math.max(2, progressPct)}%` }}
            />
          </div>
        </div>
      </section>

      {/* Main Challenge Card */}
      <main
        className={`cyber-panel rounded-2xl p-5 transition-shadow sm:p-8 ${
          feedbackAnim === 'correct'
            ? 'animate-flashGreen border-cyber-emerald/80'
            : feedbackAnim === 'wrong'
            ? 'animate-shake animate-flashRed border-cyber-crimson/80'
            : ''
        }`}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg border border-cyber-border bg-cyber-bg px-3 py-1 font-mono text-xs font-bold text-cyber-text">
              ROOM {String(room.id).padStart(2, '0')}
            </span>
            <span
              className={`rounded-lg border px-3 py-1 font-mono text-xs font-bold ${getCategoryStyle(
                room.category
              )}`}
            >
              {room.category}
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-cyber-muted">
            <span>Pass: {pointsCorrect >= 0 ? `+${pointsCorrect}` : pointsCorrect}</span>
            <span className="text-cyber-crimson">Miss: {pointsWrong}</span>
          </div>
        </div>

        <h1 className="max-w-prose text-lg font-semibold leading-relaxed text-cyber-text sm:text-xl">
          {room.question}
        </h1>

        {/* Terminal Code Snippet */}
        <div className="mt-5 overflow-hidden rounded-xl border border-cyber-border bg-[#05070B]">
          <div className="flex items-center justify-between border-b border-cyber-border bg-cyber-surface/70 px-4 py-2">
            <div className="flex items-center gap-2 font-mono text-xs text-cyber-muted">
              <Terminal className="h-3.5 w-3.5 text-cyber-cyan" aria-hidden="true" />
              <span>
                challenge_{String(room.id).padStart(2, '0')}.
                {room.category === 'HTML' ? 'html' : room.category === 'CSS' ? 'css' : 'js'}
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-500">READ-ONLY</span>
          </div>
          <div className="overflow-x-auto p-4">
            <pre className="m-0 font-mono text-sm leading-6 text-slate-200">
              <code className="block">
                {codeLines.map((line, index) => (
                  <div key={index} className="flex items-baseline">
                    <span className="w-8 shrink-0 select-none pr-4 text-right text-xs text-slate-600">
                      {index + 1}
                    </span>
                    <span className="whitespace-pre">{line || ' '}</span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>

        {/* Hint Panel (Revealed) */}
        {isHintUnlocked ? (
          <div
            role="note"
            className="mt-5 rounded-xl border border-cyber-amber/40 bg-cyber-amber/10 p-4"
          >
            <div className="mb-1 flex items-center gap-2 font-mono text-xs font-bold text-cyber-amber">
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
              DECRYPTED HINT — ROOM {room.id}
            </div>
            <p className="text-sm leading-relaxed text-amber-100">{room.hint}</p>
          </div>
        ) : null}

        {/* Answer Submission + Hint Controls */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-3" noValidate>
          <label htmlFor="room-answer-input" className="block text-sm font-medium text-cyber-muted">
            Your Solution
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <input
              ref={inputRef}
              id="room-answer-input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={answerInput}
              onChange={(e) => {
                setAnswerInput(e.target.value);
                if (validationMsg) setValidationMsg('');
              }}
              placeholder="Type your exact answer..."
              aria-invalid={Boolean(validationMsg)}
              aria-describedby={validationMsg ? 'answer-feedback-error' : undefined}
              className="min-h-[48px] min-w-[220px] flex-1 rounded-xl border border-cyber-border bg-cyber-bg px-4 py-3 font-mono text-base text-cyber-text placeholder:text-slate-500 focus:border-cyber-cyan focus:outline-none focus:ring-2 focus:ring-cyber-cyan/30"
            />

            <button
              type="submit"
              className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl bg-cyber-cyan px-6 py-3 text-sm font-bold text-slate-950 transition-all duration-150 hover:bg-cyan-300 active:scale-[0.98]"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Submit
            </button>

            <button
              type="button"
              onClick={handleHintClick}
              disabled={isHintUnlocked}
              aria-disabled={isHintUnlocked}
              className={`inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-all duration-150 ${
                isHintUnlocked
                  ? 'cursor-not-allowed border-cyber-border bg-cyber-surface/40 text-slate-500 opacity-50'
                  : freeHintsLeft > 0
                  ? 'border-cyber-amber/50 bg-cyber-amber/10 text-cyber-amber hover:bg-cyber-amber/20 active:scale-[0.98]'
                  : 'border-cyber-crimson/50 bg-cyber-crimson/10 text-cyber-crimson hover:bg-cyber-crimson/20 active:scale-[0.98]'
              }`}
            >
              <Lightbulb className="h-4 w-4" aria-hidden="true" />
              {isHintUnlocked
                ? 'Hint Used'
                : freeHintsLeft > 0
                ? `Hint (Free ${freeHintsLeft}/${totalFreeHints})`
                : `Hint (${pointsPaidHint} pts)`}
            </button>

            <button
              type="button"
              onClick={() => setConfirmSkip(true)}
              title={`Skip this room (${pointsSkip >= 0 ? `+${pointsSkip}` : pointsSkip} pts)`}
              className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-600/80 bg-cyber-surfaceElevated px-4 py-3 text-sm font-semibold text-cyber-text transition-all duration-150 hover:border-cyber-cyan/60 hover:text-cyber-cyan active:scale-[0.98]"
            >
              <SkipForward className="h-4 w-4" aria-hidden="true" />
              {pointsSkip !== 0 ? `Skip (${pointsSkip})` : 'Skip Room'}
            </button>
          </div>

          {validationMsg ? (
            <p
              id="answer-feedback-error"
              role="alert"
              className="text-sm font-medium text-cyber-crimson"
            >
              {validationMsg}
            </p>
          ) : null}
        </form>
      </main>
    </div>
  );
}
