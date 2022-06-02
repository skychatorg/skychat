import { EventEmitter } from "events";
import { Blob } from "node-fetch";
import { PublicConfig, SanitizedMessage, SanitizedUser, AuthToken, SanitizedSession, SanitizedRoom, SanitizedPoll, SanitizedGallery, SanitizedGalleryMedia, SanitizedPlayerChannel, VideoInfo, QueuedVideoInfo } from "../server";


const defaultUser: SanitizedUser = {
    id: 0,
    username: '*Guest',
    money: 0,
    xp: 0,
    right: -1,
    rank: {},
    data: {
        plugins: {
            avatar: '',
            cursor: true,
            motto: '',
            yt: null,
        }
    }
};


export declare interface SkyChatClient {

    on(event: 'config',             listener: (config: PublicConfig) => any): this;
    on(event: 'set-user',           listener: (user: SanitizedUser) => any): this;
    on(event: 'auth-token',         listener: (token: AuthToken | null) => any): this;
    on(event: 'connected-list',     listener: (sessions: Array<SanitizedSession>) => any): this;
    on(event: 'room-list',          listener: (rooms: Array<SanitizedRoom>) => any): this;
    on(event: 'join-room',          listener: (roomId: number) => any): this;
    on(event: 'typing-list',        listener: (users: Array<SanitizedUser>) => any): this;
    on(event: 'message',            listener: (message: SanitizedMessage) => any): this;
    on(event: 'messages',           listener: (messages: Array<SanitizedMessage>) => any): this;
    on(event: 'message-edit',       listener: (message: SanitizedMessage) => any): this;
    on(event: 'message-seen',       listener: (data: { user: number, data: any }) => any): this;
    on(event: 'poll',               listener: (poll: SanitizedPoll) => any): this;
    on(event: 'cursor',             listener: (cursor: { x: number, y: number, user: SanitizedUser }) => any): this;
    on(event: 'roll',               listener: (roll: { state: boolean }) => any): this;
    
    on(event: 'error',              listener: (message: string) => any): this;
    on(event: 'info',               listener: (message: string) => any): this;
    
    on(event: 'set-op',             listener: (op: boolean) => any): this;
    on(event: 'file-list',          listener: (files: Array<string>) => any): this;
    on(event: 'file-content',       listener: (data: { filePath: string, content: string }) => any): this;

    on(event: 'gallery',            listener: (gallery: { data: SanitizedGallery, canWrite: boolean }) => any): this;
    on(event: 'gallery-search',     listener: (medias: SanitizedGalleryMedia[]) => any): this;

    on(event: 'player-channels',    listener: (playerChannel: Array<SanitizedPlayerChannel>) => any): this;
    on(event: 'player-channel',     listener: (channelId: number) => any): this;
    on(event: 'player-search',      listener: (data: { type: string, items: Array<VideoInfo> }) => any): this;
    on(event: 'player-sync',        listener: (data: { current: QueuedVideoInfo | null, queue: QueuedVideoInfo[], cursor: number }) => any): this;
}


export class SkyChatClient extends EventEmitter {

    static readonly CURSOR_DECAY_DELAY = 10 * 1e3;

    private _websocket: WebSocket | null = null;

    private _user: SanitizedUser = defaultUser;
    private _config: PublicConfig | null = null;
    private _token: AuthToken | null = null;
    private _connectedList: Array<SanitizedSession> = [];
    private _messageIdToLastSeenUsers: { [id: number]: Array<SanitizedUser> } = {};
    private _roomConnectedUsers: { [roomId: number]: Array<SanitizedUser> } = {};
    private _playerChannelUsers: { [roomId: number]: Array<SanitizedUser> } = {};
    private _roomList: Array<SanitizedRoom> = [];
    private _currentRoomId: number | null = null;
    private _typingList: Array<SanitizedUser> = [];
    private _polls: { [id: number]: SanitizedPoll } = {};
    private _cursors: { [identifier: string]: { date: Date, cursor: { x: number, y: number, user: SanitizedUser } } } = {};
    private _roll: { state: boolean } = { state: false };
    private _op: Boolean = false;
    private _files: Array<string> = [];
    private _file: { filePath: string, content: string } | null = null;
    private _gallery: SanitizedGallery | null = null;
    private _gallerySearchResults: SanitizedGalleryMedia[] = [];
    private _playerChannels: Array<SanitizedPlayerChannel> = [];
    private _currentPlayerChannelId: number | null = null;
    private _playerApiSearchResult: { type: string, items: Array<VideoInfo> } | null = null;
    private _player: { current: QueuedVideoInfo | null, queue: QueuedVideoInfo[], cursor: number } = { current: null, queue: [], cursor: 0 };
    private _playerLastUpdate: Date | null = null;

