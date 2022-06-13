import { useToast } from "vue-toastification";
import { defineStore } from 'pinia'
import { SkyChatClient } from '../../../api/client.ts';

// Connect to SkyChatClient
const client = new SkyChatClient();


export const useClientStore = defineStore('client', {

    state: () => ({

        /**
         * Accumulated client state from SkyChatClient
         */
        state: client.state,

        /**
         * Messages that are currently shown in the chat
         */
        messages: [],
    }),

    actions: {

        /**
         * Initialize client (subscribe to relevant events) & make initial socket connection
         */
        init: function() {

            // On global client state changed
            client.on('update', () => {
                // Room id changed
                if (this.state.roomId !== client.state.roomId) {
                    // Clear messages
                    this.messages = [];
                }
                this.state = client.state;
            });

            // On new message
            client.on('message', message => {
                this.messages.push(message);
                // TODO: Moe this to App?
                if (message.content.match(new RegExp('@' + this.state.user.username.toLowerCase(), 'i'))) {
                    new Audio('/assets/sound/notification.mp3').play();
                }
            });

            // On new messages
            client.on('messages', messages => {
                this.messages.push(...messages);
                // TODO: Moe this to App?
                if (messages.find(message => message.content.match(new RegExp('@' + this.state.user.username.toLowerCase(), 'i')))) {
                    new Audio('/assets/sound/notification.mp3').play();
                }
            });

            // Message edit
            client.on('message-edit', message => {
                const messageIndex = this.messages.findIndex(m => m.id === message.id);
                if (messageIndex === -1) {
                    return;
                }
                Vue.set(this.messages, messageIndex, message);
            });

            client.on('info', info => {
                const toast = useToast();
                toast.info(info);
            });
            client.on('error', error => {
                const toast = useToast();
                toast.error(error);
            });
            const protocol = document.location.protocol === 'http:' ? 'ws' : 'wss';
            //const url = protocol + '://' + document.location.host;
            // TODO: fix
            const url = 'ws://localhost:8081';
            client.connect(url);
        },

        /**
         * Join a given room
         * @param {number} roomId 
         */
        join: function(roomId) {
            this.messages = [];
            client.join(roomId);
        },

        /**
         * Login
         * @param {string} username 
         * @param {string} password 
         */
        login: ({ username, password }) => {
            client.login(username, password);
        },

        /**
         * Logout
         */
        logout: () => {
            client.logout();
        },

        /**
         * Register
         */
        register: ({ username, password }) => {
            client.register(username, password);
        },

        /**
         * Send a message to the server
         * @param {string} message
         */
        sendMessage: (message) => {
            client.sendMessage(message);
        },

        /**
         * Send a raw message (blob, binary data) to the server
         * @param {*} data
         */
        sendRaw: (data) => {
            client.sendRaw(data);
        },

        /**
         * Send a last message seen notification
         * @param messageId
         */
        notifySeenMessage(messageId) {
            client.notifySeenMessage(messageId);
        },
    },
});
