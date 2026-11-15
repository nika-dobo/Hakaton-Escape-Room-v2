import React, { useState, useEffect, useSyncExternalStore } from 'react';
import Navbar from './components/Navbar';
import EntryScreen from './components/EntryScreen';
import BriefingModal from './components/BriefingModal';
import GameArena from './components/GameArena';
import AdminDashboard from './components/AdminDashboard';
import AdminAuthGate from './components/AdminAuthGate';
import PublicLeaderboard from './components/PublicLeaderboard';
import {
  subscribeStore,
  getStoreSnapshot,
  getStoredPlayerId,
  setStoredPlayerId,
  getScoringSettings,
  isAdminAuthenticated,
  setAdminAuthenticated,
  registerPlayer,
  startPlayerGame,
  submitPlayerAnswer,
  requestRoomHint,
  skipPlayerRoom,
  reportPlayerFocusChange,
  sendPlayerHeartbeat,
  markPlayerDisconnected,
  markPlayerTimeout,
  updateGlobalTimerSettings,
  toggleGlobalTimerPause,
  updateScoringSettings,
  adjustPlayerScore,
  removePlayerSession,
  resetAllSessions,
  seedDemoPlayers,
  getSessionTerminatedNotice,
  clearSessionTerminatedNotice,
} from './services/realtimeStore';

function getViewFromHash() {
  if (typeof window === 'undefined') return 'player';
  if (window.location.hash === '#/admin') return 'admin';
  if (window.location.hash === '#/leaderboard') return 'leaderboard';
  return 'player';
}

