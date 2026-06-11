// Two-peer voice validation harness (test tooling, not part of the app).
// Launches two isolated browser contexts with a fake mic, joins both to the same
// voice channel, and reads RTCPeerConnection stats to prove media flows both ways
// with no IP leak (remote candidates = announced IP only, iceServers empty, no STUN/TURN).
import { chromium } from 'playwright-core';

const CHROME = '/home/braymond/.cache/ms-playwright/chromium-1226/chrome-linux64/chrome';
const BASE = 'http://skych.at.localhost:8081';
const ROOM_TEXT = 'Party';
const VOICE_TEXT = 'Voice 1';

const initScript = () => {
    // Collect every RTCPeerConnection mediasoup-client creates.
    window.__pcs = [];
    const Native = window.RTCPeerConnection;
    window.RTCPeerConnection = function (...args) {
        const pc = new Native(...args);
        window.__pcs.push(pc);
        return pc;
    };
    window.RTCPeerConnection.prototype = Native.prototype;
    // Deterministic fake mic: a steady oscillator tone (energy => packets + hark speaking).
    const realGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (!constraints || !constraints.audio) return realGUM(constraints);
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.frequency.value = 280;
        const dst = ctx.createMediaStreamDestination();
        const gain = ctx.createGain();
        gain.gain.value = 0.25;
        osc.connect(gain).connect(dst);
        osc.start();
        return dst.stream;
    };
};

async function login(page, username, password) {
    await page.goto(BASE);
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByRole('textbox', { name: /New message/ }).waitFor({ timeout: 15000 });
}

async function joinRoomAndVoice(page, tag) {
    // Switch to the public Party room (accepts everyone) so the voice join gate passes.
    await page.getByText('🤡 Party', { exact: false }).first().click();
    await page.waitForTimeout(1000);
    // Join the voice channel (accessible name starts with "Voice 1").
    await page.getByRole('button', { name: /Voice 1/ }).first().click();
    // Confirm the VoicePanel mounted.
    await page.locator('button[title="Leave voice"]').first().waitFor({ timeout: 10000 });
    console.log(`  ${tag}: voice panel mounted`);
}

async function unmute(page, tag) {
    // After join the mic starts OFF (title "Unmute"). One click starts capture + produce.
    const btn = page.locator('button[title="Unmute"]');
    try {
        await btn.first().waitFor({ timeout: 8000 });
    } catch {
        await page.screenshot({ path: `/tmp/voice-${tag}.png` });
        const titles = await page.locator('button[title]').evaluateAll((els) => els.map((e) => e.title));
        console.log(`  ${tag}: no Unmute button. button titles:`, titles);
        throw new Error(`${tag}: Unmute not found`);
    }
    await btn.first().click();
    await page.waitForTimeout(500);
}

async function readStats(page) {
    return await page.evaluate(async () => {
        const out = { iceServers: [], remoteAddrs: new Set(), candidateTypes: new Set(), inbound: [], outbound: [] };
        for (const pc of window.__pcs || []) {
            try {
                const cfg = pc.getConfiguration?.() || {};
                out.iceServers.push(JSON.stringify(cfg.iceServers || []));
                const stats = await pc.getStats();
                stats.forEach((r) => {
                    if (r.type === 'remote-candidate') {
                        out.remoteAddrs.add(r.address || r.ip || '?');
                        out.candidateTypes.add(r.candidateType || '?');
                    }
                    if (r.type === 'inbound-rtp' && r.kind === 'audio') {
                        out.inbound.push({ packetsReceived: r.packetsReceived || 0, bytesReceived: r.bytesReceived || 0 });
                    }
                    if (r.type === 'outbound-rtp' && r.kind === 'audio') {
                        out.outbound.push({ packetsSent: r.packetsSent || 0, bytesSent: r.bytesSent || 0 });
                    }
                });
            } catch (e) {
                out.error = String(e);
            }
        }
        out.remoteAddrs = [...out.remoteAddrs];
        out.candidateTypes = [...out.candidateTypes];
        return out;
    });
}

async function captureWsFrames(page) {
    return await page.evaluate(() => window.__voiceFrames || []);
}

