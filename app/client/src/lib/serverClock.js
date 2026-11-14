import { ref } from 'vue';

/** The server's clock minus this machine's, in ms. Machine clocks drift apart by seconds, so countdowns to server instants use the server's time */
const offset = ref(0);

/** From the time the server stamps on its pings */
export const setServerTime = (serverNow) => (offset.value = serverNow - Date.now());

/** The server's clock right now */
export const serverNow = () => Date.now() + offset.value;