    constructor() {
        super();

        // Auth & Config
        this.on('config', this._onConfig.bind(this));
        this.on('set-user', this._onUser.bind(this));
        this.on('auth-token', this._onToken.bind(this));
        this.on('connected-list', this._onConnectedList.bind(this));

        // Room
        this.on('room-list', this._onRoomList.bind(this));
        this.on('join-room', this._onCurrentRoomId.bind(this));
        this.on('typing-list', this._onTypingList.bind(this));

        // Messages
        this.on('message', this._onMessage.bind(this));
        this.on('messages', this._onMessages.bind(this));
        this.on('message-edit', this._onMessageEdit.bind(this));
        this.on('message-seen', this._onMessageSeen.bind(this));

        // Games & Features
        this.on('poll', this._onPoll.bind(this));
        this.on('cursor', this._onCursor.bind(this));
        this.on('roll', this._onRoll.bind(this));

        // Admin
        this.on('set-op', this._onSetOP.bind(this));
        this.on('file-list', this._onFileList.bind(this));
        this.on('file-content', this._onFileContent.bind(this));

        // Gallery
        this.on('gallery', this._onGallery.bind(this));
        this.on('gallery-search', this._onGallerySearchResults.bind(this));

        // Player
        this.on('player-channels', this._onPlayerChannels.bind(this));
        this.on('player-channel', this._onPlayerChannel.bind(this));
        this.on('player-search', this._onPlayerApiSearchResults.bind(this));
        this.on('player-sync', this._onPlayerSync.bind(this));
        
        // Meta
        this.on('info', this._onInfo.bind(this));
        this.on('error', this._onError.bind(this));
    }

    private _onConfig(config: PublicConfig) {
        this._config = config;
        this.emit('update', this.state);
    }

    private _onUser(user: SanitizedUser) {
        this._user = user;
        this.emit('update', this.state);
    }

    private _onToken(token: AuthToken | null) {
        this._token = token;
        this.emit('update', this.state);
    }

    private _onConnectedList(connectedList: Array<SanitizedSession>) {
        this._connectedList = connectedList;
        this._generateConnectedListMeta();
        this.emit('update', this.state);
    }

