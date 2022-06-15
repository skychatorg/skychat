import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createWebHashHistory } from 'vue-router';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { vfmPlugin } from 'vue-final-modal';


import Toast from "vue-toastification";
// Import the CSS or use your own!
import "vue-toastification/dist/index.css";

import App from './App.vue';
import Home from '@/views/Home.vue';
import Chat from '@/views/Chat.vue';
import { useAppStore } from '@/stores/app';

import library from './icons';
import './index.css';



(async () => {
    const app = createApp(App);

    // Init router
    const router = createRouter({
        history: createWebHashHistory(),
        routes: [
            { name: 'home', path: '/', component: Home },
            { name: 'app', path: '/app', component: Chat },
        ],
    });

    // Init stores
    app.use(createPinia());
    const appStore = useAppStore();
    appStore.init();

    // Font Awesome
    app.component('fa', FontAwesomeIcon)
    
    // Use router
    app.use(router);

    // Other utilities
    app.use(vfmPlugin);
    app.use(Toast, { position: 'top-center' });

    // Better way of doing this?
    router.push('/');

    // Mount app
    app.mount('#app');
})();
