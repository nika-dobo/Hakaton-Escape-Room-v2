import fs from 'node:fs';

const DB_FILE = '/tmp/cipher50-escape-room-db.json';
const REDIS_KEY = 'cipher50_escape_room_state_v2';

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

function normalizeState(parsed) {
  const base = createInitialState();
  if (!parsed || typeof parsed !== 'object') return base;
  return {
    ...base,
    ...parsed,
    settings: {
      ...base.settings,
      ...(parsed.settings || {}),
    },
    players: parsed.players && typeof parsed.players === 'object' ? parsed.players : {},
  };
}

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return { url: url.replace(/\/+$/, ''), token };
  }
  return null;
}

function getFirebaseUrl() {
  const url = process.env.FIREBASE_DB_URL || process.env.VITE_FIREBASE_DB_URL;
  return url ? url.trim().replace(/\/+$/, '') : '';
}

async function loadState() {
  const redis = getRedisConfig();
  if (redis) {
    try {
      const res = await fetch(`${redis.url}/get/${REDIS_KEY}`, {
        headers: { Authorization: `Bearer ${redis.token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.result) {
          const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
          return { state: normalizeState(parsed), storageMode: 'redis' };
        }
      }
    } catch {
      // fall through
    }
    return { state: createInitialState(), storageMode: 'redis' };
  }

  const fbUrl = getFirebaseUrl();
  if (fbUrl) {
    try {
      const res = await fetch(`${fbUrl}/cipher50.json`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        return { state: normalizeState(data), storageMode: 'firebase' };
      }
    } catch {
      // fall through
    }
    return { state: createInitialState(), storageMode: 'firebase' };
  }

  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      return { state: normalizeState(parsed), storageMode: 'ephemeral' };
    }
  } catch {
    // ignore /tmp read errors
  }
  return { state: createInitialState(), storageMode: 'ephemeral' };
}

async function saveState(state) {
  const redis = getRedisConfig();
  if (redis) {
    try {
      await fetch(`${redis.url}/set/${REDIS_KEY}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redis.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(JSON.stringify(state)),
      });
      return;
    } catch {
      // fall through
    }
  }

  const fbUrl = getFirebaseUrl();
  if (fbUrl) {
    try {
      await fetch(`${fbUrl}/cipher50.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      return;
    } catch {
      // fall through
    }
  }

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state), 'utf-8');
  } catch {
    // ignore /tmp write errors
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { state: loadedState, storageMode } = await loadState();
  let state = loadedState;

  if (req.method === 'GET') {
    return res.status(200).json({ ...state, storageMode, serverTime: Date.now() });
  }

  if (req.method === 'POST') {
    try {
      const action = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const now = Date.now();

      if (action.type === 'UPSERT_PLAYER' && action.player?.id) {
        const incomingName = String(action.player.name || '').trim().toLowerCase();
        const isNewPlayer = !state.players[action.player.id];
        if (action.isNewRegistration && isNewPlayer && incomingName) {
          const duplicate = Object.values(state.players).some(
            (p) => String(p.name || '').trim().toLowerCase() === incomingName
          );
          if (duplicate) {
            return res.status(409).json({
              error: 'This player name is already taken. Please choose a different name.',
            });
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
        if (
          cur &&
          (cur.status === 'active' || cur.status === 'briefing' || cur.status === 'disconnected')
        ) {
          state.players[action.playerId] = {
            ...cur,
            status:
              cur.status === 'disconnected' ? (cur.startTime ? 'active' : 'briefing') : cur.status,
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
            s.pointsPaidHint !== undefined
              ? Number(s.pointsPaidHint)
              : state.settings.pointsPaidHint,
          pointsSkip: s.pointsSkip !== undefined ? Number(s.pointsSkip) : state.settings.pointsSkip,
          freeHintsCount:
            s.freeHintsCount !== undefined
              ? Math.max(0, Math.min(50, Number(s.freeHintsCount)))
              : state.settings.freeHintsCount,
          adminPasswordHash: s.adminPasswordHash || state.settings.adminPasswordHash || 'admin123',
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
      } else if (action.type === 'SEED_PLAYERS' && action.players) {
        for (const [id, player] of Object.entries(action.players)) {
          state.players[id] = { ...player, lastUpdated: now };
        }
      } else if (action.type === 'SYNC_SNAPSHOT' && action.state) {
        for (const [id, p] of Object.entries(action.state.players || {})) {
          if (!state.players[id]) {
            state.players[id] = { ...p, lastUpdated: now };
          }
        }
      }

      state.revision += 1;
      await saveState(state);
      return res.status(200).json({ ...state, storageMode, serverTime: now });
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Invalid JSON' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
