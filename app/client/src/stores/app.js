import mousetrap from 'mousetrap';
import { defineStore } from 'pinia';
import { watch } from 'vue';
import { useToast } from 'vue-toastification';
import { useClientStore } from './client';
import { useEncryptionStore } from './encryption';
import { usePaletteStore } from './palette';

const DEFAULT_DOCUMENT_TITLE = '~ SkyChat';

const NOTIFICATION_SOUND_MP3_PATH = '/assets/sound/notification.mp3';

const CURRENT_VERSION = 5;
const STORE_SAVED_KEYS = ['playerMode', 'leftCollapsed'];

const applyLeftCollapsedClass = (collapsed) => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('left-col-collapsed', !!collapsed);
};

const toast = useToast();

// Pre-loaded audio element for notifications
let notificationAudio = null;
let audioContext = null;
let audioBuffer = null;

// Initialize audio system
const initAudio = async () => {
    // Pre-load Audio element
    notificationAudio = new Audio(NOTIFICATION_SOUND_MP3_PATH);
    notificationAudio.load();

    // Initialize AudioContext for better background support
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContextClass();
        const response = await fetch(NOTIFICATION_SOUND_MP3_PATH);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.warn('AudioContext initialization failed:', e);
    }
};

// Play notification sound with fallbacks
const playNotificationSound = async () => {
    // Try AudioContext first (better background support)
    if (audioContext && audioBuffer) {
        try {
            // Resume context if suspended (required after user interaction)
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.start(0);
            return;
        } catch (e) {
            console.warn('AudioContext playback failed:', e);
        }
    }

    // Fallback to pre-loaded Audio element
    if (notificationAudio) {
        try {
            notificationAudio.currentTime = 0;
            await notificationAudio.play();
            return;
        } catch (e) {
            console.warn('Audio element playback failed:', e);
        }
    }

    // Last resort: create new Audio
    try {
        await new Audio(NOTIFICATION_SOUND_MP3_PATH).play();
    } catch (e) {
        console.warn('All audio playback methods failed:', e);
    }
};

// Show browser notification
const showBrowserNotification = (title, body) => {
    if (!('Notification' in window)) {
        return;
    }

    if (Notification.permission === 'granted') {
        new Notification(title, {
            body,
            icon: '/favicon.ico',
            tag: 'skychat-mention',
        });
    }
};

