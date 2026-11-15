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
    removedIds: {},
    publicLeaderboard: [],
    playerCount: 0,
    activeCount: 0,
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

function deduplicatePlayersMap(rawPlayers) {
  if (!rawPlayers || typeof rawPlayers !== 'object') return {};
  const byId = {};
  const nameToId = new Map();

  for (const [id, p] of Object.entries(rawPlayers)) {
    if (!p || typeof p !== 'object' || !p.id) continue;
    const normName = String(p.name || '').trim().toLowerCase();
    if (!normName) {
      byId[id] = p;
      continue;
    }
    const prevId = nameToId.get(normName);
    if (!prevId) {
      nameToId.set(normName, id);
      byId[id] = p;
    } else {
      const prev = byId[prevId];
      const prevTs = Number(prev?.lastUpdated || prev?.createdAt || 0);
      const curTs = Number(p.lastUpdated || p.createdAt || 0);
      if (curTs >= prevTs) {
        delete byId[prevId];
        nameToId.set(normName, id);
        byId[id] = p;
      }
    }
  }
  return byId;
}

function loadLocalState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createDefaultState();
    const s = parsed.settings || {};
    const players = deduplicatePlayersMap(
      parsed.players && typeof parsed.players === 'object' ? parsed.players : {}
    );
    return {
      players,
      removedIds:
        parsed.removedIds && typeof parsed.removedIds === 'object' ? parsed.removedIds : {},
      publicLeaderboard: Array.isArray(parsed.publicLeaderboard) ? parsed.publicLeaderboard : [],
      playerCount: Number(parsed.playerCount) || Object.keys(players).length,
      activeCount: Number(parsed.activeCount) || 0,
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
let mutationCounter = 0;
let sessionTerminatedNotice = '';

// Strictly per-tab player session ID so multiple tabs in the same browser never collide
let tabPlayerId = null;
let tabPlayerInitialized = false;

function initTabPlayerId() {
  if (tabPlayerInitialized || typeof window === 'undefined') return tabPlayerId;
  tabPlayerInitialized = true;
  try {
    const fromSession = window.sessionStorage.getItem(PLAYER_SESSION_KEY);
    if (fromSession) {
      tabPlayerId = fromSession;
      return tabPlayerId;
    }

    // Only restore from localStorage if that player was disconnected (tab closed)
    // and is not actively running in another live browser tab
    const fromLocal = window.localStorage.getItem(PLAYER_SESSION_KEY);
    if (fromLocal) {
      const existing = currentState.players?.[fromLocal];
      if (existing) {
        const now = Date.now();
        const lastSeen = existing.lastHeartbeat || existing.lastUpdated || 0;
        const isClosedOrStale =
          existing.status === 'disconnected' ||
          (existing.status !== 'left' &&
            existing.status !== 'completed' &&
            existing.status !== 'timeout' &&
            now - lastSeen > 10000);

        if (isClosedOrStale) {
          tabPlayerId = fromLocal;
          window.sessionStorage.setItem(PLAYER_SESSION_KEY, fromLocal);
          return tabPlayerId;
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  tabPlayerId = null;
  return null;
}

export function getSessionTerminatedNotice() {
  return sessionTerminatedNotice;
}

export function clearSessionTerminatedNotice() {
  sessionTerminatedNotice = '';
  emitChange();
}

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
        removedIds: stateToPush.removedIds || {},
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

function mergeSinglePlayer(localP, incomingP) {
  if (!localP) return incomingP;
  if (!incomingP) return localP;

  const localRun = localP.runId || localP.createdAt || 0;
  const incRun = incomingP.runId || incomingP.createdAt || 0;

  if (incRun !== localRun) {
    return (incomingP.lastUpdated || 0) >= (localP.lastUpdated || 0) ? incomingP : localP;
  }

  const localSeq = Number(localP.clientSeq) || 0;
  const incSeq = Number(incomingP.clientSeq) || 0;
  const newer =
    incSeq > localSeq ||
    (incSeq === localSeq && (incomingP.lastUpdated || 0) >= (localP.lastUpdated || 0))
      ? incomingP
      : localP;
  const older = newer === incomingP ? localP : incomingP;

  const solvedRoomIds = Array.from(
    new Set([...(older.solvedRoomIds || []), ...(newer.solvedRoomIds || [])])
  );
  const unlockedHintRooms = Array.from(
    new Set([...(older.unlockedHintRooms || []), ...(newer.unlockedHintRooms || [])])
  );
  const mergedStartTime = newer.startTime || older.startTime || null;
  let mergedStatus = newer.status;
  if (mergedStartTime && mergedStatus === 'briefing') {
    mergedStatus = older.status === 'briefing' ? 'active' : older.status;
  }

  return {
    ...older,
    ...newer,
    status: mergedStatus,
    startTime: mergedStartTime,
    currentRoom: Math.max(Number(localP.currentRoom) || 1, Number(incomingP.currentRoom) || 1),
    completedRooms: Math.max(
      solvedRoomIds.length,
      Number(localP.completedRooms) || 0,
      Number(incomingP.completedRooms) || 0
    ),
    solvedRoomIds,
    hintsUsed: Math.max(Number(localP.hintsUsed) || 0, Number(incomingP.hintsUsed) || 0),
    wrongAttempts: Math.max(
      Number(localP.wrongAttempts) || 0,
      Number(incomingP.wrongAttempts) || 0
    ),
    skippedCount: Math.max(Number(localP.skippedCount) || 0, Number(incomingP.skippedCount) || 0),
    tabSwitches: Math.max(Number(localP.tabSwitches) || 0, Number(incomingP.tabSwitches) || 0),
    unlockedHintRooms,
    clientSeq: Math.max(localSeq, incSeq),
    lastUpdated: Math.max(Number(localP.lastUpdated) || 0, Number(incomingP.lastUpdated) || 0),
  };
}

function mergeIncomingState(incoming) {
  if (!incoming || typeof incoming !== 'object') return;
  const incomingEpoch = Number(incoming.resetEpoch) || 0;
  const currentEpoch = Number(currentState.resetEpoch) || 0;

  // If incoming state is from a lagging server instance before our latest reset, ignore it
  if (incomingEpoch < currentEpoch) {
    return;
  }

  const myPlayerId = getStoredPlayerId();

  if (incomingEpoch > currentEpoch) {
    // Admin triggered a global reset
    if (myPlayerId && currentState.players[myPlayerId]) {
      sessionTerminatedNotice = 'All player sessions were reset by the Game Administrator.';
      setStoredPlayerId(null);
    }
    const s = incoming.settings || {};
    const next = {
      players: deduplicatePlayersMap(incoming.players || {}),
      removedIds: incoming.removedIds || {},
      publicLeaderboard: Array.isArray(incoming.publicLeaderboard)
        ? incoming.publicLeaderboard
        : [],
      playerCount: Number(incoming.playerCount) || 0,
      activeCount: Number(incoming.activeCount) || 0,
      settings: {
        globalDurationMinutes:
          Number(s.globalDurationMinutes) ||
          currentState.settings?.globalDurationMinutes ||
          DEFAULT_DURATION_MINUTES,
        pointsCorrect:
          s.pointsCorrect !== undefined
            ? Number(s.pointsCorrect)
            : currentState.settings?.pointsCorrect ?? POINTS_CORRECT,
        pointsWrong:
          s.pointsWrong !== undefined
            ? Number(s.pointsWrong)
            : currentState.settings?.pointsWrong ?? POINTS_WRONG,
        pointsPaidHint:
          s.pointsPaidHint !== undefined
            ? Number(s.pointsPaidHint)
            : currentState.settings?.pointsPaidHint ?? POINTS_PAID_HINT,
        pointsSkip:
          s.pointsSkip !== undefined
            ? Number(s.pointsSkip)
            : currentState.settings?.pointsSkip ?? POINTS_SKIP,
        freeHintsCount:
          s.freeHintsCount !== undefined
            ? Number(s.freeHintsCount)
            : currentState.settings?.freeHintsCount ?? INITIAL_FREE_HINTS,
        adminPasswordHash:
          s.adminPasswordHash ||
          currentState.settings?.adminPasswordHash ||
          DEFAULT_ADMIN_PASSWORD,
        updatedAt: Math.max(Number(s.updatedAt) || 0, Number(currentState.settings?.updatedAt) || 0),
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

  const mergedRemovedIds = {
    ...(currentState.removedIds || {}),
    ...(incoming.removedIds || {}),
  };

  if (myPlayerId && mergedRemovedIds[myPlayerId]) {
    const myLocal = currentState.players[myPlayerId];
    if (!myLocal || (myLocal.createdAt || 0) <= Number(mergedRemovedIds[myPlayerId])) {
      sessionTerminatedNotice = 'Your player session was removed by the Game Administrator.';
      setStoredPlayerId(null);
    }
  }

  const incomingPlayers = incoming.players || {};
  const isAdminMode = isAdminAuthenticated();
  let nextPlayers = {};

  if (incoming.fromServer && isAdminMode) {
    // Admin receives full authoritative player list from server
    for (const [id, incP] of Object.entries(incomingPlayers)) {
      if ((incP.createdAt || 0) < currentEpoch) continue;
      if (mergedRemovedIds[id] && (incP.createdAt || 0) <= Number(mergedRemovedIds[id])) continue;
      nextPlayers[id] = mergeSinglePlayer(currentState.players[id], incP);
    }
    // Keep any very recently mutated/created local players (within last 3s) not yet reflected
    const now = Date.now();
    for (const [id, locP] of Object.entries(currentState.players || {})) {
      if (!nextPlayers[id] && !mergedRemovedIds[id] && now - (locP.lastUpdated || 0) < 3000) {
        nextPlayers[id] = locP;
      }
    }
  } else {
    // Non-admin or BroadcastChannel merge: preserve known local players + merge incoming
    for (const [id, locP] of Object.entries(currentState.players || {})) {
      if ((locP.createdAt || 0) < currentEpoch) continue;
      if (mergedRemovedIds[id] && (locP.createdAt || 0) <= Number(mergedRemovedIds[id])) continue;
      nextPlayers[id] = locP;
    }
    for (const [id, incP] of Object.entries(incomingPlayers)) {
      if ((incP.createdAt || 0) < currentEpoch) continue;
      if (mergedRemovedIds[id] && (incP.createdAt || 0) <= Number(mergedRemovedIds[id])) continue;
      nextPlayers[id] = mergeSinglePlayer(nextPlayers[id], incP);
    }
  }

  nextPlayers = deduplicatePlayersMap(nextPlayers);

  // Only accept incoming settings if their updatedAt is >= our local settings updatedAt
  let nextSettings = currentState.settings;
  const incSettingsUpdated = Number(incoming.settings?.updatedAt) || 0;
  const curSettingsUpdated = Number(currentState.settings?.updatedAt) || 0;

  if (incoming.settings && incSettingsUpdated >= curSettingsUpdated) {
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
      updatedAt: incSettingsUpdated,
    };

    // Keep briefing player's allocatedMinutes and freeHints synced with latest settings
    const activeId = getStoredPlayerId();
    if (activeId && nextPlayers[activeId]?.status === 'briefing') {
      nextPlayers[activeId] = {
        ...nextPlayers[activeId],
        allocatedMinutes: nextSettings.globalDurationMinutes,
        remainingSeconds: nextSettings.globalDurationMinutes * 60,
        initialFreeHints: nextSettings.freeHintsCount,
        freeHintsRemaining: nextSettings.freeHintsCount,
      };
    }
  }

  const nextLanUrls = Array.isArray(incoming.lanUrls)
    ? incoming.lanUrls
    : currentState.lanUrls || [];
  const nextPublicLeaderboard = Array.isArray(incoming.publicLeaderboard)
    ? incoming.publicLeaderboard
    : currentState.publicLeaderboard || [];
  const nextPlayerCount =
    incoming.playerCount !== undefined
      ? Number(incoming.playerCount)
      : Object.keys(nextPlayers).length;
  const nextActiveCount =
    incoming.activeCount !== undefined
      ? Number(incoming.activeCount)
      : Object.values(nextPlayers).filter((p) => p.status === 'active').length;

  const prevJson = JSON.stringify({
    p: currentState.players,
    r: currentState.removedIds,
    s: currentState.settings,
    l: currentState.lanUrls,
    lb: currentState.publicLeaderboard,
    pc: currentState.playerCount,
    ac: currentState.activeCount,
    e: currentState.resetEpoch,
  });
  const nextJson = JSON.stringify({
    p: nextPlayers,
    r: mergedRemovedIds,
    s: nextSettings,
    l: nextLanUrls,
    lb: nextPublicLeaderboard,
    pc: nextPlayerCount,
    ac: nextActiveCount,
    e: Math.max(currentEpoch, incomingEpoch),
  });

  if (prevJson !== nextJson) {
    currentState = {
      players: nextPlayers,
      removedIds: mergedRemovedIds,
      publicLeaderboard: nextPublicLeaderboard,
      playerCount: nextPlayerCount,
      activeCount: nextActiveCount,
      settings: nextSettings,
      lanUrls: nextLanUrls,
      revision: Math.max(currentState.revision, Number(incoming.revision) || 1) + 1,
      resetEpoch: Math.max(currentEpoch, incomingEpoch),
    };
    saveLocalState(currentState);
    emitChange();
  }
}

function buildRequestHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-player-id': getStoredPlayerId() || '',
    'x-cipher-admin': isAdminAuthenticated() ? '1' : '0',
  };
}

async function postServerAction(action) {
  inFlightPostCount += 1;
  const mySeq = ++mutationCounter;
  try {
    const payload = {
      ...action,
      _sync: {
        resetEpoch: currentState.resetEpoch || 0,
        removedIds: currentState.removedIds || {},
        settings: currentState.settings,
      },
    };
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: buildRequestHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const serverState = await res.json();
      if (mySeq === mutationCounter) {
        mergeIncomingState({ ...serverState, fromServer: true, fromAction: action.type });
      }
    }
  } catch {
    // Offline or static bundle mode: BroadcastChannel + localStorage + optional Cloud DB still work
  } finally {
    inFlightPostCount = Math.max(0, inFlightPostCount - 1);
  }
}

export async function pollServerState() {
  if (inFlightPostCount > 0 || Date.now() - lastMutationAt < 600) return;
  const mySeqAtStart = mutationCounter;
  try {
    const res = await fetch('/api/state', {
      cache: 'no-store',
      headers: {
        'x-player-id': getStoredPlayerId() || '',
        'x-cipher-admin': isAdminAuthenticated() ? '1' : '0',
      },
    });
    if (res.ok) {
      if (inFlightPostCount > 0 || mySeqAtStart !== mutationCounter) return;
      const serverState = await res.json();
      mergeIncomingState({ ...serverState, fromServer: true });
    }
  } catch {
    // Ignore when running without backend
  }
  if (getCloudDbUrl() && inFlightPostCount === 0 && mySeqAtStart === mutationCounter) {
    pullFromCloudDb();
  }
}

export function initRealtimeStore() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  initTabPlayerId();

  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data?.type === 'STATE_SYNC' && event.data.state) {
        mergeIncomingState(event.data.state);
      } else if (event.data?.type === 'FORCE_REPLACE' && event.data.state) {
        mergeIncomingState(event.data.state);
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
  fetch('/api/state', {
    cache: 'no-store',
    headers: {
      'x-player-id': getStoredPlayerId() || '',
      'x-cipher-admin': isAdminAuthenticated() ? '1' : '0',
    },
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((serverState) => {
      if (!serverState) return;
      mergeIncomingState({ ...serverState, fromServer: true });
    })
    .catch(() => {});

  // Connect to SSE stream only in Vite dev mode
  if (import.meta.env?.DEV && 'EventSource' in window) {
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (event) => {
        if (inFlightPostCount > 0 || Date.now() - lastMutationAt < 600) return;
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
  return initTabPlayerId();
}

export function setStoredPlayerId(playerId) {
  tabPlayerInitialized = true;
  tabPlayerId = playerId || null;
  try {
    if (playerId) {
      window.sessionStorage.setItem(PLAYER_SESSION_KEY, playerId);
      window.localStorage.setItem(PLAYER_SESSION_KEY, playerId);
    } else {
      window.sessionStorage.removeItem(PLAYER_SESSION_KEY);
      if (window.localStorage.getItem(PLAYER_SESSION_KEY) === tabPlayerId || !tabPlayerId) {
        window.localStorage.removeItem(PLAYER_SESSION_KEY);
      }
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
      pollServerState();
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
  lastMutationAt = now;
  currentState = nextState;
  saveLocalState(nextState);
  broadcastLocal(nextState);
  emitChange();
  postServerAction({ type: 'UPDATE_ADMIN_PASSWORD', newPassword: cleaned });
  pushFullStateToCloudDb(nextState);
  return true;
}

function commitPlayer(updatedPlayer, options = {}) {
  const now = Date.now();
  lastMutationAt = now;
  const existing = currentState.players[updatedPlayer.id];
  const playerWithSeq = {
    ...updatedPlayer,
    clientSeq: Math.max(Number(existing?.clientSeq) || 0, Number(updatedPlayer.clientSeq) || 0) + 1,
    lastUpdated: Math.max(now, Number(updatedPlayer.lastUpdated) || 0),
  };

  const nextRemoved = { ...(currentState.removedIds || {}) };
  delete nextRemoved[playerWithSeq.id];

  const nextPlayers = deduplicatePlayersMap({
    ...currentState.players,
    [playerWithSeq.id]: playerWithSeq,
  });

  const nextState = {
    ...currentState,
    players: nextPlayers,
    removedIds: nextRemoved,
    revision: currentState.revision + 1,
  };
  currentState = nextState;
  saveLocalState(nextState);
  broadcastLocal(nextState);
  emitChange();
  postServerAction({
    type: 'UPSERT_PLAYER',
    player: playerWithSeq,
    isNewRegistration: Boolean(options.isNewRegistration),
    isRejoin: Boolean(options.isRejoin),
  });
  pushPlayerToCloudDb(playerWithSeq);
  return playerWithSeq;
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
  if (player.status === 'left' || player.status === 'disconnected') {
    return Math.max(
      0,
      Number(player.pausedRemainingSeconds ?? player.remainingSeconds) ||
        (player.allocatedMinutes || fallbackMinutes) * 60
    );
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
  const matches = Object.values(currentState.players || {}).filter(
    (p) => String(p.name || '').trim().toLowerCase() === normalized
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => (Number(b.lastUpdated) || 0) - (Number(a.lastUpdated) || 0));
  return matches[0];
}

export function isPlayerNameTaken(rawName) {
  const existing = findPlayerByName(rawName);
  if (!existing) return false;
  const now = Date.now();
  const lastSeen = existing.lastHeartbeat || existing.lastUpdated || 0;
  const isLive =
    (existing.status === 'active' || existing.status === 'briefing') &&
    !existing.isDisconnected &&
    now - lastSeen <= 18000;
  return isLive;
}

export function registerPlayer(rawName) {
  const name = rawName.trim().slice(0, 32);
  const now = Date.now();
  sessionTerminatedNotice = '';
  const existing = findPlayerByName(name);
  const allocatedMinutes =
    Number(currentState.settings?.globalDurationMinutes) || DEFAULT_DURATION_MINUTES;
  const scoring = getScoringSettings();

  if (existing) {
    const lastSeen = existing.lastHeartbeat || existing.lastUpdated || 0;
    const isLive =
      (existing.status === 'active' || existing.status === 'briefing') &&
      !existing.isDisconnected &&
      now - lastSeen <= 18000;

    if (isLive) {
      return {
        ok: false,
        error: 'This player name is already taken. Please choose a different callsign.',
      };
    }

    // If previous run was completed or timed out, start a fresh run reusing the same player ID
    if (existing.status === 'completed' || existing.status === 'timeout') {
      const restarted = {
        id: existing.id,
        runId: now,
        name,
        currentRoom: 1,
        completedRooms: 0,
        solvedRoomIds: [],
        score: 0,
        initialFreeHints: scoring.freeHintsCount,
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
        pausedRemainingSeconds: null,
        remainingSeconds: allocatedMinutes * 60,
        completedAt: null,
        createdAt: now,
        lastHeartbeat: now,
        lastUpdated: now,
        clientSeq: (Number(existing.clientSeq) || 0) + 1,
        lastEvent: 'Started New Run (Briefing)',
      };
      setStoredPlayerId(restarted.id);
      commitPlayer(restarted, { isRejoin: true });
      return { ok: true, player: restarted };
    }

    // Otherwise ('left', 'disconnected', or stale), resume their paused/disconnected session!
    const hadStarted =
      Boolean(existing.startTime) ||
      (Number(existing.currentRoom) || 1) > 1 ||
      (Number(existing.completedRooms) || 0) > 0;
    const restoredStatus = hadStarted ? 'active' : 'briefing';
    const effectiveMins =
      restoredStatus === 'briefing'
        ? allocatedMinutes
        : Number(existing.allocatedMinutes) || allocatedMinutes;
    const pausedSec = Math.max(
      1,
      Number(existing.pausedRemainingSeconds ?? existing.remainingSeconds) || effectiveMins * 60
    );

    const resumed = {
      ...existing,
      name,
      status: restoredStatus,
      isDisconnected: false,
      allocatedMinutes: effectiveMins,
      startTime: hadStarted ? existing.startTime || now : null,
      endTime: hadStarted ? now + pausedSec * 1000 : null,
      pausedRemainingSeconds: null,
      remainingSeconds: restoredStatus === 'briefing' ? effectiveMins * 60 : pausedSec,
      initialFreeHints:
        restoredStatus === 'briefing'
          ? scoring.freeHintsCount
          : existing.initialFreeHints ?? scoring.freeHintsCount,
      freeHintsRemaining:
        restoredStatus === 'briefing'
          ? scoring.freeHintsCount
          : existing.freeHintsRemaining ?? scoring.freeHintsCount,
      lastHeartbeat: now,
      lastUpdated: now,
      clientSeq: (Number(existing.clientSeq) || 0) + 1,
      lastEvent: 'Reconnected to Session',
    };

    setStoredPlayerId(resumed.id);
    commitPlayer(resumed, { isRejoin: true });
    return { ok: true, player: resumed, resumed: true };
  }

  const id = `plr_${now}_${Math.random().toString(36).slice(2, 7)}`;
  const player = {
    id,
    runId: now,
    name,
    currentRoom: 1,
    completedRooms: 0,
    solvedRoomIds: [],
    score: 0,
    initialFreeHints: scoring.freeHintsCount,
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
    pausedRemainingSeconds: null,
    remainingSeconds: allocatedMinutes * 60,
    completedAt: null,
    createdAt: now,
    lastHeartbeat: now,
    lastUpdated: now,
    clientSeq: 1,
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
  const mins = Number(currentState.settings?.globalDurationMinutes) || DEFAULT_DURATION_MINUTES;
  const scoring = getScoringSettings();

  // If player already started earlier (e.g. reconnecting), preserve their progress
  const alreadyStarted =
    Boolean(existing.startTime) &&
    ((Number(existing.currentRoom) || 1) > 1 || (Number(existing.completedRooms) || 0) > 0);

  if (alreadyStarted) {
    const remSec = Math.max(
      1,
      Number(existing.pausedRemainingSeconds ?? existing.remainingSeconds) || mins * 60
    );
    const updated = {
      ...existing,
      status: 'active',
      endTime: now + remSec * 1000,
      remainingSeconds: remSec,
      pausedRemainingSeconds: null,
      lastUpdated: now,
      lastEvent: 'Resumed Challenge',
    };
    return commitPlayer(updated, { isRejoin: true });
  }

  const durationMs = mins * 60 * 1000;
  const updated = {
    ...existing,
    status: 'active',
    allocatedMinutes: mins,
    initialFreeHints: scoring.freeHintsCount,
    freeHintsRemaining: scoring.freeHintsCount,
    startTime: now,
    endTime: now + durationMs,
    pausedRemainingSeconds: null,
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
    const prevSolved = Array.isArray(existing.solvedRoomIds) ? existing.solvedRoomIds : [];
    const solvedRoomIds = prevSolved.includes(roomId) ? prevSolved : [...prevSolved, roomId];
    const nextCompleted = Math.min(
      TOTAL_ROOMS,
      Math.max(
        solvedRoomIds.length,
        (Number(existing.completedRooms) || 0) + (prevSolved.includes(roomId) ? 0 : 1)
      )
    );
    const nextRoom = isFinalRoom ? TOTAL_ROOMS : roomId + 1;
    const delta = scoring.pointsCorrect;
    const deltaLabel = delta >= 0 ? `+${delta}` : `${delta}`;

    const updated = {
      ...existing,
      score: existing.score + delta,
      completedRooms: nextCompleted,
      solvedRoomIds,
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
  if (
    existing.status !== 'active' &&
    existing.status !== 'briefing' &&
    existing.status !== 'disconnected'
  ) {
    return;
  }

  const now = Date.now();
  if (existing.status === 'disconnected') {
    const hadStarted = Boolean(existing.startTime);
    const remSec = computeRemainingSeconds(existing, now, existing.allocatedMinutes);
    commitPlayer(
      {
        ...existing,
        status: hadStarted ? 'active' : 'briefing',
        isDisconnected: false,
        endTime: hadStarted ? now + remSec * 1000 : null,
        pausedRemainingSeconds: null,
        lastHeartbeat: now,
        lastUpdated: now,
        lastEvent: 'Reconnected to Session',
      },
      { isRejoin: true }
    );
    return;
  }

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

  // If the player was still in the Briefing Room and clicked "Change Name", remove the unstarted session cleanly
  if (reason === 'left' && existing.status === 'briefing' && !existing.startTime) {
    removePlayerSession(playerId);
    return;
  }

  const now = Date.now();
  const remSec = computeRemainingSeconds(existing, now, existing.allocatedMinutes);
  const nextStatus = reason === 'left' ? 'left' : 'disconnected';
  const eventLabel = reason === 'left' ? 'Exited Game (Paused)' : 'Closed Tab / Disconnected';

  const updated = {
    ...existing,
    status: nextStatus,
    isDisconnected: true,
    pausedRemainingSeconds: remSec,
    remainingSeconds: remSec,
    clientSeq: (Number(existing.clientSeq) || 0) + 1,
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

  const payload = JSON.stringify({
    type: 'PLAYER_DISCONNECT',
    playerId,
    reason,
    _sync: {
      resetEpoch: currentState.resetEpoch || 0,
      removedIds: currentState.removedIds || {},
      settings: currentState.settings,
    },
  });
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
  const nextFreeHints =
    newScoring.freeHintsCount !== undefined
      ? Math.max(0, Math.min(50, Math.round(Number(newScoring.freeHintsCount))))
      : currentScoring.freeHintsCount;

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
    freeHintsCount: nextFreeHints,
    updatedAt: now,
  };

  const nextPlayers = { ...currentState.players };
  for (const [id, p] of Object.entries(nextPlayers)) {
    const usedFree = Math.min(
      Number(p.hintsUsed) || 0,
      Number(p.initialFreeHints ?? currentScoring.freeHintsCount) || 0
    );
    nextPlayers[id] = {
      ...p,
      initialFreeHints: nextFreeHints,
      freeHintsRemaining:
        p.status === 'briefing' ? nextFreeHints : Math.max(0, nextFreeHints - usedFree),
      lastUpdated: now,
    };
  }

  const nextState = {
    ...currentState,
    players: nextPlayers,
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
          clientSeq: (Number(p.clientSeq) || 0) + 1,
          lastUpdated: now,
          lastEvent: `Timer Set to ${clamped}m`,
        };
      } else if (p.status === 'briefing') {
        nextPlayers[id] = {
          ...p,
          allocatedMinutes: clamped,
          remainingSeconds: clamped * 60,
          clientSeq: (Number(p.clientSeq) || 0) + 1,
          lastUpdated: now,
        };
      }
    }
  } else {
    for (const [id, p] of Object.entries(nextPlayers)) {
      if (p.status === 'briefing') {
        nextPlayers[id] = {
          ...p,
          allocatedMinutes: clamped,
          remainingSeconds: clamped * 60,
          clientSeq: (Number(p.clientSeq) || 0) + 1,
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
  if (!playerId) return;
  const now = Date.now();
  const nextPlayers = { ...currentState.players };
  delete nextPlayers[playerId];
  const nextRemoved = { ...(currentState.removedIds || {}), [playerId]: now };

  if (getStoredPlayerId() === playerId) {
    setStoredPlayerId(null);
  }

  const nextState = {
    ...currentState,
    players: nextPlayers,
    removedIds: nextRemoved,
    playerCount: Object.keys(nextPlayers).length,
    activeCount: Object.values(nextPlayers).filter((p) => p.status === 'active').length,
    publicLeaderboard: (currentState.publicLeaderboard || []).filter(
      (entry) => entry.name !== currentState.players?.[playerId]?.name
    ),
    revision: currentState.revision + 1,
  };

  lastMutationAt = now;
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
  const nextEpoch = Math.max(now, (Number(currentState.resetEpoch) || 0) + 1);
  lastMutationAt = now;

  const nextState = {
    players: {},
    removedIds: {},
    publicLeaderboard: [],
    playerCount: 0,
    activeCount: 0,
    settings: {
      ...currentState.settings,
      updatedAt: Math.max(now, Number(currentState.settings?.updatedAt) || 0),
    },
    lanUrls: currentState.lanUrls || [],
    revision: currentState.revision + 1,
    resetEpoch: nextEpoch,
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
  postServerAction({ type: 'RESET_ALL', resetEpoch: nextEpoch });
  pushFullStateToCloudDb(nextState);
}

export function seedDemoPlayers() {
  const now = Date.now();
  const mins = currentState.settings.globalDurationMinutes || DEFAULT_DURATION_MINUTES;
  const scoring = getScoringSettings();
  const totalMs = mins * 60 * 1000;

  const demos = {
    demo_ada: {
      id: 'demo_ada',
      runId: now,
      name: 'Ada_Lovelace',
      currentRoom: 50,
      completedRooms: 50,
      score: 4925,
      initialFreeHints: scoring.freeHintsCount,
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
      createdAt: now,
      lastUpdated: now,
      clientSeq: 1,
      lastEvent: 'Escaped All 50 Rooms (+100)',
    },
    demo_linus: {
      id: 'demo_linus',
      runId: now,
      name: 'Kernel_Linus',
      currentRoom: 36,
      completedRooms: 35,
      score: 3375,
      initialFreeHints: scoring.freeHintsCount,
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
      createdAt: now,
      lastUpdated: now,
      clientSeq: 1,
      lastEvent: 'Cleared Room 35 (+100)',
    },
    demo_grace: {
      id: 'demo_grace',
      runId: now,
      name: 'Grace_Hopper',
      currentRoom: 22,
      completedRooms: 21,
      score: 2050,
      initialFreeHints: scoring.freeHintsCount,
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
      createdAt: now,
      lastUpdated: now,
      clientSeq: 1,
      lastEvent: 'Cleared Room 21 (+100)',
    },
    demo_zero: {
      id: 'demo_zero',
      runId: now,
      name: 'NullPointer99',
      currentRoom: 12,
      completedRooms: 11,
      score: 975,
      initialFreeHints: scoring.freeHintsCount,
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
      createdAt: now,
      lastUpdated: now,
      clientSeq: 1,
      lastEvent: 'Timer Expired',
    },
  };

  const nextRemoved = { ...(currentState.removedIds || {}) };
  for (const id of Object.keys(demos)) {
    delete nextRemoved[id];
  }

  const nextState = {
    ...currentState,
    players: deduplicatePlayersMap({
      ...currentState.players,
      ...demos,
    }),
    removedIds: nextRemoved,
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
  const players = Object.values(deduplicatePlayersMap(state?.players || {}));
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
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
}
