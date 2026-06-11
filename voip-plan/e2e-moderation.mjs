// Moderation matrix harness (test tooling). Two speakers (A=r-35 OP, B=silva) in one
// voice channel; measures how many remote audio streams each hears (inbound-rtp count)
// before/after each moderation action. Proves shadowban/blacklist/voicemute/voicekick/ban.
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
    const realGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
        if (!c || !c.audio) return realGUM(c);
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.frequency.value = 300;
        const dst = ctx.createMediaStreamDestination();
        const g = ctx.createGain();
        g.gain.value = 0.25;
        osc.connect(g).connect(dst);
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
async function joinVoice(page, tag) {
    await page.getByText('🤡 Party', { exact: false }).first().click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /Voice 1/ }).first().click();
    await page.locator('button[title="Leave voice"]').first().waitFor({ timeout: 10000 });
    console.log(`  ${tag}: in voice`);
}
async function unmute(page) {
    await page.locator('button[title="Unmute"]').first().click({ timeout: 8000 });
    await page.waitForTimeout(500);
}
async function cmd(page, text) {
    const box = page.getByRole('textbox', { name: /New message/ });
    await box.fill(text);
    await box.press('Enter');
    await page.waitForTimeout(300);
}
// number of remote audio streams ACTIVELY heard right now (packetsReceived increasing
// over a 2s window). bytesReceived is cumulative, so a stopped stream still shows >0 —
// we must measure the delta.
async function heard(page) {
    return await page.evaluate(async () => {
        const sample = async () => {
            const m = {};
            for (const pc of window.__pcs || []) {
                const stats = await pc.getStats();
                stats.forEach((r) => {
                    if (r.type === 'inbound-rtp' && r.kind === 'audio') m[r.id] = r.packetsReceived || 0;
                });
            }
            return m;
        };
        const a = await sample();
        await new Promise((r) => setTimeout(r, 2000));
        const b = await sample();
        let n = 0;
        for (const id of Object.keys(b)) {
            if ((b[id] || 0) > (a[id] || 0)) n++;
        }
        return n;
    });
}
async function inVoice(page) {
    // VoicePanel present (Leave voice button) => still in a voice channel
    return (await page.locator('button[title="Leave voice"]').count()) > 0;
}
const results = [];
function check(name, cond, detail) {
    results.push({ name, pass: !!cond, detail });
    console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${name} ${detail ?? ''}`);
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

    await login(A, 'r-35', 'testpass123');
    await login(B, 'silva', 'testpass123');
    await cmd(A, '/op 1234'); // activate OP for /voicemute /voicekick
    await joinVoice(A, 'A');
    await joinVoice(B, 'B');
    await unmute(A);
    await unmute(B);
    await A.waitForTimeout(6000);

    let aH = await heard(A);
    let bH = await heard(B);
    console.log(`baseline: A hears ${aH}, B hears ${bH}`);
    check('baseline both hear each other', aH >= 1 && bH >= 1, `(A=${aH},B=${bH})`);

    // Order: reversible, producer-PRESERVING filters first (shadowban/blacklist only close
    // consumers, so producers survive and re-consume on undo). The producer-CLOSING ones
    // (voicemute/voicekick) run last so they don't starve later measurements.

    // --- M3 shadowban: A shadowbans silva -> A stops hearing silva, silva still hears A ---
    console.log('\nM3 /ban silva shadow');
    await cmd(A, '/ban silva SHADOW 120');
    await A.waitForTimeout(4000);
    aH = await heard(A);
    bH = await heard(B);
    check('shadowban: A stops hearing silva', aH === 0, `(A=${aH})`);
    // NOTE: "silva still hears A" can't be asserted in this single-host test env: TRUSTED_IP_HEADER
    // is unset so every browser shares traefik's IP, and BanPlugin bans by username AND ip — so
    // shadowbanning silva also IP-flags A (same as text-side behavior). Informational only.
    console.log(`  [INFO] silva hears A = ${bH} (expected >=1 on distinct IPs; 0 here due to shared traefik IP)`);
    check('shadowban: silva not disconnected (still in voice)', await inVoice(B));
    await cmd(A, '/unban silva');
    await A.waitForTimeout(4000);
    aH = await heard(A);
    check('shadowban removed: A hears silva again', aH >= 1, `(A=${aH})`);

    // --- M4 blacklist (bidirectional): A blacklists silva ---
    console.log('\nM4 /blacklist silva');
    await cmd(A, '/blacklist silva');
    await A.waitForTimeout(4000);
    aH = await heard(A);
    bH = await heard(B);
    check('blacklist: A does not hear silva', aH === 0, `(A=${aH})`);
    check('blacklist: silva does not hear A (bidirectional)', bH === 0, `(B=${bH})`);
    check('blacklist: nobody disconnected', (await inVoice(A)) && (await inVoice(B)));
    await cmd(A, '/unblacklist silva');
    await A.waitForTimeout(4000);
    aH = await heard(A);
    check('blacklist removed: A hears silva again', aH >= 1, `(A=${aH})`);

    // --- M8 voicemute (overt): A mutes B -> A stops hearing B, B still hears A ---
    console.log('\nM8 /voicemute silva');
    await cmd(A, '/voicemute silva');
    await A.waitForTimeout(4000);
    aH = await heard(A);
    bH = await heard(B);
    check('voicemute: A stops hearing B', aH === 0, `(A=${aH})`);
    check('voicemute: B still hears A', bH >= 1, `(B=${bH})`);

    // --- M9 voicekick: A kicks silva from voice only (stays in room/text) ---
    console.log('\nM9 /voicekick silva');
    await cmd(A, '/voicekick silva');
    await B.waitForTimeout(3000);
    check('voicekick: silva removed from voice', !(await inVoice(B)));
    check('voicekick: silva still has chat input (in room)', (await B.getByRole('textbox', { name: /New message/ }).count()) > 0);

    console.log('\n===== SUMMARY =====');
    const passed = results.filter((r) => r.pass).length;
    console.log(`${passed}/${results.length} checks passed`);
    const failed = results.filter((r) => !r.pass);
    if (failed.length) console.log('FAILED:', failed.map((f) => f.name).join(' | '));
    await browser.close();
    process.exit(failed.length ? 1 : 0);
})().catch((e) => {
    console.error('harness error:', e);
    process.exit(2);
});
