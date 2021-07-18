import Vue from "vue";
import SkychatApp from "./vue/SkychatApp.vue";
import { SkyChatClient } from "./SkyChatClient";
import store from "./vue/store";
import { AudioRecorder } from "./AudioRecorder";
import VModal from 'vue-js-modal';
import Mousetrap from "mousetrap";
import { ClipboardHelper } from "./ClipboardHelper";


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

store.commit('Main/LOAD_LOCALSTORAGE');

const client = new SkyChatClient(store);

Vue.prototype.$clipboard = ClipboardHelper;

Vue.prototype.$audio = AudioRecorder;

Vue.prototype.$store = store;

Vue.prototype.$noty = d => new Noty(d).show();

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
    store.commit('Main/BLUR');
});

window.addEventListener('focus', () => {
    if (store.state.Main.lastMissedMessage) {
        client.notifySeenMessage(store.state.Main.lastMissedMessage.id);
    }
    store.commit('Main/FOCUS');
});
setInterval(() => {

    // In case the title is not currently blinking, just update it
    if (! store.state.Main.documentTitleBlinking) {
        if (document.title !== store.state.Main.documentTitle) {
            document.title = store.state.Main.documentTitle;
        }
        return;
    }

    const chars = "┤┘┴└├┌┬┐";
    const indexOf = chars.indexOf(document.title[0]);
    const newPosition = (indexOf + 1) % chars.length;
    document.title = chars[newPosition] + ' ' + store.state.Main.documentTitle;

}, 1000);
