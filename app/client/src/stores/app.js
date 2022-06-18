import { watch } from 'vue';
import { defineStore } from 'pinia'
import { useClientStore } from './client';
import { useToast } from 'vue-toastification';
import mousetrap from 'mousetrap';


const DEFAULT_DOCUMENT_TITLE = "~ SkyChat";

const CURRENT_VERSION = 5;
const STORE_SAVED_KEYS = [
    'playerMode',
];

const toast = useToast();

export const useAppStore = defineStore('app', {

    state: () => ({

        /**
         * Whether the window is currently focused
         */
        focused: true,
    
        /**
         * Current document title & whether it's blinking
         */
        documentTitle: {
            value: DEFAULT_DOCUMENT_TITLE,
            blinking: false,
        },

        /**
         * Player mode
         */
        playerMode: {
    
            /**
             * Whether the player is on/off
             * @type {Boolean}
             */
            enabled: true,

            /**
             * Current player size
             * @type {'xs'|'sm'|'md'|'lg'}
             */
            size: 'md',

            /**
             * Whether the queue should be shown
             * @type {Boolean}
             */
            queueEnabled: false,

            /**
             * Whether currently in cinema mode
             * @type {Boolean}
             */
            cinemaMode: false,
        },
    
        /**
         * List of missed messages, that were missed because the window was not focused
         */
        missedMessages: [],

        /**
         * New message being typed
         */
        newMessage: '',

        /**
         * Current shown view on mobile devices
         * @type {'left'|'middle'|'right'}
         */
        mobileView: 'middle',
    }),

    actions: {

        init: function() {

            this.loadPreferences();
            
            const clientStore = useClientStore();
            clientStore.init();
            
            // Handle height on mobile phones
            const resize = () => {
                document.body.style.height = window.innerHeight + 'px';
            };
            window.addEventListener('resize', resize);
            resize();

            // Handle file upload on paste
            const fileUpload = async event => {
                const files = event.clipboardData.files;
                for (const file of files) {
                    await this.upload(file);
                }
            };
            window.addEventListener('paste', fileUpload);
            
            // Handle document title update when new messages arrive
            window.addEventListener('blur', () => this.blur());
            window.addEventListener('focus', () => this.focus());

            // Auto-check document title every second
            setInterval(() => {

                // In case the title is not currently blinking, just update it
                if (! this.documentTitle.blinking) {
                    if (document.title !== this.documentTitle.value) {
                        document.title = this.documentTitle.value;
                    }
                    return;
                }
            
                const chars = "┤┘┴└├┌┬┐";
                const indexOf = chars.indexOf(document.title[0]);
                const newPosition = (indexOf + 1) % chars.length;
                document.title = chars[newPosition] + ' 🔔 ' + this.documentTitle.value;
            }, 1000);

            // Listen for own state change
            watch(() => this.newMessage, (newMessage, oldMessage) => {
                // Now typing
                if (newMessage.length > 0 && oldMessage.length === 0) {
                    clientStore.sendMessage(`/t on`);
                }
                // Stop typing
                if (newMessage.length === 0 && oldMessage.length > 0) {
                    clientStore.sendMessage(`/t off`);
                }
            });

            // Listen for when the last received message changed
            watch(() => clientStore.lastMessage, message => {

                // If no message
                if (! message) {
                    return;
                }

                // Quoted?
                if (message.content.match(new RegExp('@' + clientStore.state.user.username.toLowerCase(), 'i'))) {
                    new Audio('/assets/sound/notification.mp3').play();
                }

                // If app is not focused, create notification
                if (! this.focused) {
                    this.documentTitle.value = `${message.user.username}: ${message.content.substr(0, 8) + '...'}`;
                    this.documentTitle.blinking = true;
                    return;
                }

                // Send last seen notification
                clientStore.notifySeenMessage(message.id);
            });

            // Watch for new polls
            watch(() => Object.keys(clientStore.state.polls).length, (newLength, oldLength) => {
                if (newLength > oldLength) {
                    new Audio('/assets/sound/new-poll.ogg').play();
                }
            });

            // Bind keys

            // ARROW + SHIFT + UP/DOWN: Switch player sizes
            mousetrap.bind('shift+down', () => this.expandPlayer());
            mousetrap.bind('shift+up', () => this.shrinkPlayer());
            
            // ARROW + ALT + UP/DOWN: Switch rooms
            mousetrap.bind('alt+down', () => {
                const newRoomIndex = (clientStore.state.rooms.indexOf(clientStore.state.currentRoom) + 1) % clientStore.state.rooms.length;
                clientStore.join(clientStore.state.rooms[newRoomIndex].id);
            });
            mousetrap.bind('alt+up', () => {
                let newRoomIndex = (clientStore.state.rooms.indexOf(clientStore.state.currentRoom) - 1);
                if (newRoomIndex < 0) {
                    newRoomIndex = clientStore.state.rooms.length - 1;
                }
                clientStore.join(clientStore.state.rooms[newRoomIndex].id);
            });
        },
        
        loadPreferences: function() {
            // If local storage not available
            if (typeof localStorage === 'undefined') {
                return;
            }
            // Load item from local storage
            const preferences = JSON.parse(localStorage.getItem('preferences')) || { version: 0, values: {} };
            // If saved local storage is obsolete
            if (preferences.version !== CURRENT_VERSION) {
                return;
            }
            // Load values from local storage
            for (const key of STORE_SAVED_KEYS) {
                if (typeof preferences.values[key] !== 'undefined') {
                    this[key] = preferences.values[key];
                }
            }
        },
        
        savePreferences: function() {
            // If local storage not available
            if (typeof localStorage === 'undefined') {
                return;
            }
            // Save preferences
            localStorage.setItem('preferences', JSON.stringify({
                version: CURRENT_VERSION,
                values: Object.fromEntries(STORE_SAVED_KEYS.map(key => [key, this[key]])),
            }));
        },

        setMessage: function(message) {
            this.newMessage = message;
        },

        sendMessage: function() {
            if (this.newMessage.trim().length === 0) {
                return;
            }
            const clientStore = useClientStore();
            clientStore.sendMessage(this.newMessage);
            this.newMessage = '';
        },
    
        focus: function() {
            const clientStore = useClientStore();
            if (this.missedMessages.length > 0) {
                clientStore.notifySeenMessage(this.missedMessages[this.missedMessages.length - 1].id);
            }
            this.focused = true;
            this.documentTitle.value = DEFAULT_DOCUMENT_TITLE;
            this.documentTitle.blinking = false;
            this.missedMessages = [];
        },
    
        blur: function() {
            this.focused = false;
        },
    
        setPlayerEnabled: function(playerEnabled) {
            this.playerMode.enabled = playerEnabled;
            this.savePreferences();
        },

        expandPlayer: function() {
            this.playerMode.size = {
                xs: 'sm',
                sm: 'md',
                md: 'lg',
                lg: 'lg',
            }[this.playerMode.size] || 'md';
            this.savePreferences();
        },

        shrinkPlayer: function() {
            this.playerMode.size = {
                lg: 'md',
                md: 'sm',
                sm: 'xs',
                xs: 'xs',
            }[this.playerMode.size] || 'md';
            this.savePreferences();
        },

        toggleShowPlayerQueue: function() {
            this.playerMode.queueEnabled = ! this.playerMode.queueEnabled;
            this.savePreferences();
        },

        /**
         * Upload a given file
         */
        upload: async function(file) {
            try {

                toast.info('File uploading...');

                // Create form and send request to backend
                const data = new FormData();
                data.append('file', file);
                const result = await (await fetch("/upload", {method: 'POST', body: data})).json();
                if (result.status === 500) {
                    throw new Error('Unable to upload: ' + result.message);
                }

                // Set message to uploaded file
                this.newMessage += ' ' + document.location.origin + '/' + result.path;

                toast.success('File uploaded');

            } catch (e) {
                toast.error(e.message || 'Unable to upload file');
            }
        },

        /**
         * Change currently shown view on mobile devices
         */
        mobileSetView: function(view) {
            this.mobileView = view;
        },
    },
});
