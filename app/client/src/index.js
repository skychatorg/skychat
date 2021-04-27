import Vue from "vue";
import SkychatApp from "./vue/SkychatApp.vue";
import {SkyChatClient} from "./SkyChatClient";
import store from "./store";
import {AudioRecorder} from "./AudioRecorder";
import VModal from 'vue-js-modal';
import Mousetrap from "mousetrap";


Vue.use(VModal, {
    dynamic: true,
    injectModalsContainer: true,
    dynamicDefaults: {
        scrollable: true,
        height: '800px',
        width: '800px',
        adaptive: true,
    }
});

const client = new SkyChatClient(store);

Vue.prototype.$audio = AudioRecorder;

Vue.prototype.$store = store;

Vue.prototype.$client = client;
Vue.prototype.$client.connect();

Vue.prototype.$mousetrap = new Mousetrap();

const app = new Vue({
    el: "#app",
    template: `
    <div id="root">
        <skychat-app/>
    </div>
    `,
    components: {
        SkychatApp
    }
});

// Handle height on mobile phones
const resize = () => {
    document.body.style.height = window.innerHeight + 'px';
};
window.addEventListener('resize', resize);
resize();

// Handle document title update when new messages arrive
window.addEventListener('blur', () => {
    store.commit('BLUR');
});

window.addEventListener('focus', () => {
    if (store.state.lastMissedMessage) {
        client.notifySeenMessage(store.state.lastMissedMessage.id);
    }
    store.commit('FOCUS');
});
setInterval(() => {

    // In case the title is not currently blinking, just update it
    if (! store.state.documentTitleBlinking) {
        if (document.title !== store.state.documentTitle) {
            document.title = store.state.documentTitle;
        }
        return;
    }

    const chars = "┤┘┴└├┌┬┐";
    const indexOf = chars.indexOf(document.title[0]);
    const newPosition = (indexOf + 1) % chars.length;
    document.title = chars[newPosition] + ' ' + store.state.documentTitle;

}, 1000);
