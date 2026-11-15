import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DB_FILE_PATH = path.resolve(process.cwd(), '.escape-room-db.json');

function getLanUrls(port = 5173) {
  const urls = [];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          urls.push(`http://${iface.address}:${port}`);
        }
      }
    }
  } catch {
    // Ignore OS interface lookup errors
  }
  return urls;
}

function createInitialState() {
  return {
    players: {},
    removedIds: {},
    settings: {
      globalDurationMinutes: 60,
      pointsCorrect: 100,
      pointsWrong: -25,
      pointsPaidHint: -50,
      pointsSkip: 0,
      freeHintsCount: 3,
      adminPasswordHash: 'admin123',
      isPaused: false,
      pausedAt: null,
      updatedAt: 0,
    },
    revision: 1,
    resetEpoch: 0,
  };
}

function loadPersistedState() {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const s = parsed.settings || {};
        return {
          players: parsed.players && typeof parsed.players === 'object' ? parsed.players : {},
          removedIds:
            parsed.removedIds && typeof parsed.removedIds === 'object' ? parsed.removedIds : {},
          settings: {
            globalDurationMinutes: Number(s.globalDurationMinutes) || 60,
            pointsCorrect: s.pointsCorrect !== undefined ? Number(s.pointsCorrect) : 100,
            pointsWrong: s.pointsWrong !== undefined ? Number(s.pointsWrong) : -25,
            pointsPaidHint: s.pointsPaidHint !== undefined ? Number(s.pointsPaidHint) : -50,
            pointsSkip: s.pointsSkip !== undefined ? Number(s.pointsSkip) : 0,
            freeHintsCount: s.freeHintsCount !== undefined ? Number(s.freeHintsCount) : 3,
            adminPasswordHash: s.adminPasswordHash || 'admin123',
            isPaused: Boolean(s.isPaused),
            pausedAt: s.isPaused ? Number(s.pausedAt) || null : null,
            updatedAt: Number(s.updatedAt) || 0,
          },
          revision: Number(parsed.revision) || 1,
          resetEpoch: Number(parsed.resetEpoch) || 0,
        };
      }
    }
  } catch {
    // Fall back to fresh state if file is unreadable
  }
  return createInitialState();
}

function savePersistedState(state) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Ignore disk write errors
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function mergePlayerOnServer(existing, incoming, now = Date.now()) {
  if (!existing) return incoming;
  if (!incoming) return existing;

  const existingRun = existing.runId || existing.createdAt || 0;
  const incomingRun = incoming.runId || incoming.createdAt || 0;
  if (existingRun !== incomingRun) {
    return (incoming.lastUpdated || 0) >= (existing.lastUpdated || 0) ? incoming : existing;
  }

  const existingSeq = Number(existing.clientSeq) || 0;
  const incomingSeq = Number(incoming.clientSeq) || 0;
  const newer =
    incomingSeq > existingSeq ||
    (incomingSeq === existingSeq && (incoming.lastUpdated || 0) >= (existing.lastUpdated || 0))
      ? incoming
      : existing;
  const older = newer === incoming ? existing : incoming;

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
    currentRoom: Math.max(Number(existing.currentRoom) || 1, Number(incoming.currentRoom) || 1),
    completedRooms: Math.max(
      solvedRoomIds.length,
      Number(existing.completedRooms) || 0,
      Number(incoming.completedRooms) || 0
    ),
    solvedRoomIds,
    hintsUsed: Math.max(Number(existing.hintsUsed) || 0, Number(incoming.hintsUsed) || 0),
    wrongAttempts: Math.max(
      Number(existing.wrongAttempts) || 0,
      Number(incoming.wrongAttempts) || 0
    ),
    skippedCount: Math.max(Number(existing.skippedCount) || 0, Number(incoming.skippedCount) || 0),
    tabSwitches: Math.max(Number(existing.tabSwitches) || 0, Number(incoming.tabSwitches) || 0),
    unlockedHintRooms,
    clientSeq: Math.max(existingSeq, incomingSeq),
    lastHeartbeat: Math.max(
      now,
      Number(existing.lastHeartbeat) || 0,
      Number(incoming.lastHeartbeat) || 0
    ),
    lastUpdated: Math.max(Number(existing.lastUpdated) || 0, Number(incoming.lastUpdated) || 0),
  };
}

