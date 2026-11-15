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

function escapeStateApiPlugin() {
  let state = loadPersistedState();
  const sseClients = new Set();

  function getPayloadWithMeta() {
    return {
      ...state,
      serverTime: Date.now(),
      lanUrls: getLanUrls(5173),
    };
  }

  function broadcastState() {
    savePersistedState(state);
    const payload = `data: ${JSON.stringify(getPayloadWithMeta())}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(payload);
      } catch {
        sseClients.delete(res);
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
        res.write(`data: ${JSON.stringify(getPayloadWithMeta())}\n\n`);
        sseClients.add(res);
        req.on('close', () => {
          sseClients.delete(res);
        });
      });

      server.middlewares.use('/api/state', async (req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(getPayloadWithMeta()));
          return;
        }

        if (req.method === 'POST') {
          try {
            const action = await readJsonBody(req);
            const now = Date.now();

            if (action.type === 'UPSERT_PLAYER' && action.player?.id) {
              const incomingName = String(action.player.name || '').trim().toLowerCase();
              const isNewPlayer = !state.players[action.player.id];
              if (action.isNewRegistration && isNewPlayer && incomingName) {
                const duplicate = Object.values(state.players).some(
                  (p) => String(p.name || '').trim().toLowerCase() === incomingName
                );
                if (duplicate) {
                  res.statusCode = 409;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      error: 'This player name is already taken. Please choose a different name.',
                    })
                  );
                  return;
                }
              }
              const existing = state.players[action.player.id];
              if (!existing || (action.player.lastUpdated || 0) >= (existing.lastUpdated || 0)) {
                state.players[action.player.id] = {
                  ...action.player,
                  lastHeartbeat: now,
                  lastUpdated: Math.max(now, action.player.lastUpdated || 0),
                };
              }
            } else if (action.type === 'HEARTBEAT_PLAYER' && action.playerId) {
              const cur = state.players[action.playerId];
              if (cur && (cur.status === 'active' || cur.status === 'briefing' || cur.status === 'disconnected')) {
                state.players[action.playerId] = {
                  ...cur,
                  status: cur.status === 'disconnected' ? (cur.startTime ? 'active' : 'briefing') : cur.status,
                  isDisconnected: false,
                  lastHeartbeat: now,
                };
              }
            } else if (action.type === 'PLAYER_DISCONNECT' && action.playerId) {
              const cur = state.players[action.playerId];
              if (cur && (cur.status === 'active' || cur.status === 'briefing')) {
                state.players[action.playerId] = {
                  ...cur,
                  status: action.reason === 'left' ? 'left' : 'disconnected',
                  isDisconnected: true,
                  lastUpdated: now,
                  lastEvent: action.reason === 'left' ? 'Exited Game' : 'Closed Tab / Disconnected',
                };
              }
            } else if (action.type === 'REMOVE_PLAYER' && action.playerId) {
              delete state.players[action.playerId];
            } else if (action.type === 'UPDATE_SETTINGS' && action.settings) {
              const s = action.settings;
              const mins = Math.max(
                1,
                Math.min(240, Number(s.globalDurationMinutes) || state.settings.globalDurationMinutes || 60)
              );
              state.settings = {
                ...state.settings,
                globalDurationMinutes: mins,
                pointsCorrect:
                  s.pointsCorrect !== undefined ? Number(s.pointsCorrect) : state.settings.pointsCorrect,
                pointsWrong:
                  s.pointsWrong !== undefined ? Number(s.pointsWrong) : state.settings.pointsWrong,
                pointsPaidHint:
                  s.pointsPaidHint !== undefined ? Number(s.pointsPaidHint) : state.settings.pointsPaidHint,
                pointsSkip:
                  s.pointsSkip !== undefined ? Number(s.pointsSkip) : state.settings.pointsSkip,
                freeHintsCount:
                  s.freeHintsCount !== undefined
                    ? Math.max(0, Math.min(50, Number(s.freeHintsCount)))
                    : state.settings.freeHintsCount,
                adminPasswordHash:
                  s.adminPasswordHash || state.settings.adminPasswordHash || 'admin123',
                updatedAt: now,
              };
              if (action.applyToActive) {
                const deltaMs = mins * 60 * 1000;
                for (const id of Object.keys(state.players)) {
                  const p = state.players[id];
                  if (p.status === 'active' && p.startTime) {
                    const newEndTime = p.startTime + deltaMs;
                    const newRemaining = Math.max(0, Math.ceil((newEndTime - now) / 1000));
                    state.players[id] = {
                      ...p,
                      allocatedMinutes: mins,
                      endTime: newEndTime,
                      remainingSeconds: newRemaining,
                      status: newRemaining === 0 ? 'timeout' : 'active',
                      lastUpdated: now,
                    };
                  } else if (p.status === 'briefing') {
                    state.players[id] = {
                      ...p,
                      allocatedMinutes: mins,
                      remainingSeconds: mins * 60,
                      lastUpdated: now,
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
              state = {
                players: {},
                settings: {
                  ...state.settings,
                  updatedAt: now,
                },
                revision: state.revision + 1,
                resetEpoch: now,
              };
              broadcastState();
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(getPayloadWithMeta()));
              return;
            } else if (action.type === 'SEED_PLAYERS' && action.players) {
              for (const [id, player] of Object.entries(action.players)) {
                state.players[id] = {
                  ...player,
                  lastUpdated: now,
                };
              }
            } else if (action.type === 'SYNC_SNAPSHOT' && action.state) {
              for (const [id, p] of Object.entries(action.state.players || {})) {
                if (!state.players[id]) {
                  state.players[id] = {
                    ...p,
                    lastUpdated: now,
                  };
                }
              }
            }

            state.revision += 1;
            broadcastState();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(getPayloadWithMeta()));
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
    port: 5173,
    host: true,
  },
});
