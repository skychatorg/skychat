export const labels = {
    // Rooms
    joinRoom: (name) => `Join room ${name}`,
    markRoomRead: (name) => `Mark room ${name} as read`,
    muteRoom: (name) => `Mute room ${name}`,
    unmuteRoom: (name) => `Unmute room ${name}`,
    copyRoomId: (name) => `Copy room ${name} ID`,
    nextRoom: () => 'Next room',
    previousRoom: () => 'Previous room',
    manageRooms: () => 'Manage rooms',

    // Users
    sendPm: (username) => `Send PM to ${username}`,
    blacklistUser: (username) => `Blacklist ${username}`,
    unblacklistUser: (username) => `Unblacklist ${username}`,
    kickUser: (username) => `Kick ${username}`,
    banUser: (username) => `Ban ${username}…`,
    banUserFor: (duration) => `Ban for ${duration}`,
    banUserCustom: () => 'Custom duration…',
    copyUsername: (username) => `Copy ${username}`,

    // Player
    togglePlayer: (enabled) => (enabled ? 'Turn player off' : 'Turn player on'),
    expandPlayer: () => 'Expand player',
    shrinkPlayer: () => 'Shrink player',
    skipVideo: () => 'Skip current video',
    skipForward30: () => 'Skip forward 30s',
    replay30: () => 'Replay 30s',
    syncPlayer: () => 'Sync player',
    openPlayerQueue: () => 'Open player queue',
    addYoutubeVideo: () => 'Add YouTube video…',

    // Chat
    focusMessageInput: () => 'Focus message input',
    searchMessages: () => 'Search messages…',
    uploadFile: () => 'Upload file',
    toggleRecording: (recording) => (recording ? 'Stop audio recording' : 'Record audio message'),
    toggleEncryption: () => 'Toggle message encryption',

    // Settings
    openProfile: () => 'Open profile',
    openGallery: () => 'Open gallery',
    manageStickers: () => 'Manage stickers',
    changeMotto: () => 'Change motto…',
    changeColor: () => 'Change color…',
    pickColor: (name) => `Use color: ${name}`,
    toggleGuestBlacklist: (hidden) => (hidden ? 'Show guests' : 'Hide all guests'),
    requestNotifPermission: () => 'Enable browser notifications',

    // Navigation
    mobileShowLeft: () => 'Show left column (rooms)',
    mobileShowMiddle: () => 'Show middle column (chat)',
    mobileShowRight: () => 'Show right column (users)',
    goToChat: () => 'Go to chat',
    goToHome: () => 'Go to home',

    // Session
    logout: () => 'Log out',
    loginAsGuest: () => 'Log in as guest',
};
