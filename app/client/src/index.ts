import Vue from "vue";
import HelloComponent from "./components/Hello.vue";

const app = new Vue({
    el: "#app",
    template: `
    <div>
        <hello-component/>
    </div>
    `,
    data: { name: "World" },
    components: {
        HelloComponent
    }
});
