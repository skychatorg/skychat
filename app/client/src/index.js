import Vue from "vue";
import SkychatApp from "./SkychatApp.vue";
import { SkyChatClient } from "./lib/SkyChatClient";
import store from "./store";
import { AudioRecorder } from "./lib/AudioRecorder";
import VModal from 'vue-js-modal';
import Mousetrap from "mousetrap";
import { ClipboardHelper } from "./lib/ClipboardHelper";


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

store.dispatch('SkyChatClient/init');
store.dispatch('App/loadPreferences');

Vue.prototype.$clipboard = ClipboardHelper;
Vue.prototype.$audio = AudioRecorder;
Vue.prototype.$store = store;
Vue.prototype.$noty = d => new Noty(d).show();
Vue.prototype.$mousetrap = new Mousetrap();

new Vue({
    el: "#app",
    template: `<div id="root"><skychat-app/></div>`,
    components: { SkychatApp },
});

// Handle height on mobile phones
const resize = () => {
    document.body.style.height = window.innerHeight + 'px';
};
window.addEventListener('resize', resize);
resize();

// Handle document title update when new messages arrive
window.addEventListener('blur', () => {
    store.commit('App/blur');
});

window.addEventListener('focus', () => {
    if (store.state.App.missedMessages.length > 0) {
        client.notifySeenMessage(store.state.App.missedMessages[store.state.App.missedMessages.length - 1].id);
    }
    store.dispatch('App/focus');
});
setInterval(() => {

    // In case the title is not currently blinking, just update it
    if (! store.state.App.documentTitleBlinking) {
        if (document.title !== store.state.App.documentTitle) {
            document.title = store.state.App.documentTitle;
        }
        return;
    }

    const chars = "┤┘┴└├┌┬┐";
    const indexOf = chars.indexOf(document.title[0]);
    const newPosition = (indexOf + 1) % chars.length;
    document.title = chars[newPosition] + ' ' + store.state.App.documentTitle;

}, 1000);
