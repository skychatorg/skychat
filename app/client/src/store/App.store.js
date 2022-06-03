

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
    missedMessages: null,

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
    
    loadPreferences: ({ commit }) => {
        commit('loadPreferences');
    },
    
    savePreferences: ({ commit }) => {
        commit('loadPreferences');
    },

    focus: ({ commit }) => {
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
