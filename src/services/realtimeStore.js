import { TOTAL_ROOMS } from '../data/rooms';

const STORAGE_KEY = 'cipher50_escape_room_state_v2';
const CHANNEL_NAME = 'cipher50_escape_room_channel_v2';
const PLAYER_SESSION_KEY = 'cipher50_active_player_id';
const ADMIN_AUTH_SESSION_KEY = 'cipher50_admin_authenticated';
const CLOUD_URL_STORAGE_KEY = 'cipher50_cloud_db_url';

export const POINTS_CORRECT = 100;
export const POINTS_WRONG = -25;
export const POINTS_PAID_HINT = -50;
export const INITIAL_FREE_HINTS = 3;
export const DEFAULT_DURATION_MINUTES = 60;
export const DEFAULT_ADMIN_PASSWORD = 'admin123';

function createDefaultState() {
  return {
    players: {},
    settings: {
      globalDurationMinutes: DEFAULT_DURATION_MINUTES,
      adminPasswordHash: DEFAULT_ADMIN_PASSWORD,
      updatedAt: 0,
    },
    lanUrls: [],
    revision: 1,
    resetEpoch: 0,
  };
}

function loadLocalState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createDefaultState();
    return {
      players: parsed.players && typeof parsed.players === 'object' ? parsed.players : {},
      settings: {
        globalDurationMinutes:
          Number(parsed.settings?.globalDurationMinutes) || DEFAULT_DURATION_MINUTES,
        adminPasswordHash: parsed.settings?.adminPasswordHash || DEFAULT_ADMIN_PASSWORD,
        updatedAt: Number(parsed.settings?.updatedAt) || 0,
      },
      lanUrls: Array.isArray(parsed.lanUrls) ? parsed.lanUrls : [],
      revision: Number(parsed.revision) || 1,
      resetEpoch: Number(parsed.resetEpoch) || 0,
    };
  } catch {
    return createDefaultState();
  }
}

let currentState = typeof window !== 'undefined' ? loadLocalState() : createDefaultState();
const listeners = new Set();
let channel = null;
let eventSource = null;
let pollIntervalId = null;
let initialized = false;

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function saveLocalState(nextState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Ignore storage quota errors
  }
}

function broadcastLocal(nextState) {
  if (channel) {
    try {
      channel.postMessage({ type: 'STATE_SYNC', state: nextState });
    } catch {
      // Ignore closed channel errors
    }
  }
}

export function getCloudDbUrl() {
  try {
    return (
      window.localStorage.getItem(CLOUD_URL_STORAGE_KEY) ||
      import.meta.env?.VITE_FIREBASE_DB_URL ||
      ''
    ).trim();
  } catch {
    return '';
  }
}

export function setCloudDbUrl(url) {
  try {
    const cleaned = String(url || '').trim().replace(/\/+$/, '');
    if (cleaned) {
      window.localStorage.setItem(CLOUD_URL_STORAGE_KEY, cleaned);
      pullFromCloudDb();
    } else {
      window.localStorage.removeItem(CLOUD_URL_STORAGE_KEY);
    }
    emitChange();
  } catch {
    // Ignore storage errors
  }
}

async function pushPlayerToCloudDb(player) {
  const baseUrl = getCloudDbUrl();
  if (!baseUrl || !player?.id) return;
  try {
    await fetch(`${baseUrl}/cipher50/players/${encodeURIComponent(player.id)}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(player),
    });
  } catch {
    // Ignore cloud network errors
  }
}

async function pushFullStateToCloudDb(stateToPush) {
  const baseUrl = getCloudDbUrl();
  if (!baseUrl) return;
  try {
    await fetch(`${baseUrl}/cipher50.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        players: stateToPush.players || {},
        settings: stateToPush.settings || {},
        revision: stateToPush.revision || 1,
        resetEpoch: stateToPush.resetEpoch || 0,
      }),
    });
  } catch {
    // Ignore cloud network errors
  }
}

async function pullFromCloudDb() {
  const baseUrl = getCloudDbUrl();
  if (!baseUrl) return;
  try {
    const res = await fetch(`${baseUrl}/cipher50.json`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        mergeIncomingState({ ...data, fromServer: true });
      }
    }
  } catch {
    // Ignore cloud fetch errors
  }
}

