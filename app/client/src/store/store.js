import Vue from "vue";
import Vuex from "vuex";
import createLogger from 'vuex/dist/logger';

import MainStore from './Main.store';
import SkyChatClientStore from './SkyChatClient.store';

Vue.use(Vuex);


const debug = process.env.NODE_ENV !== 'production';

export default new Vuex.Store({
    modules: { MainStore, SkyChatClientStore },
    strict: debug,
    plugins: debug? [ createLogger() ] : [],
});
