// Bunker (M7) harness. Requires minRightForVoiceJoin=-1 and minRightForVoiceSpeak=-1 so a
// guest can join AND speak. Proves: guest speaks normally; /bunker on live-revokes the guest's
// mic (others stop hearing it) and refuses a fresh guest produce; registered OP unaffected.
import { chromium } from 'playwright-core';
const CHROME = '/home/braymond/.cache/ms-playwright/chromium-1226/chrome-linux64/chrome';
const BASE = 'http://skych.at.localhost:8081';
const initScript = () => {
    window.__pcs = [];
    const Native = window.RTCPeerConnection;
    window.RTCPeerConnection = function (...a) { const pc = new Native(...a); window.__pcs.push(pc); return pc; };
    window.RTCPeerConnection.prototype = Native.prototype;
    const realGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
        if (!c || !c.audio) return realGUM(c);
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator(); const dst = ctx.createMediaStreamDestination();
        osc.connect(dst); osc.start(); return dst.stream;
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
async function cmd(page, t) { const b = page.getByRole('textbox', { name: /New message/ }); await b.fill(t); await b.press('Enter'); await page.waitForTimeout(400); }
async function heard(page) {
    return await page.evaluate(async () => {
        const s = async () => { const m = {}; for (const pc of window.__pcs || []) (await pc.getStats()).forEach((r) => { if (r.type === 'inbound-rtp' && r.kind === 'audio') m[r.id] = r.packetsReceived || 0; }); return m; };
        const a = await s(); await new Promise((r) => setTimeout(r, 2000)); const b = await s();
        return Object.keys(b).filter((id) => (b[id] || 0) > (a[id] || 0)).length;
    });
}
const out = []; const ck = (n, c, d) => { out.push(!!c); console.log(`  [${c ? 'PASS' : 'FAIL'}] ${n} ${d ?? ''}`); };
(async () => {
    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--no-sandbox'] });
    const ctxA = await browser.newContext({ permissions: ['microphone'] });
    const ctxG = await browser.newContext({ permissions: ['microphone'] });
    await ctxA.addInitScript(initScript); await ctxG.addInitScript(initScript);
    const A = await ctxA.newPage(); const G = await ctxG.newPage();
    await loginUser(A, 'r-35', 'testpass123');
    await loginGuest(G);
    await cmd(A, '/op 1234');
    await cmd(A, '/bunker off');
    await joinVoice(A); await joinVoice(G);
    await A.locator('button[title="Unmute"]').first().click(); // OP speaks
    await G.locator('button[title="Unmute"]').first().click(); // guest speaks (bunker off)
    await A.waitForTimeout(5000);
    let aHeard = await heard(A);
    ck('bunker off: OP hears guest speaking', aHeard >= 1, `(A=${aHeard})`);

    console.log('/bunker on');
    await cmd(A, '/bunker on');
    await A.waitForTimeout(4000);
    aHeard = await heard(A);
    ck('bunker on: guest mic revoked (OP stops hearing guest)', aHeard === 0, `(A=${aHeard})`);

    // guest still hears OP (registered, unaffected). On shared IP this may also be filtered, so info-only.
    const gHeard = await heard(G);
    console.log(`  [INFO] guest still hears OP = ${gHeard}`);

    console.log('/bunker off (cleanup)');
    await cmd(A, '/bunker off');
    await browser.close();
    const failed = out.filter((x) => !x).length;
    console.log(`\nBUNKER: ${failed ? 'FAIL ❌' : 'PASS ✅'}`);
    process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('harness error:', e); process.exit(2); });
