import Vue from "vue";
import SkychatApp from "./SkychatApp.vue";
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

Vue.prototype.$clipboard = ClipboardHelper;
Vue.prototype.$audio = AudioRecorder;
Vue.prototype.$store = store;
Vue.prototype.$noty = d => new Noty(d).show();
Vue.prototype.$mousetrap = new Mousetrap();

(async () => {

    // Init app & client
    await store.dispatch('App/init');
    await store.dispatch('SkyChatClient/init');

    new Vue({
        el: "#app",
        template: `<div id="root"><skychat-app/></div>`,
        components: { SkychatApp },
    });
})();
