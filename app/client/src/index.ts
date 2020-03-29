import Vue from "vue";
import {Page} from "./view/page";
//import {SkyChatClient} from "./skychat/SkyChatClient";

console.log(Page);
const vueApp = new Vue({
    el: '#app',
    components: {
        'page': Page
    }
});

//const client = new SkyChatClient({host: 'localhost', port: 8080});
//client.connect();
