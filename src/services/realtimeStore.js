import { TOTAL_ROOMS } from '../data/rooms';

const STORAGE_KEY = 'cipher50_escape_room_state_v2';
const CHANNEL_NAME = 'cipher50_escape_room_channel_v2';
const PLAYER_SESSION_KEY = 'cipher50_active_player_id';
const ADMIN_AUTH_SESSION_KEY = 'cipher50_admin_authenticated';
const CLOUD_URL_STORAGE_KEY = 'cipher50_cloud_db_url';

export const POINTS_CORRECT = 100;
export const POINTS_WRONG = -25;
export const POINTS_PAID_HINT = -50;
export const POINTS_SKIP = 0;
export const INITIAL_FREE_HINTS = 3;
export const DEFAULT_DURATION_MINUTES = 60;
export const DEFAULT_ADMIN_PASSWORD = 'admin123';

export function getScoringSettings(state = currentState) {
  const s = state?.settings || {};
  return {
    pointsCorrect: s.pointsCorrect !== undefined ? Number(s.pointsCorrect) : POINTS_CORRECT,
    pointsWrong: s.pointsWrong !== undefined ? Number(s.pointsWrong) : POINTS_WRONG,
    pointsPaidHint: s.pointsPaidHint !== undefined ? Number(s.pointsPaidHint) : POINTS_PAID_HINT,
    pointsSkip: s.pointsSkip !== undefined ? Number(s.pointsSkip) : POINTS_SKIP,
    freeHintsCount:
      s.freeHintsCount !== undefined ? Math.max(0, Number(s.freeHintsCount)) : INITIAL_FREE_HINTS,
  };
}