// Request notification permission
const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        return;
    }

    if (Notification.permission === 'default') {
        await Notification.requestPermission();
    }
};

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

        /**
         * Whether the left column (rooms) is collapsed to an icon-only rail on desktop
         */
        leftCollapsed: false,

        /**
         * Whether the viewport is at the desktop breakpoint (>= lg, 1024px)
         */
        isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,

        /**
         * Currently opened modals
         */
        modals: {
            /**
             * Whether the profile modal is currently opened
             */
            profile: false,

            /**
             * Modal to navigate in the gallery
             */
            gallery: false,

            /**
             * List on currently converting videos
             */
            ongoingConverts: false,

            /**
             * Utility to convert videos
             */
            videoConverter: false,

            /**
             * Modal to add videos from youtube
             */
            youtubeVideoSearcher: false,

            /**
             * List of next videos to play
             */
            playerQueue: false,

            /**
             * Room management modal
             */
            manageRooms: false,

            /**
             * Sticker management modal
             */
            manageStickers: false,
        },
    }),

    getters: {
        /**
         * The collapsed flag is only meaningful at the desktop breakpoint.
         * On mobile the left column is full-width and shouldn't render in compact mode.
         */
        effectiveLeftCollapsed: (state) => state.leftCollapsed && state.isDesktop,
    },

    actions: {
        init: function () {
            this.loadPreferences();

            const clientStore = useClientStore();
            clientStore.init();

            // Initialize audio system and request notification permission
            initAudio();
            requestNotificationPermission();

            // Handle height on mobile phones + track desktop breakpoint
            const resize = () => {
                document.body.style.height = window.innerHeight + 'px';
                this.isDesktop = window.innerWidth >= 1024;
                applyLeftCollapsedClass(this.effectiveLeftCollapsed);
            };
            window.addEventListener('resize', resize);
            resize();

            // Handle file upload on paste
            const fileUpload = async (event) => {
                const files = event.clipboardData.files;
                for (const file of files) {
                    this.setMessage(this.newMessage + ' ' + (await this.upload(file)));
                }
            };
            window.addEventListener('paste', fileUpload);

            // Handle document title update when new messages arrive
            window.addEventListener('blur', () => this.blur());
            window.addEventListener('focus', () => this.focus());

            // Auto-check document title every second
            setInterval(() => {
                // In case the title is not currently blinking, just update it
                if (!this.documentTitle.blinking) {
                    if (document.title !== this.documentTitle.value) {
                        document.title = this.documentTitle.value;
                    }
                    return;
                }

                const chars = '┤┘┴└├┌┬┐';
                const indexOf = chars.indexOf(document.title[0]);
                const newPosition = (indexOf + 1) % chars.length;
                document.title = chars[newPosition] + ' 🔔 ' + this.documentTitle.value;
            }, 1000);

            // Listen for own state change
            watch(
                () => this.newMessage,
                (newMessage, oldMessage) => {
                    const isNewMessageTyping = newMessage.length > 0 && !newMessage.startsWith('/');
                    const isOldMessageTyping = oldMessage.length > 0 && !oldMessage.startsWith('/');

                    // Now typing
                    if (isNewMessageTyping && !isOldMessageTyping) {
                        clientStore.sendMessage('/t on');
                    }
                    // Stop typing
                    if (!isNewMessageTyping && isOldMessageTyping) {
                        clientStore.sendMessage('/t off');
                    }
                },
            );

            // Listen for last mention and send audio + browser notification
            watch(
                () => clientStore.state.lastMention,
                (mention) => {
                    // Notify user if mentioned and app is not focused or not on chat view
                    if (!this.focused || this.mobileView !== 'middle') {
                        playNotificationSound();

                        // Show browser notification
                        if (mention && mention.identifier) {
                            showBrowserNotification(`@${mention.identifier} mentioned you`, 'You have been mentioned in SkyChat');
                        }
                    }
                },
            );

            // Listen for when the last received message changed
            watch(
                () => clientStore.lastMessage,
                (message) => {
                    // If no message
                    if (!message) {
                        return;
                    }

                    // If app is not focused, create notification
                    if (!this.focused) {
                        this.documentTitle.value = `${message.user.username}: ${message.content.substr(0, 8) + '...'}`;
                        this.documentTitle.blinking = true;
                        this.missedMessages.push(message);
                        return;
                    }

                    // Send last seen notification
                    clientStore.notifySeenMessage(message.id);
                },
            );

            // Watch for new polls
            watch(
                () => Object.keys(clientStore.state.polls).length,
                async (newLength, oldLength) => {
                    if (newLength > oldLength) {
                        try {
                            await new Audio('/assets/sound/new-poll.ogg').play();
                        } catch (e) {
                            console.warn('Poll audio playback failed:', e);
                        }
                    }
                },
            );

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
                let newRoomIndex = clientStore.state.rooms.indexOf(clientStore.state.currentRoom) - 1;
                if (newRoomIndex < 0) {
                    newRoomIndex = clientStore.state.rooms.length - 1;
                }
                clientStore.join(clientStore.state.rooms[newRoomIndex].id);
            });

            // Ctrl/Cmd+K: toggle command palette. Bypasses mousetrap because
            // mousetrap suppresses shortcuts inside input/textarea, which is
            // exactly where users will be when they want to open the palette.
            const paletteStore = usePaletteStore();
            const onPaletteKey = (e) => {
                if (e.repeat) return;
                if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
                if (e.key.toLowerCase() !== 'k') return;
                e.preventDefault();
                paletteStore.toggle();
            };
            document.addEventListener('keydown', onPaletteKey);
            if (import.meta.hot) {
                import.meta.hot.dispose(() => document.removeEventListener('keydown', onPaletteKey));
            }
        },

        loadPreferences: function () {
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
            applyLeftCollapsedClass(this.effectiveLeftCollapsed);
        },

        savePreferences: function () {
            // If local storage not available
            if (typeof localStorage === 'undefined') {
                return;
            }
            // Save preferences
            localStorage.setItem(
                'preferences',
                JSON.stringify({
                    version: CURRENT_VERSION,
                    values: Object.fromEntries(STORE_SAVED_KEYS.map((key) => [key, this[key]])),
                }),
            );
        },

        setMessage: function (message) {
            this.newMessage = message;
        },

        sendMessage: async function (encryptionOptions = {}) {
            if (this.newMessage.trim().length === 0) {
                return false;
            }
            const clientStore = useClientStore();
            const encryptionStore = useEncryptionStore();
            const payload = await encryptionStore.prepareOutgoingMessage(this.newMessage, encryptionOptions);
            if (payload === null) {
                return false;
            }
            clientStore.sendMessage(payload);
            this.newMessage = '';
            return true;
        },

        focus: function () {
            const clientStore = useClientStore();
            if (this.missedMessages.length > 0) {
                // Find last message with non-zero id
                const realMessages = this.missedMessages.filter((message) => message.id !== 0);
                if (realMessages.length > 0) {
                    clientStore.notifySeenMessage(realMessages[realMessages.length - 1].id);
                }
            }
            this.focused = true;
            this.documentTitle.value = DEFAULT_DOCUMENT_TITLE;
            this.documentTitle.blinking = false;
            this.missedMessages = [];
        },

        blur: function () {
            this.focused = false;
        },

        setPlayerEnabled: function (playerEnabled) {
            this.playerMode.enabled = playerEnabled;
            this.savePreferences();
        },

        expandPlayer: function () {
            this.playerMode.size =
                {
                    xs: 'sm',
                    sm: 'md',
                    md: 'lg',
                    lg: 'lg',
                }[this.playerMode.size] || 'md';
            this.savePreferences();
        },

        shrinkPlayer: function () {
            this.playerMode.size =
                {
                    lg: 'md',
                    md: 'sm',
                    sm: 'xs',
                    xs: 'xs',
                }[this.playerMode.size] || 'md';
            this.savePreferences();
        },

        /**
         * Upload a given file
         */
        upload: async function (file) {
            try {
                toast.info('File uploading...');

                // Create form and send request to backend
                const data = new FormData();
                data.append('file', file);
                const result = await (await fetch('/api/upload', { method: 'POST', body: data })).json();
                if (result.status === 500) {
                    throw new Error('Unable to upload: ' + result.message);
                }

                // Set message to uploaded file
                toast.success('File uploaded');

                return document.location.origin + '/' + result.path;
            } catch (e) {
                toast.error(e.message || 'Unable to upload file');
            }
        },

        /**
         * Change currently shown view on mobile devices
         */
        mobileSetView: function (view) {
            this.mobileView = view;
        },

        /**
         * Toggle the left column between full width and icon-only rail (desktop only)
         */
        toggleLeftCollapsed: function () {
            this.leftCollapsed = !this.leftCollapsed;
            applyLeftCollapsedClass(this.effectiveLeftCollapsed);
            this.savePreferences();
        },

        /**
         * Open a modal by its name
         */
        toggleModal: function (name, data) {
            if (typeof this.modals[name] === 'undefined') {
                throw new Error('Unknown modal: ' + name);
            }
            if (this.modals[name]) {
                this.modals[name] = false;
            } else {
                this.modals[name] = data || true;
            }
        },

        /**
         * Close one or multiple given modals
         */
        closeModal: function (...name) {
            for (const modalName of name) {
                if (typeof this.modals[modalName] === 'undefined') {
                    throw new Error('Unknown modal: ' + modalName);
                }
                this.modals[modalName] = false;
            }
        },
    },
});
