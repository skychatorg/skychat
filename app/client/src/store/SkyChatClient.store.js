import { SkyChatClient } from '../../../../build/client.js';


// Connect to SkyChatClient
const client = new SkyChatClient();


// State object
const state = {

    /**
     * Accumulated client state from SkyChatClient
     */
    clientState: client.state,

    /**
     * Messages that are currently shown in the chat
     */
    messages: [],
}

// Getter functions
const getters = {
    
    clientState: state => state.clientState,
    messages: state => state.messages,
};

// Actions 
const actions = {

    /**
     * Initialize client (subscribe to relevant events) & make initial socket connection
     */
    init: ({ commit }) => {
        client.on('update', () => commit('setClientState', client.state));
        client.on('message', message => commit('addMessage', message));
        client.on('messages', messages => commit('addMessages', messages));
        client.on('message-edit', message => commit('editMessage', message));
        client.on('info', info => {
            new Noty({
                type: 'info',
                layout: 'topCenter',
                theme: 'nest',
                text: info,
                timeout: 6 * 1000
            }).show();
        });
        client.on('error', error => {
            new Noty({
                type: 'error',
                layout: 'topCenter',
                theme: 'nest',
                text: error,
                timeout: 6 * 1000
            }).show();
        });

        const protocol = document.location.protocol === 'http:' ? 'ws' : 'wss';
        const url = protocol + '://' + document.location.host;
        client.connect(url);
    },

    /**
     * Join a given room
     * @param {number} roomId 
     */
    join: ({ }, roomId) => {
        client.join(roomId);
    },

    /**
     * Login
     * @param {string} username 
     * @param {string} password 
     */
    login: ({ }, { username, password }) => {
        client.login(username, password);
    },

    /**
     * Logout
     */
    logout: ({ }) => {
        client.logout();
    },

    /**
     * Register
     */
    register: ({ }, { username, password }) => {
        client.register(username, password);
    },

    /**
     * Send a message to the server
     * @param {string} message
     */
    sendMessage: ({ }, message) => {
        client.sendMessage(message);
    },

    /**
     * Send a raw message (blob, binary data) to the server
     * @param {*} data
     */
    sendRaw: ({ }, data) => {
        client.sendRaw(data);
    }
};

// Mutations
const mutations = {

    setClientState: (state, clientState) => {
        // Room id changed
        if (state.clientState.roomId !== clientState.roomId) {
            // Clear messages
            state.messages = [];
        }
        state.clientState = clientState;
    },

    addMessage(state, message) {
        state.messages.push(message);
        // TODO: Moe this to App?
        if (message.content.match(new RegExp('@' + state.clientState.user.username.toLowerCase(), 'i'))) {
            new Audio('/assets/sound/notification.mp3').play();
        }
    },

    addMessages(state, messages) {
        state.messages.push(...messages);
        // TODO: Moe this to App?
        if (messages.find(message => message.content.match(new RegExp('@' + state.clientState.user.username.toLowerCase(), 'i')))) {
            new Audio('/assets/sound/notification.mp3').play();
        }
    },

    editMessage(state, message) {
        const messageIndex = state.messages.findIndex(m => m.id === message.id);
        if (messageIndex === -1) {
            return;
        }
        Vue.set(state.messages, messageIndex, message);
    },
};

export default { namespaced: true, state, getters, actions, mutations };
