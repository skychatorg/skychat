import { defineStore } from 'pinia';
import { useToast } from 'vue-toastification';
import { SkyChatClient } from '../../../api/index.ts';

// Connect to SkyChatClient
const protocol = document.location.protocol === 'http:' ? 'ws' : 'wss';
const url = protocol + '://' + document.location.host + '/ws';
const client = new SkyChatClient(url);

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

    getters: {
        /**
         * Track only the last received message. Useful to be used in a watcher.
         */
        lastMessage: (state) => state.messages[state.messages.length - 1] || null,
    },

    actions: {
        /**
         * Initialize client (subscribe to relevant events) & make initial socket connection
         */
        init: function () {
            // On global client state changed
            client.on('update', () => {
                // Room id changed
                if (this.state.roomId !== client.state.roomId) {
                    // Clear messages
                    this.messages = [];
                }
                this.state = client.state;
            });

            // Audio received
            client.on('audio', ({ id, blob }) => {
                // Try and find the message that corresponds to the audio
                const message = this.messages.find((message) => message.id === id);
                if (!message) {
                    console.warn(`Could not find message with id ${id}, audio will be played directly.`);
                    // Play audio blob directly
                    const audio = new Audio(URL.createObjectURL(blob));
                    audio.play();
                    return;
                }
                // Update the message with the audio blob
                message.formatted = `
                    <audio class="skychat-audio-tag" controls autoplay>
                        <source src="${URL.createObjectURL(blob)}" type="audio/wav">
                        Your browser does not support the audio element.
                    </audio>
                `;
            });

            // On new message
            client.on('message', (message) => {
                this.messages.push(message);
            });

            // On new messages
            client.on('messages', (messages) => {
                // Filter messages we already have, if any
                messages = messages.filter((message) => message.id === 0 || !this.messages.find((m) => m.id === message.id));
                // Prepend new messages (we always get previous messages in this event)
                this.messages = messages.concat(this.messages);
            });

            // Message edit
            client.on('message-edit', (message) => {
                const messageIndex = this.messages.findIndex((m) => m.id === message.id);
                if (messageIndex === -1) {
                    return;
                }
                this.messages[messageIndex] = message;
            });

            client.on('info', (info) => {
                const toast = useToast();
                toast.info(info);
            });
            client.on('error', (error) => {
                const toast = useToast();
                toast.error(error);
            });
            client.connect();
        },

        /**
         * Join a given room
         * @param {number} roomId
         */
        join: function (roomId) {
            this.messages = [];
            client.join(roomId);
        },

        /**
         * Load previous messages
         */
        loadPreviousMessages: function () {
            // Find first message with non-zero id,
            // Because we need to give this reference to the server to get messages prior to it
            const realMessage = this.messages.find((m) => m.id);
            if (!realMessage) {
                return false;
            }
            this.sendMessage('/messagehistory ' + realMessage.id);
        },

        authAsGuest: () => {
            return client.authAsGuest();
        },
        login: ({ username, password, roomId }) => {
            return client.login(username, password, roomId);
        },
        logout: () => {
            client.logout();
        },
        register: ({ username, password, roomId }) => {
            return client.register(username, password, roomId);
        },
        sendMessage: (message) => {
            client.sendMessage(message);
        },
        sendAudio: (blob) => {
            client.sendAudio(blob);
        },
        sendCursorPosition: (x, y) => {
            client.sendCursorPosition(x, y);
        },
        notifySeenMessage(messageId) {
            client.notifySeenMessage(messageId);
        },
        hasAccessToRoom(roomId) {
            return client.hasAccessToRoom(roomId);
        },
        hasUnreadMessages(roomId) {
            return client.hasUnreadMessages(roomId);
        },
    },
});
