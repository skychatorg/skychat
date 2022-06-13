import { watch } from 'vue';
import { defineStore } from 'pinia'
import { useClientStore } from './client';

const DEFAULT_DOCUMENT_TITLE = "~ SkyChat";

const CURRENT_VERSION = 3;
const STORE_SAVED_KEYS = [
    'playerEnabled',
    'isQuickActionsVisible',
];


export const useAppStore = defineStore('app', {

    state: () => ({

        /**
         * Whether the window is currently focused
         */
        focused: true,
    
        /**
         * Current document title
         */
        documentTitle: DEFAULT_DOCUMENT_TITLE,
    
        /**
         * Whether the document is currently blinking
         */
        documentTitleBlinking: false,
    
        /**
         * Current page
         */
        page: 'welcome',
    
        /**
         * Current sub page if on mobile
         */
        mobileCurrentPage: 'middle',
    
        /**
         * Whether the cinema mode is currently enabled
         */
        cinemaMode: false,
    
        /**
         * List of missed messages, that were missed because the window was not focused
         */
        missedMessages: [],
    
        /**
         * Whether the player is on/off
         */
        playerEnabled: true,
    
        /**
         * Whether the cursors are visible
         */
        cursorEnabled: true,
    
        /**
         * Quick actions
         */
        isQuickActionsVisible: false,

        /**
         * New message being typed
         */
        newMessage: '',
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
            
            // Handle document title update when new messages arrive
            window.addEventListener('blur', () => this.blur());
            window.addEventListener('focus', () => this.focus());

            // Auto-check document title every second
            setInterval(() => {
            
                // In case the title is not currently blinking, just update it
                if (! this.documentTitleBlinking) {
                    if (document.title !== this.documentTitle) {
                        document.title = this.documentTitle;
                    }
                    return;
                }
            
                const chars = "┤┘┴└├┌┬┐";
                const indexOf = chars.indexOf(document.title[0]);
                const newPosition = (indexOf + 1) % chars.length;
                document.title = chars[newPosition] + ' ' + this.documentTitle;
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
                    Vue.set(this, key, preferences.values[key]);
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
                values: Object.fromEntries(STORE_SAVED_KEYS.map(key => [key, state[key]])),
            }));
        },

        sendMessage: function() {
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
            this.documentTitle = DEFAULT_DOCUMENT_TITLE;
            this.documentTitleBlinking = false;
            this.missedMessages = [];
        },
    
        blur: function() {
            this.focused = false;
        },
    
        setPage: page => {
            this.page = page;
        },
    
        setMobilePage: mobileCurrentPage => {
            this.mobileCurrentPage = mobileCurrentPage;
        },
    
        toggleCinemaMode: function() {
            this.cinemaMode = ! this.cinemaMode;
        },
    
        setPlayerEnabled: playerEnabled => {
            this.playerEnabled = playerEnabled;
            this.savePreferences();
        },
    
        setCursorEnabled: cursorEnabled => {
            this.cursorEnabled = cursorEnabled;
            this.savePreferences();
        },
    
        setQuickActionsVisibility: isQuickActionsVisible => {
            this.isQuickActionsVisible = isQuickActionsVisible;
            this.savePreferences();
        },
    },
});
