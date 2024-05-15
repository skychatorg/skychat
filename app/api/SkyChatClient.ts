/* eslint-disable no-unused-vars */
import { EventEmitter } from 'events';
import WebSocket from 'isomorphic-ws';
import * as jsondiffpatch from 'jsondiffpatch';
import {
    AuthData,
    AuthToken,
    CustomizationElements,
    FolderContent,
    OngoingConvert,
    PublicConfig,
    QueuedVideoInfo,
    SanitizedMessage,
    SanitizedPlayerChannel,
    SanitizedPoll,
    SanitizedRoom,
    SanitizedSession,
    SanitizedUser,
    VideoInfo,
    VideoStreamInfo,
} from '../server/index.js';
import { BinaryMessageTypes } from './BinaryMessageTypes.js';

const defaultUser: SanitizedUser = {
    id: 0,
    username: '*Guest',
    money: 0,
    xp: 0,
    right: -1,
    data: {
        plugins: {
            custom: {},
            avatar: '',
            motto: '',
        },
    },
};

export type SkyChatOptions = {
    autoMessageAck?: boolean;
};

export type SkyChatClientState = {
    websocketReadyState: number;
    user: SanitizedUser;
    config: PublicConfig | null;
    stickers: Record<string, string>;
    custom: CustomizationElements;
    token: AuthToken | null;
    connectedList: Array<SanitizedSession>;
    messageIdToLastSeenUsers: { [id: number]: Array<SanitizedUser> };
    roomConnectedUsers: { [roomId: number]: Array<SanitizedUser> };
    playerChannelUsers: { [roomId: number]: Array<SanitizedUser> };
    rooms: SanitizedRoom[];
    currentRoomId: number | null;
    currentRoom: SanitizedRoom | null;
    lastMention: { roomId: number; identifier: string; messageId: number } | null;
    typingList: SanitizedUser[];
    polls: { [id: number]: SanitizedPoll };
    cursors: { [identifier: string]: { date: Date; cursor: { x: number; y: number; user: SanitizedUser } } };
    roll: { state: boolean };
    op: boolean;
    files: string[];
    file: { filePath: string; content: string } | null;
    gallery: FolderContent | null;
    videoStreamInfo: VideoStreamInfo | null;
    ongoingConverts: OngoingConvert[];
    playerChannels: SanitizedPlayerChannel[];
    currentPlayerChannelId: number | null;
    currentPlayerChannel: SanitizedPlayerChannel | null;
    playerApiSearchResult: { type: string; items: Array<VideoInfo> } | null;
    player: { current: QueuedVideoInfo | null; queue: QueuedVideoInfo[]; cursor: number };
    playerLastUpdate: Date | null;
};

export declare interface SkyChatClient {
    on(event: 'config', listener: (config: PublicConfig) => any): this;
    on(event: 'sticker-list', listener: (stickers: Record<string, string>) => any): this;
    on(event: 'custom', listener: (custom: CustomizationElements) => any): this;
    on(event: 'set-user', listener: (user: SanitizedUser) => any): this;
    on(event: 'auth-token', listener: (token: AuthToken | null) => any): this;
    on(event: 'connected-list', listener: (sessions: Array<SanitizedSession>) => any): this;
    on(event: 'connected-list-patch', listener: (sessions: Array<SanitizedSession>) => any): this;
    on(event: 'room-list', listener: (rooms: Array<SanitizedRoom>) => any): this;
    on(event: 'join-room', listener: (roomId: number) => any): this;
    on(event: 'typing-list', listener: (users: Array<SanitizedUser>) => any): this;
    on(event: 'message', listener: (message: SanitizedMessage) => any): this;
    on(event: 'messages', listener: (messages: Array<SanitizedMessage>) => any): this;
    on(event: 'message-edit', listener: (message: SanitizedMessage) => any): this;
    on(event: 'message-seen', listener: (data: { user: number; data: any }) => any): this;
    on(event: 'mention', listener: (mention: { roomId: number; identifier: string; messageId: number }) => any): this;
    on(event: 'poll', listener: (poll: SanitizedPoll) => any): this;
    on(event: 'cursor', listener: (cursor: { x: number; y: number; user: SanitizedUser }) => any): this;
    on(event: 'roll', listener: (roll: { state: boolean }) => any): this;

    on(event: 'error', listener: (message: string) => any): this;
    on(event: 'info', listener: (message: string) => any): this;

    on(event: 'set-op', listener: (op: boolean) => any): this;

