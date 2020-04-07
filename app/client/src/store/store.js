import Vue from "vue";
import Vuex from "vuex";
Vue.use(Vuex);


const DEFAULT_DOCUMENT_TITLE = "~ SkyChat";

const store = {
    state: {
        focused: true,
        documentTitle: DEFAULT_DOCUMENT_TITLE,
        documentTitleBlinking: false,
        page: 'welcome',
        mobileCurrentPage: 'tchat',
        channel: null,
        connectionState: WebSocket.CLOSED,
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
        privateMessages: {},
        currentVideo: null,
        typingList: [],
    },
    mutations: {
        FOCUS(state) {
            state.focused = true;
            state.documentTitle = DEFAULT_DOCUMENT_TITLE;
            state.documentTitleBlinking = false;
        },
        BLUR(state) {
            state.focused = false;
        },
        SET_PAGE(state, page) {
            state.page = page;
        },
        SET_MOBILE_PAGE(state, mobilePage) {
            state.mobileCurrentPage = mobilePage;
        },
        SET_CHANNEL(state, channelName) {
            channelName = channelName.toLowerCase();
            if (typeof state.privateMessages[channelName] === 'undefined') {
                Vue.set(state.privateMessages, channelName, {unreadCount: 0, messages: []});
            }
            state.channel = channelName;
            state.privateMessages[channelName].unreadCount = 0;
        },
        GOTO_MAIN_CHANNEL(state) {
            state.channel = null;
        },
        SET_CONNECTION_STATE(state, connectionState) {
            state.connectionState = connectionState;
        },
        SET_USER(state, user) {
            state.user = user;
        },
        SET_CONNECTED_LIST(state, users) {
            state.connectedList = users;
        },
        NEW_MESSAGE(state, message) {
            state.messages.push(message);
            if (! state.focused) {
                state.documentTitle = `New message by ${message.user.username}`;
                state.documentTitleBlinking = true;
            }
        },
        NEW_PRIVATE_MESSAGE(state, privateMessage) {
            const fromUserName = privateMessage.user.username.toLowerCase();
            const toUserName = privateMessage.to.username.toLowerCase();
            const otherUserName = (fromUserName === state.user.username.toLowerCase() ? toUserName : fromUserName).toLowerCase();

            if (typeof state.privateMessages[otherUserName] === 'undefined') {
                Vue.set(state.privateMessages, otherUserName, {unreadCount: 0, messages: []});
            }
            state.privateMessages[otherUserName].messages.push(privateMessage);
            if (state.channel !== otherUserName) {
                state.privateMessages[otherUserName].unreadCount ++;
            }
            if (! state.focused) {
                state.documentTitle = `New message by ${message.user.username}`;
                state.documentTitleBlinking = true;
            }
        },
        MESSAGE_EDIT(state, message) {
            const oldMessageIndex = state.messages.findIndex(m => m.id === message.id);
            if (oldMessageIndex === -1) {
                return;
            }
            Vue.set(state.messages, oldMessageIndex, message);
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
