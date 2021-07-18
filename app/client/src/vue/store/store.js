import Vue from "vue";
import Vuex from "vuex";
import createLogger from 'vuex/dist/logger';

import Main from './Main.store';

Vue.use(Vuex);


const debug = process.env.NODE_ENV !== 'production';

export default new Vuex.Store({
    modules: { Main },
    strict: debug,
    plugins: debug? [ createLogger() ] : [],
});