    on(event: 'gallery', listener: (data: FolderContent) => any): this;
    on(event: 'convert-info', listener: (data: VideoStreamInfo) => any): this;
    on(event: 'convert-list', listener: (data: Array<OngoingConvert>) => any): this;

    on(event: 'player-channels', listener: (playerChannels: Array<SanitizedPlayerChannel>) => any): this;
    on(event: 'player-channel', listener: (channelId: number | null) => any): this;
    on(event: 'player-search', listener: (data: { type: string; items: Array<VideoInfo> }) => any): this;
    on(event: 'player-sync', listener: (data: { current: QueuedVideoInfo | null; queue: QueuedVideoInfo[]; cursor: number }) => any): this;

    on(event: 'update', listener: (state: SkyChatClientState) => any): this;
}

// eslint-disable-next-line no-redeclare
export class SkyChatClient extends EventEmitter {
    static readonly CURSOR_DECAY_DELAY = 10 * 1e3;

    static readonly LOCAL_STORAGE_TOKEN_KEY = 'skychat-token';
    static readonly LOCAL_STORAGE_ROOM_ID = 'skychat-room-id';

    private _websocket: WebSocket | null = null;

    private _user: SanitizedUser = defaultUser;
    private _config: PublicConfig | null = null;
    private _stickers: Record<string, string> = {};
    private _custom: CustomizationElements = {};
    private _token: AuthToken | null = null;
    private _connectedList: Array<SanitizedSession> = [];
    private _messageIdToLastSeenUsers: { [id: number]: Array<SanitizedUser> } = {};
    private _roomConnectedUsers: { [roomId: number]: Array<SanitizedUser> } = {};
    private _playerChannelUsers: { [roomId: number]: Array<SanitizedUser> } = {};
    private _rooms: Array<SanitizedRoom> = [];
    private _currentRoomId: number | null = null;
    private _lastMention: { roomId: number; identifier: string; messageId: number } | null = null;
    private _typingList: Array<SanitizedUser> = [];
    private _polls: { [id: number]: SanitizedPoll } = {};
    private _cursors: { [identifier: string]: { date: Date; cursor: { x: number; y: number; user: SanitizedUser } } } = {};
    private _roll: { state: boolean } = { state: false };
    private _op = false;
    private _files: Array<string> = [];
    private _file: { filePath: string; content: string } | null = null;
    private _gallery: FolderContent | null = null;
    private _videoStreamInfo: VideoStreamInfo | null = null;
    private _ongoingConverts: Array<OngoingConvert> = [];
    private _playerChannels: Array<SanitizedPlayerChannel> = [];
    private _currentPlayerChannelId: number | null = null;
    private _currentPlayerChannel: SanitizedPlayerChannel | null = null;
    private _playerApiSearchResult: { type: string; items: Array<VideoInfo> } | null = null;
    private _player: { current: QueuedVideoInfo | null; queue: QueuedVideoInfo[]; cursor: number } = {
        current: null,
        queue: [],
        cursor: 0,
    };
    private _playerLastUpdate: Date | null = null;

    private autoMessageAck: boolean;

    constructor(
        public readonly url: string,
        options: SkyChatOptions = {},
    ) {
        super();

        this.autoMessageAck = options.autoMessageAck ?? false;

        // Auth & Config
        this.on('config', this._onConfig.bind(this));
        this.on('sticker-list', this._onStickerList.bind(this));
        this.on('custom', this._onCustom.bind(this));
        this.on('set-user', this._onUser.bind(this));
        this.on('auth-token', this._onToken.bind(this));
        this.on('connected-list', this._onConnectedList.bind(this));
        this.on('connected-list-patch', this._onConnectedListPatch.bind(this));

        // Messages
        this.on('message', this._onMessage.bind(this));

        // Room
        this.on('room-list', this._onRoomList.bind(this));
        this.on('join-room', this._onCurrentRoomId.bind(this));
        this.on('typing-list', this._onTypingList.bind(this));

        // Messages
        this.on('message-seen', this._onMessageSeen.bind(this));
        this.on('mention', this._onMention.bind(this));

        // Games & Features
        this.on('poll', this._onPoll.bind(this));
        this.on('cursor', this._onCursor.bind(this));
        this.on('roll', this._onRoll.bind(this));

        // Admin
        this.on('set-op', this._onSetOP.bind(this));

        // Gallery
        this.on('gallery', this._onGallery.bind(this));
        this.on('convert-info', this._onConvertInfo.bind(this));
        this.on('convert-list', this._onConvertList.bind(this));

        // Player
        this.on('player-channels', this._onPlayerChannels.bind(this));
        this.on('player-channel', this._onPlayerChannel.bind(this));
        this.on('player-search', this._onPlayerApiSearchResults.bind(this));
        this.on('player-sync', this._onPlayerSync.bind(this));

        // Meta
        this.on('info', this._onInfo.bind(this));
        this.on('error', this._onError.bind(this));

        // URL
        this.url = url;
    }

