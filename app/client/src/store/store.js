import Vue from "vue";
import Vuex from "vuex";
import createLogger from 'vuex/dist/logger';

import AppStore from './App.store';
import SkyChatClientStore from './SkyChatClient.store';

Vue.use(Vuex);


const debug = process.env.NODE_ENV !== 'production';

export default new Vuex.Store({
    modules: { App: AppStore, SkyChatClient: SkyChatClientStore },
    strict: debug,
    plugins: debug? [ createLogger() ] : [],
});
