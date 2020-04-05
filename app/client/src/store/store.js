import Vue from "vue";
import Vuex from "vuex";
Vue.use(Vuex);


const store = {
    state: {
        user: {
            id: 0,
            username: '*Hamster0',
            money: 0,
            xp: 0,
            right: -1,
            data: {
                plugins: {
                    avatar: "https://risibank.fr/cache/stickers/d666/66604-thumb.png",
                    cursor: true,
                    moto: "",
                }
            }
        },
        connectedList: [],
        messages: [],
        currentVideo: null,
        typingList: [],
    },
    mutations: {
        SET_USER(state, user) {
            state.user = user;
        },
        SET_CONNECTED_LIST(state, users) {
            state.connectedList = users;
        },
        NEW_MESSAGE(state, message) {
            state.messages.push(message);
        },
        SET_CURRENT_VIDEO(state, currentVideo) {
            state.currentVideo = currentVideo;
        },
        SET_TYPING_LIST(state, users) {
            state.typingList = users;
        },
    }
};

export default new Vuex.Store(store);