export default function App() {
  const storeState = useSyncExternalStore(subscribeStore, getStoreSnapshot, getStoreSnapshot);
  const [activeView, setActiveView] = useState(getViewFromHash);
  const [activePlayerId, setActivePlayerId] = useState(() => getStoredPlayerId());
  const [adminAuthed, setAdminAuthed] = useState(() => isAdminAuthenticated());
  const [lastDraftName, setLastDraftName] = useState('');

  useEffect(() => {
    const onHashChange = () => {
      setActiveView(getViewFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const currentPlayer = activePlayerId ? storeState.players[activePlayerId] || null : null;

  // Send heartbeat & detect tab/browser close for live Admin status
  useEffect(() => {
    if (!currentPlayer) return undefined;
    const isRunning =
      currentPlayer.status === 'active' ||
      currentPlayer.status === 'briefing' ||
      currentPlayer.status === 'disconnected';
    if (!isRunning) return undefined;

    sendPlayerHeartbeat(currentPlayer.id);
    const hbId = window.setInterval(() => {
      sendPlayerHeartbeat(currentPlayer.id);
    }, 5000);

    const handleUnload = () => {
      markPlayerDisconnected(currentPlayer.id, 'closed');
    };

    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.clearInterval(hbId);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [currentPlayer?.id, currentPlayer?.status]);

  // Clear local session pointer if admin wiped/removed this player or player explicitly left
  useEffect(() => {
    const stored = getStoredPlayerId();
    if (activePlayerId && !stored) {
      setActivePlayerId(null);
      return;
    }
    if (
      activePlayerId &&
      (!storeState.players[activePlayerId] || storeState.players[activePlayerId].status === 'left')
    ) {
      setStoredPlayerId(null);
      setActivePlayerId(null);
    }
  }, [activePlayerId, storeState.players, storeState.resetEpoch, storeState.removedIds]);

  const handleSelectView = (view) => {
    setActiveView(view);
    const targetHash =
      view === 'admin' ? '#/admin' : view === 'leaderboard' ? '#/leaderboard' : '#/';
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  };

  const handleOpenAdminTab = () => {
    const url = `${window.location.origin}${window.location.pathname}#/admin`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleJoin = (name) => {
    setLastDraftName(name);
    const result = registerPlayer(name);
    if (result?.ok && result.player) {
      setActivePlayerId(result.player.id);
    }
    return result;
  };

  const handleLeaveSession = () => {
    if (currentPlayer?.status === 'briefing' && !currentPlayer?.startTime && currentPlayer?.name) {
      setLastDraftName(currentPlayer.name);
    } else if (
      currentPlayer &&
      (currentPlayer.status === 'completed' || currentPlayer.status === 'timeout')
    ) {
      setLastDraftName(currentPlayer.name || '');
    } else {
      setLastDraftName('');
    }
    if (
      currentPlayer &&
      (currentPlayer.status === 'active' || currentPlayer.status === 'briefing')
    ) {
      markPlayerDisconnected(currentPlayer.id, 'left');
    }
    setStoredPlayerId(null);
    setActivePlayerId(null);
  };

  const handleAdminAuthenticated = () => {
    setAdminAuthenticated(true);
    setAdminAuthed(true);
  };

  const handleLockAdmin = () => {
    setAdminAuthenticated(false);
    setAdminAuthed(false);
  };

  const allPlayers = Object.values(storeState.players || {});
  const playerCount = Math.max(allPlayers.length, Number(storeState.playerCount) || 0);
  const activeCount = Math.max(
    allPlayers.filter((p) => p.status === 'active').length,
    Number(storeState.activeCount) || 0
  );
  const globalMinutes = Number(storeState.settings?.globalDurationMinutes) || 60;
  const scoringSettings = getScoringSettings(storeState);
  const sessionNotice = getSessionTerminatedNotice();

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden">
      <Navbar
        activeView={activeView}
        onSelectView={handleSelectView}
        playerCount={playerCount}
        activeCount={activeCount}
        onOpenAdminTab={handleOpenAdminTab}
      />

      <div className="w-full min-w-0 flex-1 pb-12">
        {activeView === 'admin' ? (
          !adminAuthed ? (
            <AdminAuthGate
              onAuthenticated={handleAdminAuthenticated}
              onBackToPlayer={() => handleSelectView('player')}
            />
          ) : (
            <AdminDashboard
              storeState={storeState}
              onUpdateTimer={updateGlobalTimerSettings}
              onToggleGlobalPause={toggleGlobalTimerPause}
              onUpdateScoring={updateScoringSettings}
              onAdjustScore={adjustPlayerScore}
              onResetAll={resetAllSessions}
              onRemovePlayer={removePlayerSession}
              onSeedDemo={seedDemoPlayers}
              onLockAdmin={handleLockAdmin}
            />
          )
        ) : activeView === 'leaderboard' ? (
          <PublicLeaderboard
            storeState={storeState}
            currentPlayer={currentPlayer}
            isTimerPaused={Boolean(storeState.settings?.isPaused)}
            onBackToPlayer={() => handleSelectView('player')}
            onStartNewRun={() => {
              handleLeaveSession();
              handleSelectView('player');
            }}
          />
        ) : !currentPlayer ? (
          <EntryScreen
            onJoin={handleJoin}
            globalDurationMinutes={globalMinutes}
            scoringSettings={scoringSettings}
            initialName={lastDraftName}
            sessionNotice={sessionNotice}
            onDismissNotice={clearSessionTerminatedNotice}
          />
        ) : currentPlayer.status === 'briefing' && !currentPlayer.startTime ? (
          <BriefingModal
            playerName={currentPlayer.name}
            allocatedMinutes={globalMinutes}
            scoringSettings={scoringSettings}
            onStartGame={() => startPlayerGame(currentPlayer.id)}
            onLeaveSession={handleLeaveSession}
          />
        ) : (
          <GameArena
            player={currentPlayer}
            scoringSettings={scoringSettings}
            isTimerPaused={Boolean(storeState.settings?.isPaused)}
            onSubmitAnswer={submitPlayerAnswer}
            onUseHint={requestRoomHint}
            onSkipRoom={skipPlayerRoom}
            onTabFocusChange={reportPlayerFocusChange}
            onTimeout={markPlayerTimeout}
            onLeaveSession={handleLeaveSession}
            onOpenLeaderboard={() => handleSelectView('leaderboard')}
          />
        )}
      </div>
    </div>
  );
}