function buildPublicLeaderboard(state, now = Date.now()) {
  const players = Object.values(state?.players || {});
  const fallbackMins = state?.settings?.globalDurationMinutes || 60;
  const isGloballyPaused = Boolean(state?.settings?.isPaused);
  return players
    .map((p) => {
      let liveRemaining = fallbackMins * 60;
      if (p.status === 'briefing') {
        liveRemaining = (p.allocatedMinutes || fallbackMins) * 60;
      } else if (
        p.status === 'completed' ||
        p.status === 'timeout' ||
        p.status === 'left' ||
        p.status === 'disconnected' ||
        p.isTimerPaused ||
        isGloballyPaused
      ) {
        if (p.pausedRemainingSeconds !== null && p.pausedRemainingSeconds !== undefined) {
          liveRemaining = Math.max(0, Number(p.pausedRemainingSeconds) || 0);
        } else if (p.endTime) {
          const freezeAt = state?.settings?.pausedAt || now;
          liveRemaining = Math.max(0, Math.ceil((p.endTime - freezeAt) / 1000));
        } else {
          liveRemaining = Math.max(
            0,
            Number(p.remainingSeconds) || (p.allocatedMinutes || fallbackMins) * 60
          );
        }
      } else if (p.endTime) {
        liveRemaining = Math.max(0, Math.ceil((p.endTime - now) / 1000));
      }
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
        name: p.name,
        score: Number(p.score) || 0,
        completedRooms: Number(p.completedRooms) || 0,
        currentRoom: Number(p.currentRoom) || 1,
        skippedCount: Number(p.skippedCount) || 0,
        hintsUsed: Number(p.hintsUsed) || 0,
        wrongAttempts: Number(p.wrongAttempts) || 0,
        liveRemainingSeconds: liveRemaining,
        isTimerPaused: Boolean(isGloballyPaused || p.isTimerPaused),
        effectiveStatus,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.completedRooms !== a.completedRooms) return b.completedRooms - a.completedRooms;
      if (b.currentRoom !== a.currentRoom) return b.currentRoom - a.currentRoom;
      if (b.liveRemainingSeconds !== a.liveRemainingSeconds) {
        return b.liveRemainingSeconds - a.liveRemainingSeconds;
      }
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
}

function buildClientPayload(state, req, extra = {}) {
  const now = Date.now();
  const isAdmin = req?.headers?.['x-cipher-admin'] === '1';
  const reqPlayerId = String(req?.headers?.['x-player-id'] || extra.playerId || '').trim();
  const allPlayers = Object.values(state.players || {});
  const activeCount = allPlayers.filter((p) => p.status === 'active').length;

  const { adminPasswordHash, ...publicSettings } = state.settings || {};

  let visiblePlayers = {};
  if (isAdmin) {
    visiblePlayers = state.players || {};
  } else if (reqPlayerId && state.players?.[reqPlayerId]) {
    visiblePlayers = { [reqPlayerId]: state.players[reqPlayerId] };
  }

  return {
    players: visiblePlayers,
    removedIds: state.removedIds || {},
    settings: publicSettings,
    revision: state.revision || 1,
    resetEpoch: state.resetEpoch || 0,
    playerCount: allPlayers.length,
    activeCount,
    publicLeaderboard: buildPublicLeaderboard(state, now),
    serverTime: now,
    lanUrls: getLanUrls(5173),
    ...extra,
  };
}

function applyClientSyncMeta(state, syncMeta) {
  if (!syncMeta || typeof syncMeta !== 'object') return { state, changed: false };
  let next = state;
  let changed = false;

  const incomingEpoch = Number(syncMeta.resetEpoch) || 0;
  if (incomingEpoch > (next.resetEpoch || 0)) {
    const survivingPlayers = {};
    for (const [id, p] of Object.entries(next.players || {})) {
      if ((p.createdAt || 0) >= incomingEpoch) {
        survivingPlayers[id] = p;
      }
    }
    next = {
      ...next,
      players: survivingPlayers,
      removedIds: {},
      resetEpoch: incomingEpoch,
    };
    changed = true;
  }

  if (syncMeta.removedIds && typeof syncMeta.removedIds === 'object') {
    for (const [remId, remAt] of Object.entries(syncMeta.removedIds)) {
      if (!next.removedIds?.[remId] || Number(remAt) > Number(next.removedIds[remId])) {
        next.removedIds = { ...(next.removedIds || {}), [remId]: Number(remAt) };
        changed = true;
      }
      const existing = next.players?.[remId];
      if (existing && (existing.createdAt || 0) <= Number(remAt)) {
        delete next.players[remId];
        changed = true;
      }
    }
  }

  const incSettings = syncMeta.settings;
  if (
    incSettings &&
    typeof incSettings === 'object' &&
    Number(incSettings.updatedAt || 0) > Number(next.settings?.updatedAt || 0)
  ) {
    next.settings = {
      ...next.settings,
      globalDurationMinutes:
        Number(incSettings.globalDurationMinutes) || next.settings.globalDurationMinutes || 60,
      pointsCorrect:
        incSettings.pointsCorrect !== undefined
          ? Number(incSettings.pointsCorrect)
          : next.settings.pointsCorrect,
      pointsWrong:
        incSettings.pointsWrong !== undefined
          ? Number(incSettings.pointsWrong)
          : next.settings.pointsWrong,
      pointsPaidHint:
        incSettings.pointsPaidHint !== undefined
          ? Number(incSettings.pointsPaidHint)
          : next.settings.pointsPaidHint,
      pointsSkip:
        incSettings.pointsSkip !== undefined
          ? Number(incSettings.pointsSkip)
          : next.settings.pointsSkip,
      freeHintsCount:
        incSettings.freeHintsCount !== undefined
          ? Number(incSettings.freeHintsCount)
          : next.settings.freeHintsCount,
      isPaused:
        incSettings.isPaused !== undefined
          ? Boolean(incSettings.isPaused)
          : Boolean(next.settings.isPaused),
      pausedAt:
        (incSettings.isPaused !== undefined
          ? Boolean(incSettings.isPaused)
          : Boolean(next.settings.isPaused))
          ? Number(incSettings.pausedAt) || next.settings.pausedAt || Date.now()
          : null,
      updatedAt: Number(incSettings.updatedAt),
    };
    changed = true;
  }

  const syncPlayer = syncMeta.player;
  if (
    syncPlayer &&
    typeof syncPlayer === 'object' &&
    syncPlayer.id &&
    (syncPlayer.createdAt || 0) >= (next.resetEpoch || 0) &&
    !next.removedIds?.[syncPlayer.id]
  ) {
    const existing = next.players?.[syncPlayer.id];
    if (
      !existing ||
      (Number(syncPlayer.clientSeq) || 0) > (Number(existing.clientSeq) || 0) ||
      (Number(syncPlayer.lastUpdated) || 0) > (Number(existing.lastUpdated) || 0)
    ) {
      next.players = {
        ...(next.players || {}),
        [syncPlayer.id]: mergePlayerOnServer(existing, syncPlayer),
      };
      changed = true;
    }
  }

  return { state: next, changed };
}

function extractHeaderSyncMeta(req) {
  if (!req?.headers) return null;
  const meta = {};
  const epochHdr = req.headers['x-reset-epoch'];
  if (epochHdr) {
    meta.resetEpoch = Number(epochHdr) || 0;
  }
  const settingsHdr = req.headers['x-settings-sync'];
  if (settingsHdr) {
    try {
      meta.settings = JSON.parse(decodeURIComponent(settingsHdr));
    } catch {
      // ignore malformed header
    }
  }
  const playerHdr = req.headers['x-player-sync'];
  if (playerHdr) {
    try {
      meta.player = JSON.parse(decodeURIComponent(playerHdr));
    } catch {
      // ignore malformed header
    }
  }
  return Object.keys(meta).length > 0 ? meta : null;
}

function escapeStateApiPlugin() {
  let state = loadPersistedState();
  const sseClients = new Set();

  function broadcastState() {
    savePersistedState(state);
    for (const client of sseClients) {
      try {
        const payload = `data: ${JSON.stringify(buildClientPayload(state, client.req))}\n\n`;
        client.res.write(payload);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  return {
    name: 'escape-room-realtime-api',
    configureServer(server) {
      server.middlewares.use('/api/events', (req, res, next) => {
        if (req.method !== 'GET') return next();
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        const client = { req, res };
        res.write(`data: ${JSON.stringify(buildClientPayload(state, req))}\n\n`);
        sseClients.add(client);
        req.on('close', () => {
          sseClients.delete(client);
        });
      });

      server.middlewares.use('/api/state', async (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, x-player-id, x-cipher-admin, x-reset-epoch, x-settings-sync, x-player-sync'
        );

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        const hdrSync = extractHeaderSyncMeta(req);
        if (hdrSync) {
          const synced = applyClientSyncMeta(state, hdrSync);
          state = synced.state;
          if (synced.changed && req.method === 'GET') {
            savePersistedState(state);
          }
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(buildClientPayload(state, req)));
          return;
        }

        if (req.method === 'POST') {
          try {
            const action = await readJsonBody(req);
            const now = Date.now();

            const bodySynced = applyClientSyncMeta(state, action._sync);
            state = bodySynced.state;

            if (action.type === 'VERIFY_ADMIN') {
              const expected = state.settings?.adminPasswordHash || 'admin123';
              const ok = String(action.password || '').trim() === expected;
              res.statusCode = ok ? 200 : 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok }));
              return;
            }

            let targetPlayerId = action.player?.id || action.playerId;
            let resumedPlayerId = null;

            if (action.type === 'UPSERT_PLAYER' && action.player?.id) {
              const p = action.player;
              if ((p.createdAt || 0) > 0 && (p.createdAt || 0) < (state.resetEpoch || 0)) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(buildClientPayload(state, req)));
                return;
              }
              if (state.removedIds?.[p.id] && !action.isNewRegistration && !action.isRejoin) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(buildClientPayload(state, req)));
                return;
              }

              if (action.replacingPlayerId && state.players[action.replacingPlayerId]) {
                delete state.players[action.replacingPlayerId];
              }

              const incomingName = String(p.name || '').trim().toLowerCase();
              const existingByName = incomingName
                ? Object.values(state.players).find(
                    (other) => String(other.name || '').trim().toLowerCase() === incomingName
                  )
                : null;

              const configuredMins = Number(state.settings?.globalDurationMinutes) || 60;
              const configuredFreeHints =
                state.settings?.freeHintsCount !== undefined
                  ? Number(state.settings.freeHintsCount)
                  : 3;

              if (existingByName && existingByName.id !== p.id) {
                const lastSeen = existingByName.lastHeartbeat || existingByName.lastUpdated || 0;
                const isLive =
                  (existingByName.status === 'active' || existingByName.status === 'briefing') &&
                  !existingByName.isDisconnected &&
                  now - lastSeen <= 18000;

                if (action.isNewRegistration && isLive) {
                  res.statusCode = 409;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      error: 'This player name is already taken. Please choose a different callsign.',
                    })
                  );
                  return;
                }

                if (
                  existingByName.status === 'left' ||
                  existingByName.status === 'disconnected' ||
                  (!isLive &&
                    (existingByName.status === 'active' || existingByName.status === 'briefing'))
                ) {
                  const hadStarted =
                    Boolean(existingByName.startTime) ||
                    (Number(existingByName.currentRoom) || 1) > 1 ||
                    (Number(existingByName.completedRooms) || 0) > 0;
                  const restoredStatus = hadStarted ? 'active' : 'briefing';
                  const effectiveMins =
                    restoredStatus === 'briefing'
                      ? configuredMins
                      : Number(existingByName.allocatedMinutes) || configuredMins;
                  const pausedSec = Math.max(
                    1,
                    Number(
                      existingByName.pausedRemainingSeconds ?? existingByName.remainingSeconds
                    ) || effectiveMins * 60
                  );
                  const globallyPaused = Boolean(state.settings?.isPaused);

                  const resumed = {
                    ...existingByName,
                    status: restoredStatus,
                    isDisconnected: false,
                    isTimerPaused: hadStarted ? globallyPaused : false,
                    allocatedMinutes: effectiveMins,
                    startTime: hadStarted ? existingByName.startTime || now : null,
                    endTime: hadStarted && !globallyPaused ? now + pausedSec * 1000 : null,
                    pausedRemainingSeconds: hadStarted && globallyPaused ? pausedSec : null,
                    remainingSeconds:
                      restoredStatus === 'briefing' ? effectiveMins * 60 : pausedSec,
                    lastHeartbeat: now,
                    lastUpdated: now,
                    clientSeq: (Number(existingByName.clientSeq) || 0) + 1,
                    lastEvent: 'Reconnected to Session',
                  };
                  delete state.removedIds?.[existingByName.id];
                  state.players[existingByName.id] = resumed;
                  targetPlayerId = existingByName.id;
                  resumedPlayerId = existingByName.id;
                } else {
                  const restarted = {
                    ...p,
                    id: existingByName.id,
                    runId: now,
                    status: 'briefing',
                    currentRoom: 1,
                    completedRooms: 0,
                    solvedRoomIds: [],
                    score: 0,
                    initialFreeHints: configuredFreeHints,
                    freeHintsRemaining: configuredFreeHints,
                    hintsUsed: 0,
                    unlockedHintRooms: [],
                    wrongAttempts: 0,
                    skippedCount: 0,
                    tabSwitches: 0,
                    isTabAway: false,
                    isDisconnected: false,
                    allocatedMinutes: configuredMins,
                    startTime: null,
                    endTime: null,
                    pausedRemainingSeconds: null,
                    remainingSeconds: configuredMins * 60,
                    completedAt: null,
                    createdAt: now,
                    lastHeartbeat: now,
                    lastUpdated: now,
                    clientSeq: (Number(existingByName.clientSeq) || 0) + 1,
                    lastEvent: 'Started New Run (Briefing)',
                  };
                  delete state.removedIds?.[existingByName.id];
                  state.players[existingByName.id] = restarted;
                  targetPlayerId = existingByName.id;
                  resumedPlayerId = existingByName.id;
                }
              } else {
                delete state.removedIds[p.id];
                const existing = state.players[p.id];
                let nextPlayer = mergePlayerOnServer(existing, p, now);

                if (nextPlayer.status === 'briefing' && !nextPlayer.startTime) {
                  nextPlayer.allocatedMinutes = configuredMins;
                  nextPlayer.remainingSeconds = configuredMins * 60;
                  nextPlayer.initialFreeHints = configuredFreeHints;
                  nextPlayer.freeHintsRemaining = configuredFreeHints;
                } else if (
                  nextPlayer.status === 'active' &&
                  (!existing || existing.status === 'briefing') &&
                  !action.isRejoin
                ) {
                  const globallyPaused = Boolean(state.settings?.isPaused);
                  nextPlayer.allocatedMinutes = configuredMins;
                  const startTs = nextPlayer.startTime || now;
                  nextPlayer.startTime = startTs;
                  nextPlayer.isTimerPaused = globallyPaused;
                  nextPlayer.endTime = globallyPaused ? null : startTs + configuredMins * 60 * 1000;
                  nextPlayer.pausedRemainingSeconds = globallyPaused ? configuredMins * 60 : null;
                  nextPlayer.remainingSeconds = configuredMins * 60;
                  nextPlayer.initialFreeHints = configuredFreeHints;
                  if (existing?.status === 'briefing') {
                    nextPlayer.freeHintsRemaining = configuredFreeHints;
                  }
                }

                state.players[p.id] = {
                  ...nextPlayer,
                  lastHeartbeat: now,
                  lastUpdated: Math.max(now, Number(p.lastUpdated) || 0),
                };
              }
            } else if (action.type === 'HEARTBEAT_PLAYER' && action.playerId) {
              if (!state.removedIds?.[action.playerId]) {
                const cur = state.players[action.playerId];
                if (
                  cur &&
                  (cur.createdAt || 0) >= (state.resetEpoch || 0) &&
                  (cur.status === 'active' ||
                    cur.status === 'briefing' ||
                    cur.status === 'disconnected')
                ) {
                  state.players[action.playerId] = {
                    ...cur,
                    status:
                      cur.status === 'disconnected'
                        ? cur.startTime
                          ? 'active'
                          : 'briefing'
                        : cur.status,
                    isDisconnected: false,
                    lastHeartbeat: now,
                  };
                }
              }
            } else if (action.type === 'PLAYER_DISCONNECT' && action.playerId) {
              const cur = state.players[action.playerId];
              if (cur && (cur.status === 'active' || cur.status === 'briefing')) {
                if (action.reason === 'left' && cur.status === 'briefing' && !cur.startTime) {
                  delete state.players[action.playerId];
                } else {
                  const fallbackMins = state.settings?.globalDurationMinutes || 60;
                  const rem =
                    cur.isTimerPaused || state.settings?.isPaused
                      ? Math.max(
                          0,
                          Number(cur.pausedRemainingSeconds ?? cur.remainingSeconds) ||
                            (cur.allocatedMinutes || fallbackMins) * 60
                        )
                      : cur.endTime
                      ? Math.max(0, Math.ceil((cur.endTime - now) / 1000))
                      : Number(cur.remainingSeconds ?? fallbackMins * 60);
                  state.players[action.playerId] = {
                    ...cur,
                    status: action.reason === 'left' ? 'left' : 'disconnected',
                    isDisconnected: true,
                    pausedRemainingSeconds: rem,
                    remainingSeconds: rem,
                    lastUpdated: now,
                    lastEvent:
                      action.reason === 'left'
                        ? 'Exited Game (Paused)'
                        : 'Closed Tab / Disconnected',
                  };
                }
              }
            } else if (action.type === 'REMOVE_PLAYER' && action.playerId) {
              delete state.players[action.playerId];
              state.removedIds = { ...(state.removedIds || {}), [action.playerId]: now };
            } else if (action.type === 'UPDATE_SETTINGS' && action.settings) {
              const s = action.settings;
              const mins = Math.max(
                1,
                Math.min(
                  240,
                  Number(s.globalDurationMinutes) || state.settings.globalDurationMinutes || 60
                )
              );
              const freeHintsCount =
                s.freeHintsCount !== undefined
                  ? Math.max(0, Math.min(50, Number(s.freeHintsCount)))
                  : state.settings.freeHintsCount;

              state.settings = {
                ...state.settings,
                globalDurationMinutes: mins,
                pointsCorrect:
                  s.pointsCorrect !== undefined
                    ? Number(s.pointsCorrect)
                    : state.settings.pointsCorrect,
                pointsWrong:
                  s.pointsWrong !== undefined
                    ? Number(s.pointsWrong)
                    : state.settings.pointsWrong,
                pointsPaidHint:
                  s.pointsPaidHint !== undefined
                    ? Number(s.pointsPaidHint)
                    : state.settings.pointsPaidHint,
                pointsSkip:
                  s.pointsSkip !== undefined ? Number(s.pointsSkip) : state.settings.pointsSkip,
                freeHintsCount,
                adminPasswordHash:
                  s.adminPasswordHash || state.settings.adminPasswordHash || 'admin123',
                updatedAt: Math.max(now, Number(s.updatedAt) || 0),
              };

              for (const id of Object.keys(state.players)) {
                const p = state.players[id];
                const usedFree = Math.min(
                  Number(p.hintsUsed) || 0,
                  Number(p.initialFreeHints ?? state.settings.freeHintsCount) || 0
                );
                const updatedFreeRemaining = Math.max(0, freeHintsCount - usedFree);

                if (
                  action.applyToActive &&
                  p.status === 'active' &&
                  (state.settings?.isPaused || p.isTimerPaused)
                ) {
                  const oldRem =
                    p.pausedRemainingSeconds !== null && p.pausedRemainingSeconds !== undefined
                      ? Math.max(0, Number(p.pausedRemainingSeconds) || 0)
                      : p.endTime
                      ? Math.max(
                          0,
                          Math.ceil((p.endTime - (state.settings?.pausedAt || now)) / 1000)
                        )
                      : Math.max(0, Number(p.remainingSeconds) || (p.allocatedMinutes || 60) * 60);
                  const oldTotal = (Number(p.allocatedMinutes) || 60) * 60;
                  const elapsed = Math.max(0, oldTotal - oldRem);
                  const newRemaining = Math.max(0, mins * 60 - elapsed);
                  state.players[id] = {
                    ...p,
                    allocatedMinutes: mins,
                    endTime: null,
                    isTimerPaused: true,
                    pausedRemainingSeconds: newRemaining,
                    remainingSeconds: newRemaining,
                    initialFreeHints: freeHintsCount,
                    freeHintsRemaining: updatedFreeRemaining,
                    status: newRemaining === 0 ? 'timeout' : 'active',
                    lastUpdated: now,
                  };
                } else if (action.applyToActive && p.status === 'active' && p.startTime) {
                  const newEndTime = p.startTime + mins * 60 * 1000;
                  const newRemaining = Math.max(0, Math.ceil((newEndTime - now) / 1000));
                  state.players[id] = {
                    ...p,
                    allocatedMinutes: mins,
                    endTime: newEndTime,
                    remainingSeconds: newRemaining,
                    initialFreeHints: freeHintsCount,
                    freeHintsRemaining: updatedFreeRemaining,
                    status: newRemaining === 0 ? 'timeout' : 'active',
                    lastUpdated: now,
                  };
                } else if (p.status === 'briefing') {
                  state.players[id] = {
                    ...p,
                    allocatedMinutes: action.applyToActive ? mins : p.allocatedMinutes || mins,
                    remainingSeconds: (action.applyToActive ? mins : p.allocatedMinutes || mins) * 60,
                    initialFreeHints: freeHintsCount,
                    freeHintsRemaining: freeHintsCount,
                    lastUpdated: now,
                  };
                } else {
                  state.players[id] = {
                    ...p,
                    initialFreeHints: freeHintsCount,
                    freeHintsRemaining: updatedFreeRemaining,
                  };
                }
              }
            } else if (action.type === 'TOGGLE_GLOBAL_PAUSE') {
              const nextPaused =
                typeof action.isPaused === 'boolean'
                  ? action.isPaused
                  : !Boolean(state.settings?.isPaused);
              const fallbackMins = Number(state.settings?.globalDurationMinutes) || 60;
              const pauseTs = nextPaused ? Number(action.pausedAt) || now : null;
              state.settings = {
                ...state.settings,
                isPaused: nextPaused,
                pausedAt: pauseTs,
                updatedAt: Math.max(now, Number(action._sync?.settings?.updatedAt) || 0),
              };
              for (const id of Object.keys(state.players)) {
                const p = state.players[id];
                if (p.status !== 'active') continue;
                if (nextPaused) {
                  const rem =
                    p.pausedRemainingSeconds !== null && p.pausedRemainingSeconds !== undefined
                      ? Math.max(0, Number(p.pausedRemainingSeconds) || 0)
                      : p.endTime
                      ? Math.max(0, Math.ceil((p.endTime - now) / 1000))
                      : Math.max(
                          0,
                          Number(p.remainingSeconds) || (p.allocatedMinutes || fallbackMins) * 60
                        );
                  state.players[id] = {
                    ...p,
                    isTimerPaused: true,
                    endTime: null,
                    pausedRemainingSeconds: rem,
                    remainingSeconds: rem,
                    clientSeq: (Number(p.clientSeq) || 0) + 1,
                    lastUpdated: now,
                    lastEvent: 'Timer Paused by Admin',
                  };
                } else {
                  const rawRem = p.pausedRemainingSeconds ?? p.remainingSeconds;
                  const rem =
                    rawRem !== undefined && rawRem !== null
                      ? Math.max(0, Number(rawRem) || 0)
                      : (Number(p.allocatedMinutes) || fallbackMins) * 60;
                  if (rem <= 0) {
                    state.players[id] = {
                      ...p,
                      status: 'timeout',
                      isTimerPaused: false,
                      endTime: now,
                      pausedRemainingSeconds: 0,
                      remainingSeconds: 0,
                      clientSeq: (Number(p.clientSeq) || 0) + 1,
                      lastUpdated: now,
                      lastEvent: 'Timer Expired',
                    };
                  } else {
                    state.players[id] = {
                      ...p,
                      isTimerPaused: false,
                      endTime: now + rem * 1000,
                      pausedRemainingSeconds: null,
                      remainingSeconds: rem,
                      clientSeq: (Number(p.clientSeq) || 0) + 1,
                      lastUpdated: now,
                      lastEvent: 'Timer Resumed by Admin',
                    };
                  }
                }
              }
            } else if (action.type === 'UPDATE_ADMIN_PASSWORD' && action.newPassword) {
              state.settings = {
                ...state.settings,
                adminPasswordHash: String(action.newPassword).trim(),
                updatedAt: now,
              };
            } else if (action.type === 'RESET_ALL') {
              const nextEpoch = Math.max(
                now,
                Number(action.resetEpoch) || 0,
                (state.resetEpoch || 0) + 1
              );
              state = {
                players: {},
                removedIds: {},
                settings: {
                  ...state.settings,
                  updatedAt: Math.max(now, Number(state.settings?.updatedAt) || 0),
                },
                revision: (state.revision || 1) + 1,
                resetEpoch: nextEpoch,
              };
              broadcastState();
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(buildClientPayload(state, req)));
              return;
            } else if (action.type === 'SEED_PLAYERS' && action.players) {
              for (const [id, player] of Object.entries(action.players)) {
                delete state.removedIds?.[id];
                state.players[id] = {
                  ...player,
                  createdAt: now,
                  lastUpdated: now,
                };
              }
            } else if (action.type === 'SYNC_SNAPSHOT' && action.state) {
              for (const [id, p] of Object.entries(action.state.players || {})) {
                if (
                  !state.players[id] &&
                  !state.removedIds?.[id] &&
                  (p.createdAt || 0) >= (state.resetEpoch || 0)
                ) {
                  state.players[id] = {
                    ...p,
                    lastUpdated: p.lastUpdated || now,
                  };
                }
              }
            }

            state.revision = (state.revision || 1) + 1;
            broadcastState();
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify(
                buildClientPayload(state, req, {
                  playerId: targetPlayerId,
                  ...(resumedPlayerId ? { resumedPlayerId } : {}),
                })
              )
            );
          } catch (err) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Invalid JSON' }));
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), escapeStateApiPlugin()],
  server: {
    host: true,
    port: 5173,
  },
});
