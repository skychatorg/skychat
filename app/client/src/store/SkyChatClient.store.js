import { SkyChatClient } from '../../../api/client.ts';

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
        client.on('state', () => {
            commit('setClientState', client.state);
        });
        client.on('message', (message) => {
            commit('addMessage', message);
        });
        client.on('messages', (messages) => {
            commit('addMessages', messages);
        });
        client.on('message-edit', (message) => {
            commit('editMessage', message);
        });
        client.connect();
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
        // TODO: Handle quote
        // if (message.content.match(new RegExp('@' + state.user.username.toLowerCase(), 'i'))) {
        //     new Audio('/assets/sound/notification.mp3').play();
        // }
    },

    addMessages(state, messages) {
        state.messages.push(...messages);
        // TODO: Handle quote
        // if (messages.find(message => message.content.match(new RegExp('@' + state.user.username.toLowerCase(), 'i')))) {
        //     new Audio('/assets/sound/notification.mp3').play();
        // }
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
