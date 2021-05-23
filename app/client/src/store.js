import Vue from "vue";
import Vuex from "vuex";
Vue.use(Vuex);


const DEFAULT_DOCUMENT_TITLE = "~ SkyChat";

const CURSOR_DECAY_DELAY = 5 * 1000; // Must match value from backend

const CURRENT_VERSION = 1;
const STORE_SAVED_KEYS = ['playerEnabled'];


const store = {
    state: {
        focused: true,
        documentTitle: DEFAULT_DOCUMENT_TITLE,
        documentTitleBlinking: false,
        page: 'welcome',
        mobileCurrentPage: 'middle',
        config: null,
        rooms: [],
        cinemaMode: false,
        channel: null,
        connectionState: WebSocket.CLOSED,
        user: {
            id: 0,
            username: '*Guest',
            money: 0,
            xp: 0,
            right: -1,
            data: {
                plugins: {
                    avatar: "",
                    cursor: true,
                    motto: "",
                    yt: null,
                }
            }
        },

        currentRoom: null,
        
        connectedList: [],

        /**
         * Mapping from message ids to users whose last seen message id is this message.
         * Generated from the list of connected users.
         */
        lastMessageSeenIds: {},

        /**
         * Mapping from room ids to users connected to this room.
         * Generated from the list of connected users.
         */
        roomConnectedUsers: {},

        /**
         * Mapping from player channel ids to users connected to this channel.
         * Generated from the list of connected users.
         */
        playerChannelUsers: {},

        /**
         * Last message missed because the windows was not focused, if any
         */
        lastMissedMessage: null,

        /**
         * Gallery info
         */
        gallery: null,
        gallerySearchResults: { folders: [] },

        cursors: {},
        messages: [],
        privateMessages: {},
        playerEnabled: false,
        typingList: [],
        polls: [],
        pollResult: null,
        
        playerApiSearchResult: {},
        playerChannels: [],
        playerChannel: null,
        playerState: {
            current: null,
            queue: [],
            cursor: 0,
        },
    },
    mutations: {
        LOAD_LOCALSTORAGE(state) {
            // If local storage not implemented
            if (! localStorage) {
                return;
            }
            // Load item from local storage
            const preferences = JSON.parse(localStorage.getItem('preferences')) || {version: 0, values: {}};
            // If saved local storage is obsolete
            if (preferences.version !== CURRENT_VERSION) {
                return;
            }
            // Load values from local storage
            for (const key of STORE_SAVED_KEYS) {
                if (typeof preferences.values[key] !== 'undefined') {
                    Vue.set(state, key, preferences.values[key]);
                }
            }
        },
        SAVE_LOCALSTORAGE(state) {
            // If local storage not implemented
            if (! localStorage) {
                return;
            }
            // Save preferences
            localStorage.setItem('preferences', JSON.stringify({
                version: CURRENT_VERSION,
                values: Object.fromEntries(STORE_SAVED_KEYS.map(key => [key, state[key]])),
            }));
        },
        FOCUS(state) {
            state.focused = true;
            state.documentTitle = DEFAULT_DOCUMENT_TITLE;
            state.documentTitleBlinking = false;
            state.lastMissedMessage = null;
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
        TOGGLE_CINEMA_MODE(state) {
            state.cinemaMode = ! state.cinemaMode;
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
        SET_CONFIG(state, config) {
            state.config = config;
        },
        SET_ROOM_LIST(state, rooms) {
            state.rooms = rooms;
        },
        SET_CONNECTION_STATE(state, connectionState) {
            state.connectionState = connectionState;
        },
        SET_CURRENT_ROOM(state, currentRoom) {
            if (currentRoom !== state.currentRoom) {
                state.currentRoom = currentRoom;
                state.messages = [];
            }
        },
        SET_USER(state, user) {
            state.user = user;
        },
        SET_CONNECTED_LIST(state, entries) {
            state.connectedList = entries;

            // Update hash list of last message seen ids
            this.commit('GENERATE_LAST_MESSAGE_SEEN_IDS');
            this.commit('GENERATE_ROOM_CONNECTED_COUNTS');

            // Update self entry
            const selfEntry = entries.find(entry => entry.user.username === state.user.username);
            if (! selfEntry) {
                return;
            }
            this.commit('SET_USER', selfEntry.user);
        },
        MESSAGE_SEEN(state, data) {
            const entry = state.connectedList.find(e => e.user.id === data.user);
            if (! entry) {
                return;
            }
            entry.user.data.plugins.lastseen = data.data;
            this.commit('GENERATE_LAST_MESSAGE_SEEN_IDS');
        },
        GENERATE_LAST_MESSAGE_SEEN_IDS(state) {
            // Update last seen message ids
            const lastSeen = {};
            const roomId = state.currentRoom;
            for (const entry of state.connectedList) {
                const entries = entry.user.data.plugins.lastseen;
                if (! entries || ! entries[roomId]) {
                    continue;
                }
                const lastSeenId = entries[roomId];
                if (typeof lastSeen[lastSeenId] === 'undefined') {
                    lastSeen[lastSeenId] = [];
                }
                lastSeen[lastSeenId].push(entry.user);
            }
            state.lastMessageSeenIds = lastSeen;
        },
        GENERATE_ROOM_CONNECTED_COUNTS(state) {
            const roomConnectedUsers = {};
            const playerChannelUsers = {};
            for (const entry of state.connectedList) {

                // Update room entries
                for (const roomId of entry.rooms) {
                    if (typeof roomConnectedUsers[roomId] === 'undefined') {
                        roomConnectedUsers[roomId] = [];
                    }
                    roomConnectedUsers[roomId].push(entry.user);
                }

                // Update player channel entries
                const playerChannelId = entry.user.data.plugins.player;
                if (playerChannelId !== null) {
                    if (typeof playerChannelUsers[playerChannelId] === 'undefined') {
                        playerChannelUsers[playerChannelId] = [];
                    }
                    playerChannelUsers[playerChannelId].push(entry.user);
                }
            }
            state.roomConnectedUsers = roomConnectedUsers;
            state.playerChannelUsers = playerChannelUsers;
        },
        NEW_MESSAGE(state, message) {
            state.messages.push(message);
            if (! state.focused) {
                state.documentTitle = `New message by ${message.user.username}`;
                state.documentTitleBlinking = true;
                state.lastMissedMessage = message;
            }
            if (message.content.match(new RegExp('@' + state.user.username.toLowerCase(), 'i'))) {
                new Audio('/assets/sound/notification.mp3').play();
            }
        },
        NEW_MESSAGES(state, messages) {
            if (messages.length === 0) {
                return;
            }
            state.messages.push(...messages);
            const lastMessage = messages[messages.length - 1];
            if (! state.focused) {
                state.documentTitle = `New message by ${lastMessage.user.username}`;
                state.documentTitleBlinking = true;
                state.lastMissedMessage = lastMessage;
            }
            if (lastMessage.content.match(new RegExp('@' + state.user.username.toLowerCase(), 'i'))) {
                new Audio('/assets/sound/notification.mp3').play();
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
                state.documentTitle = `New message by ${privateMessage.user.username}`;
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
        SET_GALLERY(state, gallery) {
            state.gallery = gallery;
        },
        SET_GALLERY_SEARCH_RESULTS(state, gallerySearchResults) {
            state.gallerySearchResults = gallerySearchResults;
        },
        SET_PLAYER_STATE(state, playerState) {
            state.playerState = playerState;
        },
        SET_PLAYER_ENABLED(state, playerEnabled) {
            state.playerEnabled = playerEnabled;
            this.commit('SAVE_LOCALSTORAGE');
        },
        SET_POLLS(state, polls) {
            if (polls.length > state.polls.length) {
                new Audio('/assets/sound/new-poll.ogg').play();
            }
            state.polls = polls;
        },
        SET_POLL_RESULT(state, pollResult) {
            state.pollResult = pollResult;
        },
        CLEAR_POLL_RESULT(state) {
            state.pollResult = null;
        },
        SET_TYPING_LIST(state, users) {
            state.typingList = users;
        },
        NEW_CURSOR(state, cursor) {
            const identifier = cursor.user.username.toLowerCase();
            if (identifier === state.user.username.toLowerCase()) {
                return;
            }
            Vue.set(state.cursors, identifier, {date: new Date(), cursor});
            // Clean up the cursors
            if (Math.random() < 0.1) {
                for (const identifier in state.cursors) {
                    const entry = state.cursors[identifier];
                    if (new Date().getTime() - entry.date.getTime() > CURSOR_DECAY_DELAY) {
                        delete state.cursors[identifier];
                    }
                }
            }
        },
        SET_ROLL_STATE(state, rollState) {
            if (state.rollState === rollState) {
                return;
            }
            state.rollState = rollState;

            if (rollState) {
                const rollSound = new Audio('/assets/sound/roll.ogg');
                rollSound.load();
                setTimeout(() => rollSound.play(), 100);
            } else {

                const rollEndSound = new Audio('/assets/sound/roll-end.ogg');
                rollEndSound.play();
            }
        },
        SET_PLAYER_API_SEARCH_RESULTS(state, result) {
            state.playerApiSearchResult = result;
        },

        SET_PLAYER_CHANNELS(state, channels) {
            state.playerChannels = channels;
        },

        SET_PLAYER_CHANNEL(state, channelId) {
            state.playerChannel = channelId;
        }
    }
};

export default new Vuex.Store(store);
