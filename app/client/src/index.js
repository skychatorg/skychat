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
    <div>
        <main-page/>
    </div>
    `,
    components: {
        MainPage
    }
});