    private _onConfig(config: PublicConfig) {
        this._config = config;
        this.emit('update', this.state);
    }

    private _onStickerList(stickers: Record<string, string>) {
        this._stickers = stickers;
        this.emit('update', this.state);
    }

    private _onCustom(custom: CustomizationElements) {
        this._custom = custom;
        this.emit('update', this.state);
    }

    private _onUser(user: SanitizedUser) {
        this._user = user;
        this.emit('update', this.state);
    }

    private _onToken(token: AuthToken | null) {
        if (typeof localStorage !== 'undefined') {
            if (token) {
                localStorage.setItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY, JSON.stringify(token));
            } else {
                localStorage.removeItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY);
            }
        }
        this._token = token;
        this.emit('update', this.state);
    }
    private _onConnectedList(connectedList: Array<SanitizedSession>) {
        this._connectedList = connectedList;
        this._updateConnectedListMeta();
        this.emit('update', this.state);
    }

    private _onConnectedListPatch(patch: any) {
        jsondiffpatch.patch(this._connectedList, patch);
        this._updateConnectedListMeta();
        this.emit('update', this.state);
    }

    /**
     * Update link from message ids to users whose last seen message is this message
     */
    private _generateMessageIdToLastSeenUsers() {
        const messageIdToLastSeenUsers: { [id: number]: Array<SanitizedUser> } = {};
        const roomId = this._currentRoomId;
        for (const entry of this._connectedList) {
            const entries: any = entry.user.data.plugins.lastseen;
            if (roomId === null || !entries || !entries[roomId]) {
                continue;
            }
            const lastSeenId = entries[roomId];
            if (typeof messageIdToLastSeenUsers[lastSeenId] === 'undefined') {
                messageIdToLastSeenUsers[lastSeenId] = [];
            }
            messageIdToLastSeenUsers[lastSeenId].push(entry.user);
        }
        return { messageIdToLastSeenUsers };
    }

    /**
     * Update list of connected users / rooms and player channels
     */
    private _generateRoomConnectedUsersAndPlayerChannelUsers() {
        const roomConnectedUsers: { [id: number]: Array<SanitizedUser> } = {};
        const playerChannelUsers: { [id: number]: Array<SanitizedUser> } = {};
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
        return { roomConnectedUsers, playerChannelUsers };
    }

    private _updateConnectedListMeta() {
        // Update self entry
        const ownUser = this._connectedList.find((entry) => entry.user.username === this._user.username);
        if (ownUser) {
            this._user = ownUser.user;
        }
        ({ messageIdToLastSeenUsers: this._messageIdToLastSeenUsers } = this._generateMessageIdToLastSeenUsers());
        ({ roomConnectedUsers: this._roomConnectedUsers, playerChannelUsers: this._playerChannelUsers } =
            this._generateRoomConnectedUsersAndPlayerChannelUsers());
    }

    private _onMessage(message: SanitizedMessage) {
        if (!this.autoMessageAck) {
            return;
        }
        if (this._user.id === 0) {
            return;
        }
        if (message.id === 0) {
            return;
        }
        this.notifySeenMessage(message.id);
    }

    private _onRoomList(rooms: Array<SanitizedRoom>) {
        this._rooms = rooms;
        this.emit('update', this.state);
    }

    private _onCurrentRoomId(currentRoomId: number | null) {
        this._currentRoomId = currentRoomId;
        if (typeof localStorage !== 'undefined' && currentRoomId !== null) {
            localStorage.setItem(SkyChatClient.LOCAL_STORAGE_ROOM_ID, currentRoomId.toString());
        }
        this.emit('update', this.state);
        // Ask for message history if joined a room
        currentRoomId !== null && this.sendMessage('/messagehistory');
    }

    private _onTypingList(typingList: Array<SanitizedUser>) {
        this._typingList = typingList;
        this.emit('update', this.state);
    }

    private _onMessageSeen(messageSeen: { user: number; data: any }) {
        const entry = this._connectedList.find((e) => e.user.id === messageSeen.user);
        if (!entry) {
            return;
        }
        entry.user.data.plugins.lastseen = messageSeen.data;
        this._updateConnectedListMeta();
        this.emit('update', this.state);
    }

    private _onMention(mention: { roomId: number; identifier: string; messageId: number }) {
        this._lastMention = mention;
        this.emit('update', this.state);
    }

    private _onPoll(poll: SanitizedPoll) {
        this._polls[poll.id] = poll;
        this.emit('update', this.state);
        if (poll.state === 'finished') {
            setTimeout(() => {
                delete this._polls[poll.id];
                this.emit('update', this.state);
            }, 10 * 1000);
        }
    }

    private _onCursor(cursor: { x: number; y: number; user: SanitizedUser }) {
        const identifier = cursor.user.username.toLowerCase();
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

    private _onGallery(gallery: FolderContent) {
        this._gallery = gallery;
        this.emit('update', this.state);
    }

    private _onConvertInfo(data: VideoStreamInfo) {
        this._videoStreamInfo = data;
        this.emit('update', this.state);
    }

    private _onConvertList(data: Array<OngoingConvert>) {
        this._ongoingConverts = data;
        this.emit('update', this.state);
    }

    private _onPlayerChannels(playerChannels: Array<SanitizedPlayerChannel>) {
        this._playerChannels = playerChannels;
        this.emit('update', this.state);
    }

    private _onPlayerChannel(currentPlayerChannelId: number | null) {
        if (currentPlayerChannelId === null) {
            this._currentPlayerChannelId = null;
            this._currentPlayerChannel = null;
            this.emit('update', this.state);
            return;
        }
        const playerChannel = this._playerChannels.find((channel) => channel.id === currentPlayerChannelId);
        if (typeof playerChannel === 'undefined') {
            throw new Error('Player channel not found');
        }
        this._currentPlayerChannelId = currentPlayerChannelId;
        this._currentPlayerChannel = playerChannel;
        this.emit('update', this.state);
    }

    private _onPlayerApiSearchResults(playerApiSearchResult: { type: string; items: Array<VideoInfo> }) {
        this._playerApiSearchResult = playerApiSearchResult;
        this.emit('update', this.state);
    }

    private _onPlayerSync(player: { current: QueuedVideoInfo | null; queue: QueuedVideoInfo[]; cursor: number }) {
        this._player = player;
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
    get state(): SkyChatClientState {
        return {
            websocketReadyState: this._websocket ? this._websocket.readyState : WebSocket.CLOSED,
            user: this._user,
            config: this._config,
            stickers: this._stickers,
            custom: this._custom,
            token: this._token,
            connectedList: this._connectedList,
            messageIdToLastSeenUsers: this._messageIdToLastSeenUsers,
            roomConnectedUsers: this._roomConnectedUsers,
            playerChannelUsers: this._playerChannelUsers,
            rooms: this._rooms,
            currentRoomId: this._currentRoomId,
            currentRoom: this._rooms.find((room) => room.id === this._currentRoomId) || null,
            lastMention: this._lastMention,
            typingList: this._typingList,
            polls: this._polls,
            cursors: this._cursors,
            roll: this._roll,
            op: this._op,
            files: this._files,
            file: this._file,
            gallery: this._gallery,
            videoStreamInfo: this._videoStreamInfo,
            ongoingConverts: this._ongoingConverts,
            playerChannels: this._playerChannels,
            currentPlayerChannelId: this._currentPlayerChannelId,
            currentPlayerChannel: this._currentPlayerChannel,
            playerApiSearchResult: this._playerApiSearchResult,
            player: this._player,
            playerLastUpdate: this._playerLastUpdate,
        };
    }

    /**
     * Connect to the server
     */
    connect() {
        this._websocket = new WebSocket(this.url);
        this._websocket.addEventListener('open', this._onWebSocketConnect.bind(this));
        this._websocket.addEventListener('message', this._onWebSocketMessage.bind(this));
        this._websocket.addEventListener('close', this._onWebSocketClose.bind(this));
        this.emit('update', this.state);
    }

    /**
     * Set whether the client should be considered focused or not
     */
    setAutoMessageAck(autoMessageAck: boolean) {
        this.autoMessageAck = autoMessageAck;
    }

    /**
     * Send a last message seen notification
     * @param messageId
     */
    notifySeenMessage(messageId: number) {
        this.sendMessage(`/lastseen ${messageId}`);
    }

    /**
     * Send a message to the server
     * @param message
     */
    sendMessage(message: string) {
        this._sendEvent('message', message);
    }

    /**
     * Send anything (blob, binary)
     */
    _sendRaw(data: any) {
        if (!this._websocket) {
            return;
        }
        this._websocket.send(data);
    }

    /**
     * Send an audio file
     * @param blob
     */
    sendAudio(blob: Blob) {
        this._sendRaw(new Blob([new Uint16Array([BinaryMessageTypes.AUDIO]), blob]));
    }

    /**
     * Send current cursor position
     * @param x
     * @param y
     */
    sendCursorPosition(x: number, y: number) {
        if (!this._user || !this._user.id) {
            return;
        }
        this._sendRaw(new Blob([new Uint16Array([BinaryMessageTypes.CURSOR]), new Float32Array([x, y])]));
    }

    /**
     * Join a specific room
     */
    join(roomId: number) {
        this.sendMessage(`/join ${roomId}`);
    }

    /**
     * Login
     */
    login(username: string, password: string) {
        this.authenticate({
            credentials: {
                username,
                password,
            },
            roomId: this.getPreferredRoomId(),
        });
    }

    logout() {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY);
        }
        if (this._websocket) {
            this._websocket.close();
        }
    }

    register(username: string, password: string) {
        this.authenticate({
            credentials: {
                username,
                password,
                register: true,
            },
        });
    }

    authAsGuest() {
        this.authenticate({
            roomId: this.getPreferredRoomId(),
        });
    }

    authenticate(authData: AuthData) {
        this._sendRaw(JSON.stringify(authData));
    }

    /**
     * Emit an event to the server
     */
    private _sendEvent(eventName: string, payload: any) {
        if (!this._websocket) {
            return;
        }
        this._websocket.send(
            JSON.stringify({
                event: eventName,
                data: payload,
            }),
        );
    }

    /**
     * Get preferred room ID from local storage
     */
    private getPreferredRoomId() {
        if (typeof localStorage === 'undefined') {
            return undefined;
        }
        const rawRoomId = localStorage.getItem(SkyChatClient.LOCAL_STORAGE_ROOM_ID);
        return rawRoomId ? parseInt(rawRoomId) : undefined;
    }

    /**
     * When the connection is made with the websocket server
     */
    private _onWebSocketConnect() {
        if (typeof localStorage !== 'undefined') {
            const authToken = localStorage.getItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY);
            if (authToken) {
                this.authenticate({
                    token: JSON.parse(authToken),
                    roomId: this.getPreferredRoomId(),
                });
            }
        }
        this.emit('update', this.state);
    }

    /**
     * When a message is received on the websocket
     * @param message
     */
    private async _onWebSocketMessage(message: any) {
        let messageData = message.data;
        if (typeof Buffer !== 'undefined' && message.data.constructor === Buffer) {
            messageData = new Blob([message.data]);
        }
        // If raw audio received
        if ((messageData && messageData.constructor === Blob) || (typeof Buffer !== 'undefined' && messageData.constructor === Buffer)) {
            // Read message type, which is the first 2 bytes (UInt16)
            const buffer = await messageData.arrayBuffer();
            const view = new DataView(buffer);
            const messageType = view.getUint16(0, true);

            if (messageType === BinaryMessageTypes.AUDIO) {
                const messageId = view.getUint32(2, true);
                const audioBlob = messageData.slice(6);
                this.emit('audio', { id: messageId, blob: audioBlob });
            } else if (messageType === BinaryMessageTypes.CURSOR) {
                const id = view.getUint32(2, true);
                const x = view.getFloat32(6, true);
                const y = view.getFloat32(10, true);
                const entry = this._connectedList.find((entry) => entry.user.id === id);
                this.emit('cursor', {
                    user: entry ? entry.user : defaultUser,
                    x,
                    y,
                });
            } else {
                console.warn(`Unknown message type: ${messageType}`);
            }
            return;
        }
        // Otherwise, if normal json message received
        const data = JSON.parse(messageData);
        const eventName = data.event;
        const eventPayload = data.data;
        this.emit(eventName, eventPayload);
    }

    /**
     *
     */
    private _onWebSocketClose(event: any) {
        // Reset some (not all) values
        this._currentRoomId = null;
        this._typingList = [];
        this._polls = {};
        this._cursors = {};
        this._roll = { state: false };
        // Send state update
        this.emit('update', this.state);
        // If kicked, do not try to auto re-connect
        if (event.code === 4403) {
            return;
        }
        setTimeout(this.connect.bind(this), 1000);
    }
}
