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

function buildPublicLeaderboard(state, now = Date.now()) {
  const players = Object.values(state?.players || {});
  const fallbackMins = state?.settings?.globalDurationMinutes || 60;
  return players
    .map((p) => {
      let liveRemaining = fallbackMins * 60;
      if (p.status === 'briefing') {
        liveRemaining = (p.allocatedMinutes || fallbackMins) * 60;
      } else if (p.status === 'completed' || p.status === 'timeout' || p.status === 'left') {
        liveRemaining = Math.max(0, Number(p.pausedRemainingSeconds ?? p.remainingSeconds) || 0);
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
  if (!syncMeta || typeof syncMeta !== 'object') return state;
  let next = state;

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
  }

  if (syncMeta.removedIds && typeof syncMeta.removedIds === 'object') {
    next.removedIds = { ...(next.removedIds || {}), ...syncMeta.removedIds };
    for (const [remId, remAt] of Object.entries(next.removedIds)) {
      const existing = next.players?.[remId];
      if (existing && (existing.createdAt || 0) <= Number(remAt)) {
        delete next.players[remId];
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
      updatedAt: Number(incSettings.updatedAt),
    };
  }

  return next;
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
          'Content-Type, x-player-id, x-cipher-admin'
        );

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
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

            state = applyClientSyncMeta(state, action._sync);

            if (action.type === 'VERIFY_ADMIN') {
              const expected = state.settings?.adminPasswordHash || 'admin123';
              const ok = String(action.password || '').trim() === expected;
              res.statusCode = ok ? 200 : 401;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok }));
              return;
            }

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

              const incomingName = String(p.name || '').trim().toLowerCase();
              const existingByName = incomingName
                ? Object.values(state.players).find(
                    (other) => String(other.name || '').trim().toLowerCase() === incomingName
                  )
                : null;

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
                delete state.players[existingByName.id];
              }

              delete state.removedIds[p.id];
              const existing = state.players[p.id];
              const sameRun =
                existing && (existing.runId || existing.createdAt) === (p.runId || p.createdAt);

              if (sameRun && (p.clientSeq || 0) < (existing.clientSeq || 0)) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(buildClientPayload(state, req, { playerId: p.id })));
                return;
              }

              const configuredMins = Number(state.settings?.globalDurationMinutes) || 60;
              let nextPlayer = { ...p };

              if (sameRun) {
                const solvedRoomIds = Array.from(
                  new Set([...(existing.solvedRoomIds || []), ...(p.solvedRoomIds || [])])
                );
                const unlockedHintRooms = Array.from(
                  new Set([...(existing.unlockedHintRooms || []), ...(p.unlockedHintRooms || [])])
                );
                const mergedStartTime = p.startTime || existing.startTime || null;
                let mergedStatus = p.status;
                if (mergedStartTime && mergedStatus === 'briefing') {
                  mergedStatus = existing.status === 'briefing' ? 'active' : existing.status;
                }

                nextPlayer = {
                  ...existing,
                  ...p,
                  status: mergedStatus,
                  startTime: mergedStartTime,
                  currentRoom: Math.max(
                    Number(existing.currentRoom) || 1,
                    Number(p.currentRoom) || 1
                  ),
                  completedRooms: Math.max(
                    solvedRoomIds.length,
                    Number(existing.completedRooms) || 0,
                    Number(p.completedRooms) || 0
                  ),
                  solvedRoomIds,
                  hintsUsed: Math.max(Number(existing.hintsUsed) || 0, Number(p.hintsUsed) || 0),
                  wrongAttempts: Math.max(
                    Number(existing.wrongAttempts) || 0,
                    Number(p.wrongAttempts) || 0
                  ),
                  skippedCount: Math.max(
                    Number(existing.skippedCount) || 0,
                    Number(p.skippedCount) || 0
                  ),
                  tabSwitches: Math.max(
                    Number(existing.tabSwitches) || 0,
                    Number(p.tabSwitches) || 0
                  ),
                  unlockedHintRooms,
                  clientSeq: Math.max(Number(existing.clientSeq) || 0, Number(p.clientSeq) || 0),
                };
              }

              if (nextPlayer.status === 'briefing') {
                nextPlayer.allocatedMinutes = configuredMins;
                nextPlayer.remainingSeconds = configuredMins * 60;
              } else if (
                nextPlayer.status === 'active' &&
                (!existing || existing.status === 'briefing') &&
                !action.isRejoin
              ) {
                nextPlayer.allocatedMinutes = configuredMins;
                const startTs = nextPlayer.startTime || now;
                nextPlayer.startTime = startTs;
                nextPlayer.endTime = startTs + configuredMins * 60 * 1000;
                nextPlayer.remainingSeconds = configuredMins * 60;
              }

              state.players[p.id] = {
                ...nextPlayer,
                lastHeartbeat: now,
                lastUpdated: p.lastUpdated || now,
              };
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
                const fallbackMins = state.settings?.globalDurationMinutes || 60;
                const rem = cur.endTime
                  ? Math.max(0, Math.ceil((cur.endTime - now) / 1000))
                  : cur.remainingSeconds || fallbackMins * 60;
                state.players[action.playerId] = {
                  ...cur,
                  status: action.reason === 'left' ? 'left' : 'disconnected',
                  isDisconnected: true,
                  pausedRemainingSeconds: rem,
                  remainingSeconds: rem,
                  lastUpdated: now,
                  lastEvent: action.reason === 'left' ? 'Exited Game' : 'Closed Tab / Disconnected',
                };
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

                if (action.applyToActive && p.status === 'active' && p.startTime) {
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
                  playerId: action.player?.id || action.playerId,
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