    private _generateConnectedListMeta() {
        // Update self entry
        const ownUser = this._connectedList.find(entry => entry.user.username === this._user.username);
        if (ownUser) {
            this._user = ownUser.user;
        }
        // Update link from message ids to users whose last seen message is this message
        const messageIdToLastSeenUsers: {[id: number]: Array<SanitizedUser>} = {};
        const roomId = this._currentRoomId;
        for (const entry of this._connectedList) {
            const entries: any = entry.user.data.plugins.lastseen;
            if (roomId === null || ! entries || ! entries[roomId]) {
                continue;
            }
            const lastSeenId = entries[roomId];
            if (typeof messageIdToLastSeenUsers[lastSeenId] === 'undefined') {
                messageIdToLastSeenUsers[lastSeenId] = [];
            }
            messageIdToLastSeenUsers[lastSeenId].push(entry.user);
        }
        this._messageIdToLastSeenUsers = messageIdToLastSeenUsers;
        // Update list of connected users / rooms and player channels
        const roomConnectedUsers: {[id: number]: Array<SanitizedUser>} = {};
        const playerChannelUsers: {[id: number]: Array<SanitizedUser>} = {};
        for (const entry of this._connectedList) {
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
        this._roomConnectedUsers = roomConnectedUsers;
        this._playerChannelUsers = playerChannelUsers;
    }

    private _onRoomList(roomList: Array<SanitizedRoom>) {
        this._roomList = roomList;
        this.emit('update', this.state);
    }

    private _onCurrentRoomId(currentRoomId: number) {
        this._currentRoomId = currentRoomId;
        this.emit('update', this.state);
        // Ask for message history if joined a room
        currentRoomId !== null && this.sendMessage('/messagehistory');
    }

    private _onTypingList(typingList: Array<SanitizedUser>) {
        this._typingList = typingList;
        this.emit('update', this.state);
    }
    
    private _onMessage(message: SanitizedMessage) {
        // TODO: Handle in store
        // this._messages.push(message);
        // this._focused && this.notifySeenMessage(message.id);
    }
    
    private _onMessages(messages: Array<SanitizedMessage>) {
        // TODO: Handle in store
        // if (messages.length === 0) {
        //     return;
        // }
        // this._messages.push(...messages);
        // this._focused && this.notifySeenMessage(messages[messages.length - 1].id);
    }
    
    private _onMessageEdit(message: unknown) {
        // TODO: Handle in store
        // const oldMessageIndex = this._messages.findIndex(oldMessage => oldMessage.id === message.id);
        // if (oldMessageIndex === -1) {
        //     return;
        // }
        // this._messages[oldMessageIndex] = message;
    }
    
    private _onMessageSeen(messageSeen: { user: number, data: any }) {
        const entry = this._connectedList.find(e => e.user.id === messageSeen.user);
        if (! entry) {
            return;
        }
        entry.user.data.plugins.lastseen = messageSeen.data;
        this._generateConnectedListMeta();
        this.emit('update', this.state);
    }

    private _onPoll(poll: SanitizedPoll) {
        this._polls[poll.id] = poll;
        this.emit('update', this.state);
    }

    private _onCursor(cursor: { x: number, y: number, user: SanitizedUser }) {
        const identifier = cursor.user.username.toLowerCase();
        // Skip own cursor
        if (identifier === this._user.username.toLowerCase()) {
            return;
        }
        this._cursors[identifier] = { date: new Date(), cursor };
        // Clean up the cursors
        if (Math.random() < 0.05) {
            for (const identifier in this._cursors) {
                const entry = this._cursors[identifier];
                if (new Date().getTime() - entry.date.getTime() > SkyChatClient.CURSOR_DECAY_DELAY) {
                    delete this._cursors[identifier];
                }
            }
        }
        this.emit('update', this.state);
    }

    private _onRoll(roll: { state: boolean }) {
        this._roll = roll;
        this.emit('update', this.state);
    }

    private _onSetOP(op: boolean) {
        this._op = op;
        this.emit('update', this.state);
    }

    private _onFileList(files: Array<string>) {
        this._files = files;
        this.emit('update', this.state);
    }

    private _onFileContent(file: { filePath: string, content: string }) {
        this._file = file;
        this.emit('update', this.state);
    }

    private _onGallery(gallery: any) {
        this._gallery = gallery;
        this.emit('update', this.state);
    }

    private _onGallerySearchResults(gallerySearchResults: any) {
        this._gallerySearchResults = gallerySearchResults;
        this.emit('update', this.state);
    }

    private _onPlayerChannels(playerChannels: Array<SanitizedPlayerChannel>) {
        this._playerChannels = playerChannels;
        this.emit('update', this.state);
    }

    private _onPlayerChannel(currentPlayerChannelId: number) {
        this._currentPlayerChannelId = currentPlayerChannelId;
        this.emit('update', this.state);
    }

    private _onPlayerApiSearchResults(playerApiSearchResult: { type: string, items: Array<VideoInfo> }) {
        this._playerApiSearchResult = playerApiSearchResult;
        this.emit('update', this.state);
    }

    private _onPlayerSync(playerState: { current: QueuedVideoInfo | null, queue: QueuedVideoInfo[], cursor: number }) {
        this._player = playerState;
        this._playerLastUpdate = new Date();
        this.emit('update', this.state);
    }

    private _onInfo(info: string) {
        console.info(info);
    }

    private _onError(error: string) {
        console.info(error);
    }

    /**
     * Get the client current state. Sums up all that is relevant for the client.
     * Messages are not accumulated here. It is up to the client to decide what to do with them.
     */
    get state() {
        return {
            user: this._user,
            config: this._config,
            token: this._token,
            connectedList: this._connectedList,
            messageIdToLastSeenUsers: this._messageIdToLastSeenUsers,
            roomConnectedUsers: this._roomConnectedUsers,
            playerChannelUsers: this._playerChannelUsers,
            roomList: this._roomList,
            currentRoomId: this._currentRoomId,
            typingList: this._typingList,
            polls: this._polls,
            cursors: this._cursors, // TODO: Move cursors to separate object to save performances?
            roll: this._roll,
            op: this._op,
            files: this._files,
            file: this._file,
            gallery: this._gallery,
            gallerySearchResults: this._gallerySearchResults,
            playerChannels: this._playerChannels,
            currentPlayerChannelId: this._currentPlayerChannelId,
            playerApiSearchResult: this._playerApiSearchResult,
            player: this._player,
            playerLastUpdate: this._playerLastUpdate,
        };
    }

    /**
     * Connect to the server
     */
    connect(url: string) {
        this._websocket = new WebSocket(url);
        this._websocket.addEventListener('open', this._onWebSocketConnect.bind(this));
        this._websocket.addEventListener('message', this._onWebSocketMessage.bind(this));
        this._websocket.addEventListener('close', this._onWebSocketClose.bind(this));
        // this.store.commit('Main/SET_CONNECTION_STATE', WebSocket.CONNECTING);
    }

    /**
     * Send a last message seen notification
     * @param messageId
     */
    private notifySeenMessage(messageId: number) {
        this.sendMessage(`/lastseen ${messageId}`);
    }

    /**
     * Emit an event to the server
     * @param eventName
     * @param payload
     */
    private _sendEvent(eventName: string, payload: any) {
        if (! this._websocket) {
            return;
        }
        this._websocket.send(JSON.stringify({
            event: eventName,
            data: payload
        }));
    }

    /**
     * When the connection is made with the websocket server
     */
    private _onWebSocketConnect() {
        // if (typeof localStorage !== 'undefined') {
        //     const authToken = localStorage.getItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY);
        //     if (authToken) {
        //         this._sendEvent('set-token', JSON.parse(authToken));
        //     }
        // }
        // this.store.commit('Main/SET_CONNECTION_STATE', WebSocket.OPEN);
    }

    /**
     * When a message is received on the websocket
     * @param message
     */
    private _onWebSocketMessage(message: any) {
        // If raw audio received
        if (message.data instanceof Blob) {
            this.emit('audio', message.data);
            return;
        }
        // Otherwise, if normal json message received
        const data = JSON.parse(message.data);
        const eventName = data.event;
        const eventPayload = data.data;
        this.emit(eventName, eventPayload);
    }

    /**
     *
     */
    private _onWebSocketClose(event: any) {
        // this.store.commit('Main/SET_CONNECTION_STATE', WebSocket.CLOSED);
        if (event.code === 4403) {
            // 4403 means kick -> no auto re-connect
            return;
        }
        setTimeout(this.connect.bind(this), 1000);
    }


    /**
     * Send cursor position
     * @param x
     * @param y
     */
    sendCursor(x: number, y: number) {
        this.sendMessage('/c ' + x + ' ' + y);
    }

    /**
     * Send a message to the server
     * @param message
     */
    sendMessage(message: string) {
        this._sendEvent('message', message);
    }

    /**
     * Send a PM to the given username
     * @param username
     * @param message
     */
    sendPrivateMessage(username: string, message: string) {
        return this.sendMessage('/mp ' + username + ' ' + message);
    }

    /**
     * Set typing state
     * @param typing
     */
    setTyping(typing: boolean) {
        this.sendMessage('/t ' + (typing ? 'on' : 'off'));
    }

    /**
     * Set this user's avatar
     * @param avatar Url to an uploaded file
     */
    setAvatar(avatar: string) {
        this.sendMessage('/avatar ' + avatar);
    }

    /**
     * Asks for the current player to be synchronized
     */
    playerSync() {
        this.sendMessage('/playersync');
    }

    /**
     * Leave a player channel
     */
    leavePlayerChannel() {
        this.sendMessage('/playerchannel leave');
    }

    /**
     * Join a player channel
     * @param id
     */
    joinPlayerChannel(id: number) {
        this.sendMessage('/playerchannel join ' + id);
    }

    /**
     * Set cursor state
     * @param state
     */
    cursorSetState(state: boolean) {
        this.sendMessage('/cursor ' + (state ? 'on' : 'off'));
    }

    /**
     * Join a specific room
     * @param roomId
     */
    join(roomId: number) {
        this._sendEvent('join-room', { roomId });
    }

    /**
     * Create a new room
     */
    createRoom() {
        this.sendMessage(`/roomcreate`);
    }

    /**
     * Delete the current room (OP only or last person in a private room)
     */
    deleteCurrentRoom() {
        this.sendMessage(`/roomdelete`);
    }

    /**
     * Leave current room
     */
    leaveCurrentRoom() {
        this.sendMessage(`/roomleave`);
    }

    /**
     * Login
     * @param username
     * @param password
     */
    login(username: string, password: string) {
        this._sendEvent('login', { username, password });
    }

    /**
     * Logout
     */
    logout() {
        // if (typeof localStorage !== 'undefined') {
        //     localStorage.removeItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY);
        // }
        if (this._websocket) {
            this._websocket.close();
        }
    }

    /**
     * Register
     * @param username
     * @param password
     */
    register(username: string, password: string) {
        this._sendEvent('register', { username, password });
    }

    /**
     * Register
     * @param pollId
     * @param answer
     */
    vote(pollId: number, answer: boolean) {
        this.sendMessage(`/vote ${pollId} ${answer ? 'y' : 'n'}`);
    }
}
