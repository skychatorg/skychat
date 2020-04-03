import Vue from "vue";
import HelloComponent from "./components/Hello.vue";
import {SkyChatClient} from "./skychat/SkyChatClient";
import {store} from "./store/store";


Vue.prototype.$store = store;
Vue.prototype.$client = new SkyChatClient({host: 'localhost', port: 8080});

const app = new Vue({
    el: "#app",
    template: `
    <div>
        <hello-component/>
    </div>
    `,
    components: {
        HelloComponent
    }
});
