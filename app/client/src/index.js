import Vue from "vue";
import MainPage from "./components/MainPage.vue";
import {SkyChatClient} from "./skychat/SkyChatClient";
import store from "./store/store";


Vue.prototype.$store = store;

Vue.prototype.$client = new SkyChatClient(store);
Vue.prototype.$client.connect();

const app = new Vue({
    el: "#app",
    template: `
    <div id="root">
        <main-page/>
    </div>
    `,
    components: {
        MainPage
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

}, 300);