function mergeIncomingState(incoming) {
  if (!incoming || typeof incoming !== 'object') return;
  const incomingEpoch = Number(incoming.resetEpoch) || 0;
  const currentEpoch = Number(currentState.resetEpoch) || 0;

  if (incomingEpoch > currentEpoch) {
    // Admin triggered a global reset
    const next = {
      players: incoming.players || {},
      settings: {
        globalDurationMinutes:
          Number(incoming.settings?.globalDurationMinutes) || DEFAULT_DURATION_MINUTES,
        adminPasswordHash:
          incoming.settings?.adminPasswordHash ||
          currentState.settings?.adminPasswordHash ||
          DEFAULT_ADMIN_PASSWORD,
        updatedAt: Number(incoming.settings?.updatedAt) || Date.now(),
      },
      lanUrls: Array.isArray(incoming.lanUrls) ? incoming.lanUrls : currentState.lanUrls || [],
      revision: Math.max(currentState.revision + 1, Number(incoming.revision) || 1),
      resetEpoch: incomingEpoch,
    };
    currentState = next;
    saveLocalState(next);
    emitChange();
    return;
  }

  // Build merged players map so all players from all devices are visible
  const incomingPlayers = incoming.players || {};
  let nextPlayers;

  if (incoming.fromServer) {
    // Server is authoritative for multi-device player list
    nextPlayers = { ...incomingPlayers };

    // Preserve local active player if created very recently and not yet pushed to server
    const myPlayerId = getStoredPlayerId();
    if (myPlayerId && currentState.players[myPlayerId] && !nextPlayers[myPlayerId]) {
      const localPlayer = currentState.players[myPlayerId];
      const ageMs = Date.now() - (localPlayer.createdAt || localPlayer.lastUpdated || 0);
      if (ageMs < 5000 && incomingEpoch === currentEpoch) {
        nextPlayers[myPlayerId] = localPlayer;
        postServerAction({ type: 'UPSERT_PLAYER', player: localPlayer });
      }
    }
  } else {
    nextPlayers = { ...currentState.players };
    for (const [id, p] of Object.entries(incomingPlayers)) {
      const existing = nextPlayers[id];
      if (!existing || (p.lastUpdated || 0) >= (existing.lastUpdated || 0)) {
        nextPlayers[id] = p;
      }
    }
  }

  let nextSettings = currentState.settings;
  if (
    incoming.settings &&
    ((incoming.settings.updatedAt || 0) >= (currentState.settings?.updatedAt || 0) ||
      incoming.fromServer)
  ) {
    nextSettings = {
      globalDurationMinutes:
        Number(incoming.settings.globalDurationMinutes) || DEFAULT_DURATION_MINUTES,
      adminPasswordHash:
        incoming.settings.adminPasswordHash ||
        currentState.settings?.adminPasswordHash ||
        DEFAULT_ADMIN_PASSWORD,
      updatedAt: Number(incoming.settings.updatedAt) || 0,
    };
  }

  const nextLanUrls = Array.isArray(incoming.lanUrls)
    ? incoming.lanUrls
    : currentState.lanUrls || [];

  const prevJson = JSON.stringify({
    p: currentState.players,
    s: currentState.settings,
    l: currentState.lanUrls,
    e: currentState.resetEpoch,
  });
  const nextJson = JSON.stringify({
    p: nextPlayers,
    s: nextSettings,
    l: nextLanUrls,
    e: Math.max(currentEpoch, incomingEpoch),
  });

  if (prevJson !== nextJson) {
    currentState = {
      players: nextPlayers,
      settings: nextSettings,
      lanUrls: nextLanUrls,
      revision: Math.max(currentState.revision, Number(incoming.revision) || 1) + 1,
      resetEpoch: Math.max(currentEpoch, incomingEpoch),
    };
    saveLocalState(currentState);
    emitChange();
  }
}

async function postServerAction(action) {
  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    });
    if (res.ok) {
      const serverState = await res.json();
      mergeIncomingState({ ...serverState, fromServer: true });
    }
  } catch {
    // Offline or static bundle mode: BroadcastChannel + localStorage + optional Cloud DB still work
  }
}

