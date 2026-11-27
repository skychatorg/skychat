import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import mousetrap from 'mousetrap';

import Toast from 'vue-toastification';
import 'vue-toastification/dist/index.css';

import 'vue-smart-suggest/lib/style.css';

import App from './App.vue';
import { useAppStore } from '@/stores/app';
import { startAnalytics } from '@/lib/analytics.js';
import { router } from './router.js';

import './icons';
// Served by SkyChat itself: no request to Google, and only the scripts a page uses are downloaded
import '@fontsource-variable/inter';
import './css/index.css';

(async () => {
    const app = createApp(App);

    // Init stores
    app.use(createPinia());
    const appStore = useAppStore();
    appStore.init();

    // Font Awesome
    // eslint-disable-next-line vue/multi-word-component-names
    app.component('Fa', FontAwesomeIcon);

    // Use router
    app.use(router);

    startAnalytics(router);

    // Mousetrap
    app.config.globalProperties.$mousetrap = mousetrap;
    app.provide('mousetrap', mousetrap);

    // Toast
    app.use(Toast, { position: 'top-center' });

    // Mount app
    app.mount('#app');
})();
