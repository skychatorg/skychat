// Listener-tier (F9) harness: a guest (right -1 < minRightForVoiceSpeak 0) can JOIN and HEAR
// but is refused a send transport when trying to speak.
import { chromium } from 'playwright-core';
const CHROME = '/home/braymond/.cache/ms-playwright/chromium-1226/chrome-linux64/chrome';
const BASE = 'http://skych.at.localhost:8081';
const initScript = () => {
    window.__pcs = [];
    window.__errors = [];
    const Native = window.RTCPeerConnection;
    window.RTCPeerConnection = function (...a) {
        const pc = new Native(...a);
        window.__pcs.push(pc);
        return pc;
    };
    window.RTCPeerConnection.prototype = Native.prototype;
    const realGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
        if (!c || !c.audio) return realGUM(c);
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const dst = ctx.createMediaStreamDestination();
        osc.connect(dst);
        osc.start();
        return dst.stream;
    };
};
async function loginUser(page, u, p) {
    await page.goto(BASE);
    await page.getByRole('textbox', { name: 'Username' }).fill(u);
    await page.getByRole('textbox', { name: 'Password' }).fill(p);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByRole('textbox', { name: /New message/ }).waitFor({ timeout: 15000 });
}
async function loginGuest(page) {
    await page.goto(BASE);
    await page.getByRole('button', { name: /Continue as guest/ }).click();
    await page.getByRole('textbox', { name: /New message/ }).waitFor({ timeout: 15000 });
}
async function joinVoice(page) {
    await page.getByText('🤡 Party', { exact: false }).first().click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /Voice 1/ }).first().click();
    await page.locator('button[title="Leave voice"]').first().waitFor({ timeout: 10000 });
}
async function heard(page) {
    return await page.evaluate(async () => {
        const s = async () => {
            const m = {};
            for (const pc of window.__pcs || []) (await pc.getStats()).forEach((r) => { if (r.type === 'inbound-rtp' && r.kind === 'audio') m[r.id] = r.packetsReceived || 0; });
            return m;
        };
        const a = await s(); await new Promise((r) => setTimeout(r, 2000)); const b = await s();
        return Object.keys(b).filter((id) => (b[id] || 0) > (a[id] || 0)).length;
    });
}
async function outbound(page) {
    return await page.evaluate(async () => {
        let n = 0;
        for (const pc of window.__pcs || []) (await pc.getStats()).forEach((r) => { if (r.type === 'outbound-rtp' && r.kind === 'audio') n++; });
        return n;
    });
}
(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'] });
    const ctxA = await browser.newContext({ permissions: ['microphone'] });
    const ctxG = await browser.newContext({ permissions: ['microphone'] });
    await ctxA.addInitScript(initScript); await ctxG.addInitScript(initScript);
    const A = await ctxA.newPage(); const G = await ctxG.newPage();
    await loginUser(A, 'r-35', 'testpass123');
    // Listener = silva (right 0) with minRightForVoiceSpeak set to 10 by the test harness.
    await loginUser(G, 'silva', 'testpass123');
    await joinVoice(A); await joinVoice(G);
    // A speaks
    await A.locator('button[title="Unmute"]').first().click();
    await A.waitForTimeout(4000);
    // Guest hears A?
    const gHeard = await heard(G);
    console.log('guest hears speaker:', gHeard);
    // Guest tries to speak -> server refuses send transport, error toast appears
    G.on('framereceived', () => {});
    await G.locator('button[title="Unmute"]').first().click();
    await G.waitForTimeout(3000);
    const gOut = await outbound(G);
    // error toast text
    const toast = await G.getByText(/permission to speak|listener/i).count();
    console.log('guest outbound streams:', gOut, ' speak-refused toast:', toast);
    const pass = gHeard >= 1 && gOut === 0 && toast >= 1;
    console.log('LISTENER TIER:', pass ? 'PASS ✅' : 'FAIL ❌');
    await browser.close();
    process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('harness error:', e); process.exit(2); });
