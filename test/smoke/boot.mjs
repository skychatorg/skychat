// Checks that a running stack really serves chat: connects to the backend through traefik as a guest and waits for
// the events a client needs. A 200 on the home page is not enough, since frontend and static answer while the backend crashloops.
// Usage: node test/smoke/boot.mjs [baseUrl] [timeoutSec]
import WebSocket from 'ws';

const base = process.argv[2] ?? 'http://localhost:8081';
const deadline = Date.now() + Number(process.argv[3] ?? 300) * 1000;
const expected = ['connection-accepted', 'config', 'room-list', 'join-room', 'messages'];

function attempt() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(base.replace(/^http/, 'ws') + '/api/ws');
        const seen = new Set();
        const timer = setTimeout(() => fail(`timed out, got: ${[...seen].join(', ') || 'nothing'}`), 10_000);
        const fail = (reason) => {
            clearTimeout(timer);
            ws.terminate();
            reject(new Error(reason));
        };
        // An empty auth payload logs in as a guest
        ws.on('open', () => ws.send('{}'));
        ws.on('error', (error) => fail(error.message));
        ws.on('close', (code) => fail(`closed with code ${code}`));
        ws.on('message', (raw) => {
            const { event, data } = JSON.parse(raw.toString());
            if (event === 'error') {
                return fail(`server error: ${data}`);
            }
            seen.add(event);
            if (expected.every((name) => seen.has(name))) {
                clearTimeout(timer);
                ws.removeAllListeners('close');
                ws.close();
                resolve();
            }
        });
    });
}

for (;;) {
    try {
        const home = await fetch(base);
        if (home.status !== 200) {
            throw new Error(`home page returned ${home.status}`);
        }
        await attempt();
        console.log(`OK: ${base} serves the app and the backend sent ${expected.join(', ')}`);
        process.exit(0);
    } catch (error) {
        if (Date.now() > deadline) {
            console.error(`FAIL: ${error.message}`);
            process.exit(1);
        }
        console.log(`waiting: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }
}
