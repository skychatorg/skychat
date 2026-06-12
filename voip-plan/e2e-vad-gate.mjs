// VAD / noise-gate + input-mode verification (test tooling). Uses Chrome's real fake-audio
// device (a tone) so packets reliably flow when the mic is open, and drives the gate through
// the ACTUAL controls (live mode switch in the Settings drawer + mute) — the same pause/resume
// path VAD uses. Listener B's inbound packetsReceived is the signal.
//   - open mode: A transmits (B receives)
//   - switch to Voice-activity while a tone plays: gate stays OPEN (B still receives) => VAD opens on speech
//   - mute: producer pauses (B receives ~0) => the gate/pause mechanism works
//   - unmute: resumes (B receives again)
// (VAD closing on *silence* is the same pause mechanism, triggered by hark detecting sub-threshold
//  audio; reliably toggling synthetic audibility in headless Chrome is unreliable, so it's covered
//  by the mute/pause proof here + the standalone probe-hark.mjs threshold check + manual testing.)
import { chromium } from 'playwright-core';

const CHROME = '/home/braymond/.cache/ms-playwright/chromium-1226/chrome-linux64/chrome';
const BASE = 'http://skych.at.localhost:8081';

const initScript = () => {
    window.__pcs = [];
    const Native = window.RTCPeerConnection;
    window.RTCPeerConnection = function (...a) {
        const pc = new Native(...a);
        window.__pcs.push(pc);
        return pc;
    };
    window.RTCPeerConnection.prototype = Native.prototype;
    // Reliable, constant audible tone as the mic so packets clearly flow whenever the producer is
    // open (a real tone above hark's threshold; with the autoplay flag + awaited resume it renders).
    const realGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
        if (!c || !c.audio) return realGUM(c);
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        await ctx.resume().catch(() => {});
        const osc = ctx.createOscillator();
        osc.frequency.value = 280;
        const gain = ctx.createGain();
        gain.gain.value = 0.25;
        const dst = ctx.createMediaStreamDestination();
        osc.connect(gain).connect(dst);
        osc.start();
        return dst.stream;
    };
};

async function login(page, u, p) {
    await page.goto(BASE);
    await page.getByRole('textbox', { name: 'Username' }).fill(u);
    await page.getByRole('textbox', { name: 'Password' }).fill(p);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByRole('textbox', { name: /New message/ }).waitFor({ timeout: 15000 });
}
async function joinVoice(page) {
    await page.getByText('🤡 Party', { exact: false }).first().click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /Voice 1/ }).first().click();
    await page.locator('button[title="Leave voice"]').first().waitFor({ timeout: 10000 });
}
// The constant tone makes the speaking indicator re-render the panel, detaching buttons mid-click.
// Click via the DOM (fires the Vue handler) to bypass actionability, retrying until the title flips.
async function clickToggle(page, fromTitle, toTitle) {
    for (let i = 0; i < 20; i++) {
        if ((await page.locator(`button[title="${toTitle}"]`).count()) > 0) return;
        await page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.title === t)?.click(), fromTitle);
        await page.waitForTimeout(500); // first unmute also waits for getUserMedia + produce
    }
    await page.locator(`button[title="${toTitle}"]`).first().waitFor({ timeout: 8000 });
}
const unmute = (page) => clickToggle(page, 'Unmute', 'Mute');
const mute = (page) => clickToggle(page, 'Mute', 'Unmute');
async function setMode(page, label) {
    await page.getByRole('button', { name: 'Settings' }).first().click();
    await page.getByRole('button', { name: label, exact: true }).click({ timeout: 8000 });
    await page.keyboard.press('Escape'); // close the drawer
    await page.waitForTimeout(600);
}
async function received(page) {
    return await page.evaluate(async () => {
        let n = 0;
        for (const pc of window.__pcs || []) {
            (await pc.getStats()).forEach((r) => {
                if (r.type === 'inbound-rtp' && r.kind === 'audio') n += r.packetsReceived || 0;
            });
        }
        return n;
    });
}
async function delta(page, ms) {
    const a = await received(page);
    await page.waitForTimeout(ms);
    return (await received(page)) - a;
}

const results = [];
const ck = (n, c, d) => {
    results.push(!!c);
    console.log(`  [${c ? 'PASS' : 'FAIL'}] ${n} ${d ?? ''}`);
};

(async () => {
    const browser = await chromium.launch({
        executablePath: CHROME,
        headless: true,
        args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
            '--no-sandbox',
        ],
    });
    const ctxA = await browser.newContext({ permissions: ['microphone'] });
    const ctxB = await browser.newContext({ permissions: ['microphone'] });
    await ctxA.addInitScript(initScript);
    await ctxB.addInitScript(initScript);
    const A = await ctxA.newPage();
    const B = await ctxB.newPage();

    await login(A, 'r-35', 'testpass123');
    await login(B, 'silva', 'testpass123');
    await joinVoice(A);
    await unmute(A); // A produces (open mode, fake tone)
    await joinVoice(B); // B consumes A
    await B.waitForTimeout(5000);

    // pause() disables the track -> it sends DTX *silence* (comfort packets), not zero. So the
    // gate silences the AUDIO CONTENT (no background transmitted); reception drops to DTX-comfort
    // level, well below the full-audio rate. Assert the relative contrast.
    const openD = await delta(B, 2500);
    ck('open mode: B receives full audio', openD > 50, `(Δ=${openD})`);

    await mute(A); // hard mute -> producer paused (track disabled -> silence/DTX)
    await A.waitForTimeout(1000);
    const muteD = await delta(B, 2500);
    ck('mute gates audio: B reception drops far below open', muteD < openD * 0.4, `(Δ=${muteD} vs open ${openD})`);

    await unmute(A); // resume
    await A.waitForTimeout(1000);
    const unmuteD = await delta(B, 2500);
    ck('unmute resumes: B receives full audio again', unmuteD > 50, `(Δ=${unmuteD})`);

    await setMode(A, 'Voice activity'); // VAD on; constant tone is audible -> gate stays open
    await A.waitForTimeout(1500);
    const vadD = await delta(B, 2500);
    ck('VAD mode transmits speech: B still receives', vadD > 50, `(Δ=${vadD})`);

    console.log('\n===== VAD GATE / MODES =====');
    const failed = results.filter((x) => !x).length;
    console.log(failed ? 'FAIL ❌' : 'PASS ✅');
    await browser.close();
    process.exit(failed ? 1 : 0);
})().catch((e) => {
    console.error('harness error:', e);
    process.exit(2);
});
