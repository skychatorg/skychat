import { EventEmitter } from "events";


export class SkyChatClient extends EventEmitter {

    constructor(store) {
        super();
        this.webSocket = null;
        this.firstConnection = true;
        this.store = store;
        this.bind();
    }

    /**
     * Connect to the server
     */
    connect() {
        const protocol = document.location.protocol === 'http:' ? 'ws' : 'wss';
        this.webSocket = new WebSocket(protocol + '://' + document.location.host);
        this.webSocket.addEventListener('open', this.onWebSocketConnect.bind(this));
        this.webSocket.addEventListener('message', this.onWebSocketMessage.bind(this));
        this.webSocket.addEventListener('close', this.onWebSocketClose.bind(this));
        this.store.commit('SET_CONNECTION_STATE', WebSocket.CONNECTING);
    }

    /**
     * Bind own event listeners
     */
    bind() {
        this.on('join-room', this.onJoinRoom.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('private-message', this.onPrivateMessage.bind(this));
        this.on('message-edit', this.onMessageEdit.bind(this));
        this.on('set-user', this.onSetUser.bind(this));
        this.on('connected-list', this.onConnectedList.bind(this));
        this.on('yt-sync', this.onYtSync.bind(this));
        this.on('poll', this.onPoll.bind(this));
        this.on('poll-result', this.onPollResult.bind(this));
        this.on('auth-token', this.onAuthToken.bind(this));
        this.on('typing-list', this.onTypingList.bind(this));
        this.on('cursor', this.onCursor.bind(this));
        this.on('error', this.onError.bind(this));
        this.on('roll', this.onRoll.bind(this));
        this.on('ytapi:search', this.onYtApiSearchResults.bind(this));
    }

    /**
     * When the connection is made with the websocket server
     */
    onWebSocketConnect() {
        const authToken = localStorage.getItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY);
        if (authToken) {
            this.sendEvent('set-token', JSON.parse(authToken));
        }
        if (! this.firstConnection) {
            this.sendEvent('join-room', {roomId: 0});
        }
        this.store.commit('SET_CONNECTION_STATE', WebSocket.OPEN);
        this.firstConnection = false;
    }

    /**
     * When a message is received on the websocket
     * @param message
     */
    onWebSocketMessage(message) {
        const data = JSON.parse(message.data);
        const eventName = data.event;
        const eventPayload = data.data;
        this.emit(eventName, eventPayload);
    }

    /**
     *
     */
    onWebSocketClose(event) {
        this.store.commit('SET_CONNECTION_STATE', WebSocket.CLOSED);
        if (event.code === 4403) {
            new Noty({
                type: 'error',
                layout: 'topCenter',
                theme: 'nest',
                text: event.reason,
                timeout: 2000
            }).show();
            return;
        }
        setTimeout(this.connect.bind(this), 1000);
    }

    /**
     * Emit an event to the server
     * @param eventName
     * @param payload
     */
    sendEvent(eventName, payload) {
        if (!this.webSocket) {
            return;
        }
        this.webSocket.send(JSON.stringify({
            event: eventName,
            data: payload
        }));
    }

    /**
     * Send cursor position
     * @param x
     * @param y
     */
    sendCursor(x, y) {
        this.sendMessage('/c ' + x + ' ' + y);
    }

    /**
     * Send a message to the server
     * @param message
     */
    sendMessage(message) {
        this.sendEvent('message', message);
    }

    /**
     * Send a PM to the given username
     * @param username
     * @param message
     */
    sendPrivateMessage(username, message) {
        return this.sendMessage('/mp ' + username + ' ' + message);
    }

    /**
     * Set typing state
     * @param typing
     */
    setTyping(typing) {
        this.sendMessage('/t ' + (typing ? 'on' : 'off'));
    }

    /**
     * Set this user's avatar
     * @param avatar
     */
    setAvatar(avatar) {
        this.sendMessage('/avatar ' + avatar);
    }

    /**
     * Synchronize the youtube player
     */
    ytSync() {
        this.sendMessage('/yt sync');
    }

    /**
     * Set youtube state
     * @param {boolean} state
     */
    ytSetState(state) {
        this.sendMessage('/yt ' + (state ? 'on' : 'off'));
    }

    /**
     * Set cursor state
     * @param state
     */
    cursorSetState(state) {
        this.sendMessage('/cursor ' + (state ? 'on' : 'off'));
    }

    /**
     * Join a specific room
     * @param roomId
     */
    joinRoom(roomId) {
        this.sendEvent('join-room', { roomId });
    }

    /**
     * Login
     * @param username
     * @param password
     */
    login(username, password) {
        this.sendEvent('login', { username, password });
    }

    /**
     * Logout
     */
    logout() {
        localStorage.removeItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY);
        if (this.webSocket) {
            this.webSocket.close();
        }
    }

    /**
     * Register
     * @param username
     * @param password
     */
    register(username, password) {
        this.sendEvent('register', { username, password });
    }

    /**
     * Register
     * @param pollId
     * @param answer
     */
    vote(pollId, answer) {
        this.sendMessage(`/vote ${pollId} ${answer ? 'y' : 'n'}`);
    }

    /**
     *
     * @param token auth token
     */
    onAuthToken(token) {
        if (token) {
            localStorage.setItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY, JSON.stringify(token));
        } else {
            localStorage.removeItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY);
        }
    }

    /**
     *
     * @param roomId
     */
    onJoinRoom(roomId) {
        this.store.commit('SET_CURRENT_ROOM', roomId);
    }

    /**
     *
     * @param message
     */
    onMessage(message) {
        this.store.commit('NEW_MESSAGE', message);

        if (this.store.state.user.right >= 0) {
            this.sendMessage(`/lastseen ${message.id}`)
        }
    }

    /**
     *
     * @param privateMessage
     */
    onPrivateMessage(privateMessage) {
        this.store.commit('NEW_PRIVATE_MESSAGE', privateMessage);
    }

    /**
     *
     * @param message
     */
    onMessageEdit(message) {
        this.store.commit('MESSAGE_EDIT', message);
    }

    /**
     *
     * @param user
     */
    onSetUser(user) {
        this.store.commit('SET_USER', user);
    }

    /**
     *
     * @param users
     */
    onConnectedList(users) {
        this.store.commit('SET_CONNECTED_LIST', users);
    }

    /**
     *
     * @param playerState
     */
    onYtSync(playerState) {
        this.store.commit('SET_PLAYER_STATE', playerState);
    }

    /**
     *
     * @param polls
     */
    onPoll(polls) {
        this.store.commit('SET_POLLS', polls);
    }

    /**
     *
     * @param pollResult
     */
    onPollResult(pollResult) {
        this.store.commit('SET_POLL_RESULT', pollResult);
    }

    /**
     *
     * @param users
     */
    onTypingList(users) {
        this.store.commit('SET_TYPING_LIST', users);
    }

    /**
     *
     */
    onCursor(cursor) {
        this.store.commit('NEW_CURSOR', cursor);
    }

    /**
     *
     */
    onRoll(roll) {
        this.store.commit("SET_ROLL_STATE", roll.state);
    }

    /**
     *
     */
    onYtApiSearchResults(items) {
        this.store.commit("SET_YT_API_SEARCH_RESULTS", items);
    }

    /**
     *
     */
    onError(error) {
        new Noty({
            type: 'error',
            layout: 'topCenter',
            theme: 'nest',
            text: error,
            timeout: 2000
        }).show();
    }
}

SkyChatClient.LOCAL_STORAGE_TOKEN_KEY = 'auth-token';

