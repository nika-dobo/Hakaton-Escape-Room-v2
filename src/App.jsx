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
  isAdminAuthenticated,
  setAdminAuthenticated,
  registerPlayer,
  startPlayerGame,
  submitPlayerAnswer,
  requestRoomHint,
  markPlayerTimeout,
  updateGlobalTimerSettings,
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

  useEffect(() => {
    const onHashChange = () => {
      setActiveView(getViewFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const currentPlayer = activePlayerId ? storeState.players[activePlayerId] || null : null;

  // Clear local session pointer if admin wiped/removed this player
  useEffect(() => {
    if (activePlayerId && !storeState.players[activePlayerId]) {
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
    const player = registerPlayer(name);
    setActivePlayerId(player.id);
  };

  const handleLeaveSession = () => {
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
              currentPasswordHash={storeState.settings?.adminPasswordHash}
              onAuthenticated={handleAdminAuthenticated}
              onBackToPlayer={() => handleSelectView('player')}
            />
          ) : (
            <AdminDashboard
              storeState={storeState}
              onUpdateTimer={updateGlobalTimerSettings}
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
          />
        ) : currentPlayer.status === 'briefing' ? (
          <BriefingModal
            playerName={currentPlayer.name}
            allocatedMinutes={currentPlayer.allocatedMinutes || globalMinutes}
            onStartGame={() => startPlayerGame(currentPlayer.id)}
            onLeaveSession={handleLeaveSession}
          />
        ) : (
          <GameArena
            player={currentPlayer}
            onSubmitAnswer={submitPlayerAnswer}
            onUseHint={requestRoomHint}
            onTimeout={markPlayerTimeout}
            onLeaveSession={handleLeaveSession}
            onOpenAdminView={() => handleSelectView('admin')}
          />
        )}
      </div>
    </div>
  );
}