async function pollServerState() {
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (res.ok) {
      const serverState = await res.json();
      mergeIncomingState({ ...serverState, fromServer: true });
    }
  } catch {
    // Ignore when running without Vite backend
  }
  if (getCloudDbUrl()) {
    pullFromCloudDb();
  }
}

export function initRealtimeStore() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data?.type === 'STATE_SYNC' && event.data.state) {
        mergeIncomingState(event.data.state);
      } else if (event.data?.type === 'FORCE_REPLACE' && event.data.state) {
        currentState = event.data.state;
        saveLocalState(currentState);
        emitChange();
      }
    };
  }

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        mergeIncomingState(parsed);
      } catch {
        // Ignore malformed JSON
      }
    }
  });

  // Initial sync with server
  fetch('/api/state', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((serverState) => {
      if (!serverState) return;
      if (
        Object.keys(serverState.players || {}).length === 0 &&
        Object.keys(currentState.players || {}).length > 0 &&
        (serverState.resetEpoch || 0) <= (currentState.resetEpoch || 0)
      ) {
        postServerAction({ type: 'SYNC_SNAPSHOT', state: currentState });
      } else {
        mergeIncomingState({ ...serverState, fromServer: true });
      }
    })
    .catch(() => {});

  // Connect to SSE stream for instant server push across devices
  if ('EventSource' in window) {
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          mergeIncomingState({ ...parsed, fromServer: true });
        } catch {
          // Ignore invalid SSE payload
        }
      };
    } catch {
      // Ignore SSE errors
    }
  }

  // Continuous 1.5s polling so mobile devices, different browsers, and cloud DB stay 100% synced
  pollIntervalId = window.setInterval(pollServerState, 1500);
}

