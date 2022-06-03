

const DEFAULT_DOCUMENT_TITLE = "~ SkyChat";
const CURRENT_VERSION = 3;
const STORE_SAVED_KEYS = [
    'playerEnabled',
    'isQuickActionsVisible',
];


// State object
const state = {

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
}

// Getter functions
const getters = {

    focused: state => state.focused,
    documentTitle: state => state.documentTitle,
    documentTitleBlinking: state => state.documentTitleBlinking,
    page: state => state.page,
    mobileCurrentPage: state => state.mobileCurrentPage,
    cinemaMode: state => state.cinemaMode,
    missedMessages: state => state.missedMessages,
    playerEnabled: state => state.playerEnabled,
    playerIntensity: state => 0,
    isQuickActionsVisible: state => state.isQuickActionsVisible,
};

// Actions 
const actions = {

    init: async ({ state, dispatch, commit }) => {
        await dispatch('loadPreferences');
        
        // Handle height on mobile phones
        const resize = () => {
            document.body.style.height = window.innerHeight + 'px';
        };
        window.addEventListener('resize', resize);
        resize();
        
        // Handle document title update when new messages arrive
        window.addEventListener('blur', () => dispatch('blur'));
        window.addEventListener('focus', () => dispatch('focus'));

        setInterval(() => {
        
            // In case the title is not currently blinking, just update it
            if (! state.documentTitleBlinking) {
                if (document.title !== state.documentTitle) {
                    document.title = state.documentTitle;
                }
                return;
            }
        
            const chars = "┤┘┴└├┌┬┐";
            const indexOf = chars.indexOf(document.title[0]);
            const newPosition = (indexOf + 1) % chars.length;
            document.title = chars[newPosition] + ' ' + state.documentTitle;
        
        }, 1000);
    },
    
    loadPreferences: ({ commit }) => {
        commit('loadPreferences');
    },
    
    savePreferences: ({ commit }) => {
        commit('loadPreferences');
    },

    focus: ({ state, commit }) => {
        if (state.missedMessages.length > 0) {
            client.notifySeenMessage(store.state.App.missedMessages[store.state.App.missedMessages.length - 1].id);
        }
        commit('focus');
    },

    blur: ({ commit }) => {
        commit('blur');
    },

    setPage: ({ commit }, page) => {
        commit('setPage', page);
    },

    setMobilePage: ({ commit }, mobileCurrentPage) => {
        commit('setMobilePage', mobileCurrentPage);
    },

    toggleCinemaMode: ({ commit }) => {
        commit('toggleCinemaMode');
    },

    setPlayerEnabled: ({ commit }, playerEnabled) => {
        commit('setPlayerEnabled', playerEnabled);
    },

    setCursorEnabled: ({ commit }, cursorEnabled) => {
        commit('setCursorEnabled', cursorEnabled);
    },

    setQuickActionsVisibility: ({ commit }, isQuickActionsVisible) => {
        commit('setQuickActionsVisibility', isQuickActionsVisible);
    },
};

// Mutations
const mutations = {
    
    loadPreferences(state) {
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
                Vue.set(state, key, preferences.values[key]);
            }
        }
    },

    savePreferences(state) {
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

    focus(state) {
        state.focused = true;
        state.documentTitle = DEFAULT_DOCUMENT_TITLE;
        state.documentTitleBlinking = false;
        state.missedMessages = [];
    },

    blur(state) {
        state.focused = false;
    },

    setPage(state, page) {
        state.page = page;
    },

    setMobilePage(state, mobileCurrentPage) {
        state.mobileCurrentPage = mobileCurrentPage;
    },

    toggleCinemaMode(state) {
        state.cinemaMode = ! state.cinemaMode;
    },

    setPlayerEnabled(state, playerEnabled) {
        state.playerEnabled = playerEnabled;
        this.commit('App/savePreferences');
    },

    setCursorEnabled(state, cursorEnabled) {
        state.cursorEnabled = cursorEnabled;
        this.commit('App/savePreferences');
    },

    setQuickActionsVisibility(state, visible) {
        state.isQuickActionsVisible = !! visible;
        this.commit('App/savePreferences');
    },
};

export default { namespaced: true, state, getters, actions, mutations };
