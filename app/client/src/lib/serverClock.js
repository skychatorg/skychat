import { ref } from 'vue';

/** The server's clock minus this machine's, in ms. Machine clocks drift apart by seconds, so countdowns to server instants use the server's time */
const offset = ref(0);

/** The last offsets measured: each is late by however long its ping took to arrive, so the largest is the closest */
const samples = [];

/** From the time the server stamps on its pings. A ping stuck behind a burst of messages would otherwise set every countdown back */
export const setServerTime = (serverNow) => {
    samples.push(serverNow - Date.now());
    if (samples.length > 10) {
        samples.shift();
    }
    offset.value = Math.max(...samples);
};

/** The server's clock right now */
export const serverNow = () => Date.now() + offset.value;
