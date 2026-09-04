import { defineStore } from 'pinia';
import { useToast } from 'vue-toastification';
import { SkyChatClient } from '../../../api/index.ts';
import { WebPush } from '../lib/WebPush.js';
import { triggerWizz } from '../lib/wizz.js';
import { VoiceClient } from '../lib/voice/VoiceClient.js';
import { useAppStore } from './app';
import { useEncryptionStore } from './encryption';

// Connect to SkyChatClient
const protocol = document.location.protocol === 'http:' ? 'ws' : 'wss';
const url = protocol + '://' + document.location.host + '/api/ws';
const client = new SkyChatClient(url);

/**
 * How many messages are kept rendered. A tab left open in a busy room accumulates them for hours and
 * every one stays mounted, so the cost of rendering the room grows all session. Scrolling back up
 * re-fetches older ones from the server.
 */
const MAX_RENDERED_MESSAGES = 100;

// The voice engine holds non-reactive mediasoup objects; keep it at module scope (like `client`)
// so Pinia never proxies it.
let voiceClient = null;

export { client as apiClient };

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

        /**
         * Last message search results
         */
        messageSearch: {
            query: '',
            roomId: null,
            results: [],
        },

        /**
         * Whether a message search is in progress
         */
        messageSearchLoading: false,

        /**
         * Local-only voice UI state (mirrors VoiceClient internals for the template).
         */
        voice: {
            connected: false,
            muted: false,
            deafened: false,
            pushToTalk: false,
            inputDeviceId: null,
        },
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
            const encryptionStore = useEncryptionStore();
            // On global client state changed
            client.on('update', () => {
                // Room id changed
                if (this.state.currentRoomId !== client.state.currentRoomId) {
                    // Clear messages
                    this.messages = [];
                    this.messageSearch = { query: '', roomId: null, results: [] };
                    this.messageSearchLoading = false;
                }
                // Copy field by field, and let Vue skip the fields whose value did not actually
                // change. `client.state` is a fresh object on every server event, so assigning it
                // wholesale would re-render every component reading any part of it, several times a
                // second (one cursor move from one user is enough).
                const next = client.state;
                for (const key in next) {
                    this.state[key] = next[key];
                }
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
            client.on('message', async (message) => {
                const decrypted = await encryptionStore.decryptIncomingMessage(message);
                this.messages.push(decrypted);
            });

            // On new messages
            client.on('messages', async (messages) => {
                // Drop history of a room we already left (rapid switching)
                if (messages.length > 0 && messages[0].room !== client.state.currentRoomId) {
                    return;
                }
                // Filter messages we already have, if any
                messages = messages.filter((message) => message.id === 0 || !this.messages.find((m) => m.id === message.id));
                // Prepend new messages (we always get previous messages in this event)
                const decrypted = await Promise.all(messages.map((message) => encryptionStore.decryptIncomingMessage(message)));
                this.messages = decrypted.concat(this.messages);
            });

            client.on('message-search', async ({ roomId, query, results }) => {
                const decrypted = await Promise.all(results.map((message) => encryptionStore.decryptIncomingMessage(message)));
                this.messageSearch = { roomId, query, results: decrypted.toReversed() };
                this.messageSearchLoading = false;
            });

            // Message edit
            client.on('message-edit', async (message) => {
                const messageIndex = this.messages.findIndex((m) => m.id === message.id);
                if (messageIndex === -1) {
                    return;
                }
                const decrypted = await encryptionStore.decryptIncomingMessage(message);
                this.messages[messageIndex] = decrypted;
            });

            // Ask for push notification permission on user login
            client.on('set-user', async (user) => {
                if (!user.id) {
                    return;
                }

                try {
                    const subscription = await WebPush.register(import.meta.env.VAPID_PUBLIC_KEY);
                    if (subscription) {
                        client.sendMessage(`/push ${JSON.stringify(subscription)}`);
                    }
                } catch (error) {
                    console.error(error);
                    return;
                }
            });

            client.on('info', (info) => {
                if (String(info ?? '').trim()) {
                    useToast().info(info);
                }
            });
            client.on('error', (error) => {
                // Never render an empty toast: a red box with no text tells the user nothing
                const message = typeof error === 'string' ? error : error?.message ?? '';
                if (message.trim()) {
                    useToast().error(message);
                }
                this.messageSearchLoading = false;
            });
            client.on('discord-link', (url) => {
                window.open(url, '_blank', 'width=500,height=800');
            });
            client.on('wizz', () => {
                triggerWizz();
            });

            // Voice: start/stop the engine when our channel changes.
            let lastVoiceChannelId = null;
            client.on('update', () => {
                const id = client.state.currentVoiceChannelId;
                if (id === lastVoiceChannelId) {
                    return;
                }
                lastVoiceChannelId = id;
                if (id !== null && !voiceClient) {
                    const voiceSettings = useAppStore().voiceSettings;
                    voiceClient = new VoiceClient(client, {
                        onSpeaking: (userId, speaking) => client.setVoiceSpeaking(userId, speaking),
                        onStateChange: () => {
                            this.voice.muted = voiceClient?.muted ?? false;
                            this.voice.deafened = voiceClient?.deafened ?? false;
                            this.voice.pushToTalk = voiceClient?.pushToTalk ?? false;
                        },
                        onError: (msg) => useToast().error(msg),
                        // Seed the engine from persisted voice settings.
                        vadThreshold: voiceSettings.vadThreshold,
                        noiseGate: voiceSettings.inputMode === 'vad',
                        noiseGateHold: voiceSettings.noiseGateHold,
                    });
                    voiceClient.setPushToTalk(voiceSettings.inputMode === 'ptt');
                    this.voice.connected = true;
                    this.voice.pushToTalk = voiceSettings.inputMode === 'ptt';
                    // Default to unmuted on join. We can only open the mic without a click if the browser
                    // already granted mic access (returning users), so probe the permission first; otherwise
                    // stay listen-only to avoid firing a permission prompt just for joining.
                    this.voice.muted = true;
                    navigator.permissions
                        ?.query({ name: 'microphone' })
                        .then(async (status) => {
                            // Bail if the user left (or hopped channels) during the async probe.
                            if (status.state !== 'granted' || !voiceClient || this.state.currentVoiceChannelId !== id) {
                                return;
                            }
                            await this.voiceStartMic();
                            this.setVoiceMuted(false);
                        })
                        .catch(() => {});
                } else if (id === null && voiceClient) {
                    voiceClient.stop();
                    voiceClient = null;
                    this.voice = { connected: false, muted: false, deafened: false, pushToTalk: false, inputDeviceId: null };
                }
            });

            client.connect();
        },

        // ---- Voice actions (components never reach into voiceClient directly) ----
        joinVoice(channelId) {
            client.sendMessage(`/voicechannel join ${channelId}`);
        },
        leaveVoice() {
            if (this.state.currentVoiceChannelId !== null) {
                client.sendMessage(`/voicechannel leave ${this.state.currentVoiceChannelId}`);
            }
        },
        async voiceStartMic() {
            await voiceClient?.startMic();
        },
        setVoiceMuted(m) {
            voiceClient?.setMuted(m);
        },
        setVoiceDeafened(d) {
            voiceClient?.setDeafened(d);
        },
        setVoicePushToTalk(p) {
            voiceClient?.setPushToTalk(p);
        },
        setVoiceTalkKey(down) {
            voiceClient?.setTalkKey(down);
        },
        // Apply persisted voice settings to the live engine (called from the app store).
        applyVoiceInputMode(mode) {
            voiceClient?.setPushToTalk(mode === 'ptt');
            voiceClient?.setNoiseGate(mode === 'vad');
            this.voice.pushToTalk = mode === 'ptt';
        },
        applyVoiceVadThreshold(db) {
            voiceClient?.setVadThreshold(db);
        },
        applyVoiceNoiseGateHold(ms) {
            voiceClient?.setNoiseGateHold(ms);
        },
        async setVoiceInputDevice(id) {
            this.voice.inputDeviceId = id;
            await voiceClient?.setInputDevice(id);
        },
        setVoiceUserVolume(userId, vol) {
            voiceClient?.setUserVolume(userId, vol);
        },
        setVoiceUserLocallyMuted(userId, muted) {
            voiceClient?.setUserLocallyMuted(userId, muted);
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
         * Drop the oldest messages. Only safe to call while the pannel is scrolled to the bottom,
         * where the dropped ones are off-screen.
         */
        trimMessages: function () {
            if (this.messages.length > MAX_RENDERED_MESSAGES) {
                this.messages = this.messages.slice(-MAX_RENDERED_MESSAGES);
            }
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
        notifySeenMessage(messageId, roomId) {
            client.notifySeenMessage(messageId, roomId);
        },
        hasAccessToRoom(roomId) {
            return client.hasAccessToRoom(roomId);
        },
        hasUnreadMessages(roomId) {
            return client.hasUnreadMessages(roomId);
        },
        searchMessages(query) {
            const sanitizedQuery = query.trim();
            if (!sanitizedQuery) {
                return;
            }
            this.messageSearchLoading = true;
            this.messageSearch = {
                query: sanitizedQuery,
                roomId: this.state.currentRoomId,
                results: [],
            };
            client.sendMessage(`/messagesearch ${sanitizedQuery}`);
        },
        clearMessageSearch() {
            this.messageSearch = { query: '', roomId: null, results: [] };
            this.messageSearchLoading = false;
        },
    },
});