(async () => {
    const browser = await chromium.launch({
        executablePath: CHROME,
        headless: true,
        args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'],
    });

    const ctxA = await browser.newContext({ permissions: ['microphone'] });
    const ctxB = await browser.newContext({ permissions: ['microphone'] });
    await ctxA.addInitScript(initScript);
    await ctxB.addInitScript(initScript);
    const A = await ctxA.newPage();
    const B = await ctxB.newPage();

    // Capture voice-* WS frames in each page for the no-leak payload audit.
    const wsHook = (page) => {
        page.on('websocket', (ws) => {
            ws.on('framereceived', (ev) => {
                try {
                    const s = typeof ev.payload === 'string' ? ev.payload : ev.payload.toString();
                    if (s.includes('voice-')) {
                        page.evaluate((f) => {
                            (window.__voiceFrames ||= []).push(f);
                        }, s).catch(() => {});
                    }
                } catch {
                    /* ignore */
                }
            });
        });
    };
    wsHook(A);
    wsHook(B);

    console.log('login A (r-35, OP)…');
    await login(A, 'r-35', 'testpass123');
    console.log('login B (silva)…');
    await login(B, 'silva', 'testpass123');

    console.log('A join room + voice…');
    await joinRoomAndVoice(A, 'A');
    console.log('B join room + voice…');
    await joinRoomAndVoice(B, 'B');

    console.log('A unmute (produce)…');
    await unmute(A, 'A');
    console.log('B unmute (produce)…');
    await unmute(B, 'B');

    console.log('waiting 8s for media to flow…');
    await A.waitForTimeout(8000);

    const statsA = await readStats(A);
    const statsB = await readStats(B);
    const framesA = await captureWsFrames(A);

    const leakRe = /"ip"|srflx|relay|stun|turn|"candidate"|"sdp"|192\.168|10\.\d|172\.(1[6-9]|2[0-9]|3[01])\./i;
    const leakHits = framesA.filter((f) => leakRe.test(f) && !/127\.0\.0\.1/.test(f.replace(/127\.0\.0\.1/g, '')));
    const badFrames = framesA.filter((f) => /srflx|relay|"sdp"|"candidate":/i.test(f));

    console.log('\n===== RESULT =====');
    console.log('A stats:', JSON.stringify(statsA, null, 0));
    console.log('B stats:', JSON.stringify(statsB, null, 0));
    console.log('A voice frame count:', framesA.length);
    console.log('frames with srflx/relay/sdp/candidate (should be 0):', badFrames.length);

    const aRecv = statsA.inbound.reduce((s, r) => s + r.packetsReceived, 0);
    const bRecv = statsB.inbound.reduce((s, r) => s + r.packetsReceived, 0);
    const aSent = statsA.outbound.reduce((s, r) => s + r.packetsSent, 0);
    const bSent = statsB.outbound.reduce((s, r) => s + r.packetsSent, 0);
    const allRemote = [...new Set([...statsA.remoteAddrs, ...statsB.remoteAddrs])];
    const allTypes = [...new Set([...statsA.candidateTypes, ...statsB.candidateTypes])];
    const allIce = [...new Set([...statsA.iceServers, ...statsB.iceServers])];

    console.log('\nA packetsSent:', aSent, ' A packetsReceived:', aRecv);
    console.log('B packetsSent:', bSent, ' B packetsReceived:', bRecv);
    console.log('remote candidate addrs:', allRemote);
    console.log('remote candidate types:', allTypes);
    console.log('iceServers configs:', allIce);

    const pass =
        aRecv > 0 &&
        bRecv > 0 &&
        aSent > 0 &&
        bSent > 0 &&
        allRemote.every((a) => a === '127.0.0.1') &&
        !allTypes.includes('srflx') &&
        !allTypes.includes('relay') &&
        allIce.every((s) => s === '[]') &&
        badFrames.length === 0;
    console.log('\nOVERALL:', pass ? 'PASS ✅' : 'FAIL ❌');

    await browser.close();
    process.exit(pass ? 0 : 1);
})().catch((e) => {
    console.error('harness error:', e);
    process.exit(2);
});
