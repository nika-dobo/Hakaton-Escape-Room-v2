import React, { useState, useEffect, useSyncExternalStore } from 'react';
import Navbar from './components/Navbar';
import EntryScreen from './components/EntryScreen';
import BriefingModal from './components/BriefingModal';
import GameArena from './components/GameArena';
import AdminDashboard from './components/AdminDashboard';
import AdminAuthGate from './components/AdminAuthGate';
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
  updateScoringSettings,
  adjustPlayerScore,
  removePlayerSession,
  resetAllSessions,
  seedDemoPlayers,
} from './services/realtimeStore';

function getViewFromHash() {
  if (typeof window === 'undefined') return 'player';
  return window.location.hash === '#/admin' ? 'admin' : 'player';
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
    if (
      activePlayerId &&
      (!storeState.players[activePlayerId] || storeState.players[activePlayerId].status === 'left')
    ) {
      setStoredPlayerId(null);
      setActivePlayerId(null);
    }
  }, [activePlayerId, storeState.players]);

  const handleSelectView = (view) => {
    setActiveView(view);
    const targetHash = view === 'admin' ? '#/admin' : '#/';
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
    if (currentPlayer?.status === 'briefing' && currentPlayer?.name) {
      setLastDraftName(currentPlayer.name);
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
  const activeCount = allPlayers.filter((p) => p.status === 'active').length;
  const globalMinutes = storeState.settings?.globalDurationMinutes || 60;
  const scoringSettings = getScoringSettings(storeState);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar
        activeView={activeView}
        onSelectView={handleSelectView}
        playerCount={allPlayers.length}
        activeCount={activeCount}
        onOpenAdminTab={handleOpenAdminTab}
      />

      <div className="flex-1 pb-12">
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
              onUpdateScoring={updateScoringSettings}
              onAdjustScore={adjustPlayerScore}
              onResetAll={resetAllSessions}
              onRemovePlayer={removePlayerSession}
              onSeedDemo={seedDemoPlayers}
              onLockAdmin={handleLockAdmin}
            />
          )
        ) : !currentPlayer ? (
          <EntryScreen
            onJoin={handleJoin}
            globalDurationMinutes={globalMinutes}
            scoringSettings={scoringSettings}
            initialName={lastDraftName}
          />
        ) : currentPlayer.status === 'briefing' ? (
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
            onSubmitAnswer={submitPlayerAnswer}
            onUseHint={requestRoomHint}
            onSkipRoom={skipPlayerRoom}
            onTabFocusChange={reportPlayerFocusChange}
            onTimeout={markPlayerTimeout}
            onLeaveSession={handleLeaveSession}
            onOpenAdminView={() => handleSelectView('admin')}
          />
        )}
      </div>
    </div>
  );
}