export function subscribeStore(listener) {
  initRealtimeStore();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStoreSnapshot() {
  return currentState;
}

export function getStoredPlayerId() {
  try {
    return window.sessionStorage.getItem(PLAYER_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setStoredPlayerId(playerId) {
  try {
    if (playerId) {
      window.sessionStorage.setItem(PLAYER_SESSION_KEY, playerId);
    } else {
      window.sessionStorage.removeItem(PLAYER_SESSION_KEY);
    }
  } catch {
    // Ignore sessionStorage errors
  }
}

// ==========================================
// ADMIN PASSWORD & AUTHENTICATION
// ==========================================
export function isAdminAuthenticated() {
  try {
    return window.sessionStorage.getItem(ADMIN_AUTH_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAdminAuthenticated(authenticated) {
  try {
    if (authenticated) {
      window.sessionStorage.setItem(ADMIN_AUTH_SESSION_KEY, 'true');
    } else {
      window.sessionStorage.removeItem(ADMIN_AUTH_SESSION_KEY);
    }
  } catch {
    // Ignore sessionStorage errors
  }
}

export function verifyAdminPassword(inputPassword) {
  const cleaned = String(inputPassword || '').trim();
  const expected = currentState.settings?.adminPasswordHash || DEFAULT_ADMIN_PASSWORD;
  return cleaned === expected;
}

export function updateAdminPassword(newPassword) {
  const cleaned = String(newPassword || '').trim();
  if (!cleaned) return false;
  const now = Date.now();
  const nextState = {
    ...currentState,
    settings: {
      ...currentState.settings,
      adminPasswordHash: cleaned,
      updatedAt: now,
    },
    revision: currentState.revision + 1,
  };
  currentState = nextState;
  saveLocalState(nextState);
  broadcastLocal(nextState);
  emitChange();
  postServerAction({ type: 'UPDATE_ADMIN_PASSWORD', newPassword: cleaned });
  pushFullStateToCloudDb(nextState);
  return true;
}

function commitPlayer(updatedPlayer) {
  const nextState = {
    ...currentState,
    players: {
      ...currentState.players,
      [updatedPlayer.id]: updatedPlayer,
    },
    revision: currentState.revision + 1,
  };
  currentState = nextState;
  saveLocalState(nextState);
  broadcastLocal(nextState);
  emitChange();
  postServerAction({ type: 'UPSERT_PLAYER', player: updatedPlayer });
  pushPlayerToCloudDb(updatedPlayer);
  return updatedPlayer;
}

export function computeRemainingSeconds(
  player,
  now = Date.now(),
  fallbackMinutes = DEFAULT_DURATION_MINUTES
) {
  if (!player) return fallbackMinutes * 60;
  if (player.status === 'briefing') {
    return (player.allocatedMinutes || fallbackMinutes) * 60;
  }
  if (player.status === 'completed' || player.status === 'timeout') {
    return Math.max(0, Number(player.remainingSeconds) || 0);
  }
  if (!player.endTime) {
    return (player.allocatedMinutes || fallbackMinutes) * 60;
  }
  return Math.max(0, Math.ceil((player.endTime - now) / 1000));
}

export function formatSecondsMMSS(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function registerPlayer(rawName) {
  const name = rawName.trim().slice(0, 32);
  const now = Date.now();
  const id = `plr_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const allocatedMinutes =
    currentState.settings.globalDurationMinutes || DEFAULT_DURATION_MINUTES;

  const player = {
    id,
    name,
    currentRoom: 1,
    completedRooms: 0,
    score: 0,
    freeHintsRemaining: INITIAL_FREE_HINTS,
    hintsUsed: 0,
    unlockedHintRooms: [],
    wrongAttempts: 0,
    status: 'briefing',
    allocatedMinutes,
    startTime: null,
    endTime: null,
    remainingSeconds: allocatedMinutes * 60,
    completedAt: null,
    createdAt: now,
    lastUpdated: now,
    lastEvent: 'Joined (Briefing Room)',
  };

  setStoredPlayerId(id);
  return commitPlayer(player);
}

export function startPlayerGame(playerId) {
  const existing = currentState.players[playerId];
  if (!existing) return null;

  const now = Date.now();
  const mins = currentState.settings.globalDurationMinutes || DEFAULT_DURATION_MINUTES;
  const durationMs = mins * 60 * 1000;

  const updated = {
    ...existing,
    status: 'active',
    allocatedMinutes: mins,
    startTime: now,
    endTime: now + durationMs,
    remainingSeconds: mins * 60,
    lastUpdated: now,
    lastEvent: 'Started Challenge',
  };

  return commitPlayer(updated);
}

export function submitPlayerAnswer(playerId, roomId, isCorrect) {
  const existing = currentState.players[playerId];
  if (!existing || existing.status !== 'active') return null;

  const now = Date.now();
  const remaining = computeRemainingSeconds(existing, now, existing.allocatedMinutes);
  if (remaining <= 0) {
    return markPlayerTimeout(playerId);
  }

  if (isCorrect) {
    const isFinalRoom = roomId >= TOTAL_ROOMS;
    const nextCompleted = Math.min(TOTAL_ROOMS, Math.max(existing.completedRooms || 0, roomId));
    const nextRoom = isFinalRoom ? TOTAL_ROOMS : roomId + 1;

    const updated = {
      ...existing,
      score: existing.score + POINTS_CORRECT,
      completedRooms: nextCompleted,
      currentRoom: nextRoom,
      status: isFinalRoom ? 'completed' : 'active',
      remainingSeconds: remaining,
      completedAt: isFinalRoom ? now : null,
      lastUpdated: now,
      lastEvent: isFinalRoom
        ? 'Escaped All 50 Rooms (+100)'
        : `Cleared Room ${roomId} (+100)`,
    };
    return commitPlayer(updated);
  }

  const updated = {
    ...existing,
    score: existing.score + POINTS_WRONG,
    wrongAttempts: (existing.wrongAttempts || 0) + 1,
    remainingSeconds: remaining,
    lastUpdated: now,
    lastEvent: `Wrong Answer Room ${roomId} (-25)`,
  };
  return commitPlayer(updated);
}

export function requestRoomHint(playerId, roomId) {
  const existing = currentState.players[playerId];
  if (!existing || existing.status !== 'active') return null;

  const unlocked = existing.unlockedHintRooms || [];
  if (unlocked.includes(roomId)) {
    return existing;
  }

  const now = Date.now();
  const remaining = computeRemainingSeconds(existing, now, existing.allocatedMinutes);
  if (remaining <= 0) {
    return markPlayerTimeout(playerId);
  }

  const hasFreeHint = existing.freeHintsRemaining > 0;
  const updated = {
    ...existing,
    freeHintsRemaining: hasFreeHint ? existing.freeHintsRemaining - 1 : 0,
    hintsUsed: (existing.hintsUsed || 0) + 1,
    score: hasFreeHint ? existing.score : existing.score + POINTS_PAID_HINT,
    unlockedHintRooms: [...unlocked, roomId],
    remainingSeconds: remaining,
    lastUpdated: now,
    lastEvent: hasFreeHint
      ? `Used Free Hint Room ${roomId}`
      : `Used Paid Hint Room ${roomId} (-50)`,
  };

  return commitPlayer(updated);
}

export function markPlayerTimeout(playerId) {
  const existing = currentState.players[playerId];
  if (!existing || existing.status !== 'active') return existing;

  const now = Date.now();
  const updated = {
    ...existing,
    status: 'timeout',
    remainingSeconds: 0,
    lastUpdated: now,
    lastEvent: 'Timer Expired',
  };

  return commitPlayer(updated);
}

export function updateGlobalTimerSettings(minutes, applyToActive = true) {
  const clamped = Math.max(
    1,
    Math.min(240, Math.round(Number(minutes) || DEFAULT_DURATION_MINUTES))
  );
  const now = Date.now();
  const nextPlayers = { ...currentState.players };

  if (applyToActive) {
    const durationMs = clamped * 60 * 1000;
    for (const [id, p] of Object.entries(nextPlayers)) {
      if (p.status === 'active' && p.startTime) {
        const newEndTime = p.startTime + durationMs;
        const newRemaining = Math.max(0, Math.ceil((newEndTime - now) / 1000));
        nextPlayers[id] = {
          ...p,
          allocatedMinutes: clamped,
          endTime: newEndTime,
          remainingSeconds: newRemaining,
          status: newRemaining === 0 ? 'timeout' : 'active',
          lastUpdated: now,
          lastEvent: `Timer Set to ${clamped}m`,
        };
      } else if (p.status === 'briefing') {
        nextPlayers[id] = {
          ...p,
          allocatedMinutes: clamped,
          remainingSeconds: clamped * 60,
          lastUpdated: now,
        };
      }
    }
  }

  const nextState = {
    ...currentState,
    players: nextPlayers,
    settings: {
      ...currentState.settings,
      globalDurationMinutes: clamped,
      updatedAt: now,
    },
    revision: currentState.revision + 1,
  };

  currentState = nextState;
  saveLocalState(nextState);
  broadcastLocal(nextState);
  emitChange();
  postServerAction({
    type: 'UPDATE_SETTINGS',
    settings: nextState.settings,
    applyToActive,
  });
  pushFullStateToCloudDb(nextState);
}

export function removePlayerSession(playerId) {
  if (!currentState.players[playerId]) return;
  const nextPlayers = { ...currentState.players };
  delete nextPlayers[playerId];

  const nextState = {
    ...currentState,
    players: nextPlayers,
    revision: currentState.revision + 1,
  };

  currentState = nextState;
  saveLocalState(nextState);
  if (channel) {
    try {
      channel.postMessage({ type: 'FORCE_REPLACE', state: nextState });
    } catch {
      // ignore
    }
  }
  emitChange();
  postServerAction({ type: 'REMOVE_PLAYER', playerId });
  pushFullStateToCloudDb(nextState);
}

export function resetAllSessions() {
  const now = Date.now();
  const nextState = {
    players: {},
    settings: {
      ...currentState.settings,
      updatedAt: now,
    },
    lanUrls: currentState.lanUrls || [],
    revision: currentState.revision + 1,
    resetEpoch: now,
  };

  setStoredPlayerId(null);
  currentState = nextState;
  saveLocalState(nextState);
  if (channel) {
    try {
      channel.postMessage({ type: 'FORCE_REPLACE', state: nextState });
    } catch {
      // ignore
    }
  }
  emitChange();
  postServerAction({ type: 'RESET_ALL' });
  pushFullStateToCloudDb(nextState);
}

export function seedDemoPlayers() {
  const now = Date.now();
  const mins = currentState.settings.globalDurationMinutes || DEFAULT_DURATION_MINUTES;
  const totalMs = mins * 60 * 1000;

  const demos = {
    demo_ada: {
      id: 'demo_ada',
      name: 'Ada_Lovelace',
      currentRoom: 50,
      completedRooms: 50,
      score: 4925,
      freeHintsRemaining: 1,
      hintsUsed: 2,
      unlockedHintRooms: [29, 44],
      wrongAttempts: 3,
      status: 'completed',
      allocatedMinutes: mins,
      startTime: now - 38 * 60 * 1000,
      endTime: now + (mins - 38) * 60 * 1000,
      remainingSeconds: Math.max(0, (mins - 38) * 60),
      completedAt: now - 45000,
      createdAt: now - 38 * 60 * 1000,
      lastUpdated: now,
      lastEvent: 'Escaped All 50 Rooms (+100)',
    },
    demo_linus: {
      id: 'demo_linus',
      name: 'Kernel_Linus',
      currentRoom: 36,
      completedRooms: 35,
      score: 3375,
      freeHintsRemaining: 0,
      hintsUsed: 4,
      unlockedHintRooms: [15, 24, 29, 34],
      wrongAttempts: 3,
      status: 'active',
      allocatedMinutes: mins,
      startTime: now - 21 * 60 * 1000,
      endTime: now - 21 * 60 * 1000 + totalMs,
      remainingSeconds: Math.max(0, (mins - 21) * 60),
      completedAt: null,
      createdAt: now - 21 * 60 * 1000,
      lastUpdated: now,
      lastEvent: 'Cleared Room 35 (+100)',
    },
    demo_grace: {
      id: 'demo_grace',
      name: 'Grace_Hopper',
      currentRoom: 22,
      completedRooms: 21,
      score: 2050,
      freeHintsRemaining: 2,
      hintsUsed: 1,
      unlockedHintRooms: [20],
      wrongAttempts: 2,
      status: 'active',
      allocatedMinutes: mins,
      startTime: now - 14 * 60 * 1000,
      endTime: now - 14 * 60 * 1000 + totalMs,
      remainingSeconds: Math.max(0, (mins - 14) * 60),
      completedAt: null,
      createdAt: now - 14 * 60 * 1000,
      lastUpdated: now,
      lastEvent: 'Cleared Room 21 (+100)',
    },
    demo_zero: {
      id: 'demo_zero',
      name: 'NullPointer99',
      currentRoom: 12,
      completedRooms: 11,
      score: 975,
      freeHintsRemaining: 0,
      hintsUsed: 3,
      unlockedHintRooms: [6, 9, 11],
      wrongAttempts: 5,
      status: 'timeout',
      allocatedMinutes: mins,
      startTime: now - totalMs,
      endTime: now,
      remainingSeconds: 0,
      completedAt: null,
      createdAt: now - totalMs,
      lastUpdated: now,
      lastEvent: 'Timer Expired',
    },
  };

  const nextState = {
    ...currentState,
    players: {
      ...currentState.players,
      ...demos,
    },
    revision: currentState.revision + 1,
  };

  currentState = nextState;
  saveLocalState(nextState);
  broadcastLocal(nextState);
  emitChange();
  postServerAction({ type: 'SEED_PLAYERS', players: demos });
  pushFullStateToCloudDb(nextState);
}

export function getSortedPlayers(state, now = Date.now()) {
  const players = Object.values(state?.players || {});
  const fallbackMins = state?.settings?.globalDurationMinutes || DEFAULT_DURATION_MINUTES;

  return players
    .map((p) => {
      const liveRemaining = computeRemainingSeconds(p, now, fallbackMins);
      const effectiveStatus = p.status === 'active' && liveRemaining === 0 ? 'timeout' : p.status;
      return {
        ...p,
        liveRemainingSeconds: liveRemaining,
        effectiveStatus,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.completedRooms || 0) !== (a.completedRooms || 0)) {
        return (b.completedRooms || 0) - (a.completedRooms || 0);
      }
      if (b.currentRoom !== a.currentRoom) return b.currentRoom - a.currentRoom;
      if (b.liveRemainingSeconds !== a.liveRemainingSeconds) {
        return b.liveRemainingSeconds - a.liveRemainingSeconds;
      }
      return a.name.localeCompare(b.name);
    });
}
