import Vue from "vue";
import MainPage from "./components/MainPage.vue";
import {SkyChatClient} from "./skychat/SkyChatClient";
import {store} from "./store/store";


Vue.prototype.$store = store;
Vue.prototype.$client = new SkyChatClient({host: 'localhost', port: 8080});

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