function createDefaultState() {
  return {
    players: {},
    settings: {
      globalDurationMinutes: DEFAULT_DURATION_MINUTES,
      pointsCorrect: POINTS_CORRECT,
      pointsWrong: POINTS_WRONG,
      pointsPaidHint: POINTS_PAID_HINT,
      pointsSkip: POINTS_SKIP,
      freeHintsCount: INITIAL_FREE_HINTS,
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
    const s = parsed.settings || {};
    return {
      players: parsed.players && typeof parsed.players === 'object' ? parsed.players : {},
      settings: {
        globalDurationMinutes:
          Number(s.globalDurationMinutes) || DEFAULT_DURATION_MINUTES,
        pointsCorrect: s.pointsCorrect !== undefined ? Number(s.pointsCorrect) : POINTS_CORRECT,
        pointsWrong: s.pointsWrong !== undefined ? Number(s.pointsWrong) : POINTS_WRONG,
        pointsPaidHint: s.pointsPaidHint !== undefined ? Number(s.pointsPaidHint) : POINTS_PAID_HINT,
        pointsSkip: s.pointsSkip !== undefined ? Number(s.pointsSkip) : POINTS_SKIP,
        freeHintsCount:
          s.freeHintsCount !== undefined ? Number(s.freeHintsCount) : INITIAL_FREE_HINTS,
        adminPasswordHash: s.adminPasswordHash || DEFAULT_ADMIN_PASSWORD,
        updatedAt: Number(s.updatedAt) || 0,
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
let inFlightPostCount = 0;
let lastMutationAt = 0;

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

  // Never let a stale snapshot from before our latest local reset overwrite us
  if (incomingEpoch < currentEpoch) {
    return;
  }

  if (incomingEpoch > currentEpoch) {
    // Admin triggered a global reset
    const s = incoming.settings || {};
    const next = {
      players: incoming.players || {},
      settings: {
        globalDurationMinutes: Number(s.globalDurationMinutes) || DEFAULT_DURATION_MINUTES,
        pointsCorrect:
          s.pointsCorrect !== undefined ? Number(s.pointsCorrect) : POINTS_CORRECT,
        pointsWrong: s.pointsWrong !== undefined ? Number(s.pointsWrong) : POINTS_WRONG,
        pointsPaidHint:
          s.pointsPaidHint !== undefined ? Number(s.pointsPaidHint) : POINTS_PAID_HINT,
        pointsSkip: s.pointsSkip !== undefined ? Number(s.pointsSkip) : POINTS_SKIP,
        freeHintsCount:
          s.freeHintsCount !== undefined ? Number(s.freeHintsCount) : INITIAL_FREE_HINTS,
        adminPasswordHash:
          s.adminPasswordHash ||
          currentState.settings?.adminPasswordHash ||
          DEFAULT_ADMIN_PASSWORD,
        updatedAt: Number(s.updatedAt) || Date.now(),
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

    // Never overwrite or drop the active local player with an older server snapshot
    const myPlayerId = getStoredPlayerId();
    if (myPlayerId && currentState.players[myPlayerId] && incoming.fromAction !== 'REMOVE_PLAYER') {
      const localPlayer = currentState.players[myPlayerId];
      const serverPlayer = nextPlayers[myPlayerId];
      if (!serverPlayer) {
        if (localPlayer.status !== 'left') {
          nextPlayers[myPlayerId] = localPlayer;
          postServerAction({ type: 'UPSERT_PLAYER', player: localPlayer });
        }
      } else if ((localPlayer.lastUpdated || 0) > (serverPlayer.lastUpdated || 0)) {
        nextPlayers[myPlayerId] = localPlayer;
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
      pointsCorrect:
        incoming.settings.pointsCorrect !== undefined
          ? Number(incoming.settings.pointsCorrect)
          : currentState.settings?.pointsCorrect ?? POINTS_CORRECT,
      pointsWrong:
        incoming.settings.pointsWrong !== undefined
          ? Number(incoming.settings.pointsWrong)
          : currentState.settings?.pointsWrong ?? POINTS_WRONG,
      pointsPaidHint:
        incoming.settings.pointsPaidHint !== undefined
          ? Number(incoming.settings.pointsPaidHint)
          : currentState.settings?.pointsPaidHint ?? POINTS_PAID_HINT,
      pointsSkip:
        incoming.settings.pointsSkip !== undefined
          ? Number(incoming.settings.pointsSkip)
          : currentState.settings?.pointsSkip ?? POINTS_SKIP,
      freeHintsCount:
        incoming.settings.freeHintsCount !== undefined
          ? Number(incoming.settings.freeHintsCount)
          : currentState.settings?.freeHintsCount ?? INITIAL_FREE_HINTS,
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
  inFlightPostCount += 1;
  const startedAt = Date.now();
  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
    });
    if (res.ok) {
      const serverState = await res.json();
      if (startedAt >= lastMutationAt - 50) {
        mergeIncomingState({ ...serverState, fromServer: true, fromAction: action.type });
      }
    }
  } catch {
    // Offline or static bundle mode: BroadcastChannel + localStorage + optional Cloud DB still work
  } finally {
    inFlightPostCount = Math.max(0, inFlightPostCount - 1);
  }
}

async function pollServerState() {
  if (inFlightPostCount > 0) return;
  const pollStartedAt = Date.now();
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (res.ok) {
      if (inFlightPostCount > 0 || pollStartedAt < lastMutationAt) return;
      const serverState = await res.json();
      mergeIncomingState({ ...serverState, fromServer: true });
    }
  } catch {
    // Ignore when running without backend
  }
  if (getCloudDbUrl() && inFlightPostCount === 0) {
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

  // Connect to SSE stream only in Vite dev mode (Vercel serverless uses /api/state polling)
  if (import.meta.env?.DEV && 'EventSource' in window) {
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
    return (
      window.localStorage.getItem(PLAYER_SESSION_KEY) ||
      window.sessionStorage.getItem(PLAYER_SESSION_KEY)
    );
  } catch {
    return null;
  }
}

export function setStoredPlayerId(playerId) {
  try {
    if (playerId) {
      window.localStorage.setItem(PLAYER_SESSION_KEY, playerId);
      window.sessionStorage.setItem(PLAYER_SESSION_KEY, playerId);
    } else {
      window.localStorage.removeItem(PLAYER_SESSION_KEY);
      window.sessionStorage.removeItem(PLAYER_SESSION_KEY);
    }
  } catch {
    // Ignore storage errors
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

function commitPlayer(updatedPlayer, options = {}) {
  lastMutationAt = Date.now();
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
  postServerAction({
    type: 'UPSERT_PLAYER',
    player: updatedPlayer,
    isNewRegistration: Boolean(options.isNewRegistration),
  });
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

function findPlayerByName(rawName) {
  const normalized = String(rawName || '').trim().toLowerCase();
  if (!normalized) return null;
  return (
    Object.values(currentState.players || {}).find(
      (p) => String(p.name || '').trim().toLowerCase() === normalized
    ) || null
  );
}

export function isPlayerNameTaken(rawName) {
  const existing = findPlayerByName(rawName);
  if (!existing) return false;
  return existing.status !== 'disconnected' && existing.status !== 'left';
}

export function registerPlayer(rawName) {
  const name = rawName.trim().slice(0, 32);
  const now = Date.now();
  const existing = findPlayerByName(name);

  if (existing) {
    if (existing.status === 'disconnected' || existing.status === 'left') {
      const restoredStatus = existing.startTime ? 'active' : 'briefing';
      const allocatedMinutes =
        restoredStatus === 'briefing'
          ? currentState.settings.globalDurationMinutes || DEFAULT_DURATION_MINUTES
          : existing.allocatedMinutes || currentState.settings.globalDurationMinutes || DEFAULT_DURATION_MINUTES;

      const resumed = {
        ...existing,
        status: restoredStatus,
        isDisconnected: false,
        allocatedMinutes,
        remainingSeconds:
          restoredStatus === 'briefing'
            ? allocatedMinutes * 60
            : computeRemainingSeconds(existing, now, allocatedMinutes),
        lastHeartbeat: now,
        lastUpdated: now,
        lastEvent: 'Reconnected to Session',
      };

      setStoredPlayerId(resumed.id);
      commitPlayer(resumed);
      return { ok: true, player: resumed, resumed: true };
    }

    return {
      ok: false,
      error: 'This player name is already taken. Please choose a different callsign.',
    };
  }
  const id = `plr_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const allocatedMinutes =
    currentState.settings.globalDurationMinutes || DEFAULT_DURATION_MINUTES;
  const scoring = getScoringSettings();

  const player = {
    id,
    name,
    currentRoom: 1,
    completedRooms: 0,
    score: 0,
    freeHintsRemaining: scoring.freeHintsCount,
    hintsUsed: 0,
    unlockedHintRooms: [],
    wrongAttempts: 0,
    skippedCount: 0,
    tabSwitches: 0,
    isTabAway: false,
    isDisconnected: false,
    status: 'briefing',
    allocatedMinutes,
    startTime: null,
    endTime: null,
    remainingSeconds: allocatedMinutes * 60,
    completedAt: null,
    createdAt: now,
    lastHeartbeat: now,
    lastUpdated: now,
    lastEvent: 'Joined (Briefing Room)',
  };

  setStoredPlayerId(id);
  commitPlayer(player, { isNewRegistration: true });
  return { ok: true, player };
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

  const scoring = getScoringSettings();

  if (isCorrect) {
    const isFinalRoom = roomId >= TOTAL_ROOMS;
    const nextCompleted = Math.min(TOTAL_ROOMS, Math.max(existing.completedRooms || 0, roomId));
    const nextRoom = isFinalRoom ? TOTAL_ROOMS : roomId + 1;
    const delta = scoring.pointsCorrect;
    const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;

    const updated = {
      ...existing,
      score: existing.score + delta,
      completedRooms: nextCompleted,
      currentRoom: nextRoom,
      status: isFinalRoom ? 'completed' : 'active',
      remainingSeconds: remaining,
      completedAt: isFinalRoom ? now : null,
      lastHeartbeat: now,
      lastUpdated: now,
      lastEvent: isFinalRoom
        ? `Escaped All 50 Rooms (${deltaLabel})`
        : `Cleared Room ${roomId} (${deltaLabel})`,
    };
    return commitPlayer(updated);
  }

  const wrongDelta = scoring.pointsWrong;
  const updated = {
    ...existing,
    score: existing.score + wrongDelta,
    wrongAttempts: (existing.wrongAttempts || 0) + 1,
    remainingSeconds: remaining,
    lastHeartbeat: now,
    lastUpdated: now,
    lastEvent: `Wrong Answer Room ${roomId} (${wrongDelta})`,
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

  const scoring = getScoringSettings();
  const hasFreeHint = existing.freeHintsRemaining > 0;
  const hintDelta = scoring.pointsPaidHint;
  const updated = {
    ...existing,
    freeHintsRemaining: hasFreeHint ? existing.freeHintsRemaining - 1 : 0,
    hintsUsed: (existing.hintsUsed || 0) + 1,
    score: hasFreeHint ? existing.score : existing.score + hintDelta,
    unlockedHintRooms: [...unlocked, roomId],
    remainingSeconds: remaining,
    lastHeartbeat: now,
    lastUpdated: now,
    lastEvent: hasFreeHint
      ? `Used Free Hint Room ${roomId}`
      : `Used Paid Hint Room ${roomId} (${hintDelta})`,
  };

  return commitPlayer(updated);
}

export function skipPlayerRoom(playerId, roomId) {
  const existing = currentState.players[playerId];
  if (!existing || existing.status !== 'active') return null;

  const now = Date.now();
  const remaining = computeRemainingSeconds(existing, now, existing.allocatedMinutes);
  if (remaining <= 0) {
    return markPlayerTimeout(playerId);
  }

  const scoring = getScoringSettings();
  const skipDelta = scoring.pointsSkip;
  const skipLabel = skipDelta > 0 ? `+${skipDelta}` : `${skipDelta}`;
  const isFinalRoom = roomId >= TOTAL_ROOMS;
  const nextRoom = isFinalRoom ? TOTAL_ROOMS : roomId + 1;

  const updated = {
    ...existing,
    score: existing.score + skipDelta,
    currentRoom: nextRoom,
    skippedCount: (existing.skippedCount || 0) + 1,
    status: isFinalRoom ? 'completed' : 'active',
    remainingSeconds: remaining,
    completedAt: isFinalRoom ? now : null,
    lastHeartbeat: now,
    lastUpdated: now,
    lastEvent: isFinalRoom
      ? `Skipped Final Room 50 (${skipLabel} pts)`
      : `Skipped Room ${roomId} (${skipLabel} pts)`,
  };

  return commitPlayer(updated);
}

export function reportPlayerFocusChange(playerId, isAway) {
  const existing = currentState.players[playerId];
  if (!existing || existing.status !== 'active') return null;

  const away = Boolean(isAway);
  if (Boolean(existing.isTabAway) === away) {
    return existing;
  }

  const now = Date.now();
  const nextSwitches = away
    ? (existing.tabSwitches || 0) + 1
    : existing.tabSwitches || 0;

  const updated = {
    ...existing,
    isTabAway: away,
    tabSwitches: nextSwitches,
    lastUpdated: now,
    lastEvent: away
      ? `Left Tab / Window (#${nextSwitches})`
      : 'Returned to Game Tab',
  };

  return commitPlayer(updated);
}

export function sendPlayerHeartbeat(playerId) {
  const existing = currentState.players[playerId];
  if (!existing) return;
  if (existing.status !== 'active' && existing.status !== 'briefing' && existing.status !== 'disconnected') {
    return;
  }

  const now = Date.now();
  if (existing.status === 'disconnected') {
    commitPlayer({
      ...existing,
      status: existing.startTime ? 'active' : 'briefing',
      isDisconnected: false,
      lastHeartbeat: now,
      lastUpdated: now,
      lastEvent: 'Reconnected to Session',
    });
    return;
  }

  // Keep local heartbeat fresh & ping server lightweight endpoint
  currentState = {
    ...currentState,
    players: {
      ...currentState.players,
      [playerId]: {
        ...existing,
        isDisconnected: false,
        lastHeartbeat: now,
      },
    },
  };
  postServerAction({ type: 'HEARTBEAT_PLAYER', playerId });
}

export function markPlayerDisconnected(playerId, reason = 'closed') {
  const existing = currentState.players[playerId];
  if (!existing || (existing.status !== 'active' && existing.status !== 'briefing')) {
    return;
  }

  const now = Date.now();
  const nextStatus = reason === 'left' ? 'left' : 'disconnected';
  const eventLabel = reason === 'left' ? 'Exited Game' : 'Closed Tab / Disconnected';

  const updated = {
    ...existing,
    status: nextStatus,
    isDisconnected: true,
    lastUpdated: now,
    lastEvent: eventLabel,
  };

  const nextState = {
    ...currentState,
    players: {
      ...currentState.players,
      [playerId]: updated,
    },
    revision: currentState.revision + 1,
  };

  lastMutationAt = now;
  currentState = nextState;
  saveLocalState(nextState);
  broadcastLocal(nextState);
  emitChange();

  const payload = JSON.stringify({ type: 'PLAYER_DISCONNECT', playerId, reason });
  if (reason === 'closed' && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/state', blob);
    } catch {
      postServerAction({ type: 'PLAYER_DISCONNECT', playerId, reason });
    }
  } else {
    postServerAction({ type: 'PLAYER_DISCONNECT', playerId, reason });
  }
  pushPlayerToCloudDb(updated);
}

export function updateScoringSettings(newScoring) {
  const now = Date.now();
  const currentScoring = getScoringSettings();
  const nextSettings = {
    ...currentState.settings,
    pointsCorrect:
      newScoring.pointsCorrect !== undefined
        ? Number(newScoring.pointsCorrect)
        : currentScoring.pointsCorrect,
    pointsWrong:
      newScoring.pointsWrong !== undefined
        ? Number(newScoring.pointsWrong)
        : currentScoring.pointsWrong,
    pointsPaidHint:
      newScoring.pointsPaidHint !== undefined
        ? Number(newScoring.pointsPaidHint)
        : currentScoring.pointsPaidHint,
    pointsSkip:
      newScoring.pointsSkip !== undefined
        ? Number(newScoring.pointsSkip)
        : currentScoring.pointsSkip,
    freeHintsCount:
      newScoring.freeHintsCount !== undefined
        ? Math.max(0, Math.min(50, Math.round(Number(newScoring.freeHintsCount))))
        : currentScoring.freeHintsCount,
    updatedAt: now,
  };

  const nextState = {
    ...currentState,
    settings: nextSettings,
    revision: currentState.revision + 1,
  };

  lastMutationAt = now;
  currentState = nextState;
  saveLocalState(nextState);
  broadcastLocal(nextState);
  emitChange();
  postServerAction({
    type: 'UPDATE_SETTINGS',
    settings: nextSettings,
    applyToActive: false,
  });
  pushFullStateToCloudDb(nextState);
}

export function adjustPlayerScore(playerId, delta) {
  const existing = currentState.players[playerId];
  const numericDelta = Math.round(Number(delta));
  if (!existing || !Number.isFinite(numericDelta) || numericDelta === 0) {
    return existing || null;
  }

  const now = Date.now();
  const label = numericDelta > 0 ? `+${numericDelta}` : `${numericDelta}`;
  const updated = {
    ...existing,
    score: (Number(existing.score) || 0) + numericDelta,
    lastUpdated: now,
    lastEvent: `Admin Adjusted Score (${label} pts)`,
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

  lastMutationAt = now;
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

  lastMutationAt = Date.now();
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
  lastMutationAt = now;
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
  lastMutationAt = Date.now();
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
      skippedCount: 0,
      tabSwitches: 0,
      isTabAway: false,
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
      skippedCount: 1,
      tabSwitches: 2,
      isTabAway: false,
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
      skippedCount: 0,
      tabSwitches: 0,
      isTabAway: false,
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
      skippedCount: 3,
      tabSwitches: 4,
      isTabAway: false,
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

  lastMutationAt = now;
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
      let effectiveStatus = p.status === 'active' && liveRemaining === 0 ? 'timeout' : p.status;
      const isDemo = String(p.id || '').startsWith('demo_');
      const lastSeen = p.lastHeartbeat || p.lastUpdated || now;
      if (
        !isDemo &&
        (effectiveStatus === 'active' || effectiveStatus === 'briefing') &&
        now - lastSeen > 18000
      ) {
        effectiveStatus = 'disconnected';
      }
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
