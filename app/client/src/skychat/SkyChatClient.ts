import {EventEmitter} from "events";
import {SanitizedUser} from "../../../server/skychat/User";
import {SanitizedMessage} from "../../../server/skychat/Message";
import {SanitizedYoutubeVideo} from "../../../server/skychat/commands/impl/YoutubePlugin";



export interface SkyChatClientConfig {
    host: string,
    port: number
}


export class SkyChatClient extends EventEmitter {

    public static readonly LOCAL_STORAGE_TOKEN_KEY: string = 'auth-token';

    public readonly config: SkyChatClientConfig;

    private webSocket: WebSocket | null;

    private readonly store: any;

    constructor(config: SkyChatClientConfig, store: any) {
        super();
        this.config = config;
        this.webSocket = null;
        this.store = store;
    }

    /**
     * Connect to the server
     */
    public connect() {
        this.webSocket = new WebSocket('ws://' + this.config.host + ':' + this.config.port);
        this.webSocket.addEventListener('open', this.onWebSocketConnect.bind(this));
        this.webSocket.addEventListener('message', this.onWebSocketMessage.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('set-user', this.onSetUser.bind(this));
        this.on('connected-list', this.onConnectedList.bind(this));
        this.on('yt-sync', this.onYtSync.bind(this));
        this.on('auth-token', this.onAuthToken.bind(this));
        this.on('typing-list', this.onTypingList.bind(this));
    }

    /**
     * When the connection is made with the websocket server
     */
    public onWebSocketConnect(): void {
        const authToken = localStorage.getItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY);
        if (authToken) {
            this.sendEvent('set-token', JSON.parse(authToken));
        }
    }

    /**
     * When a message is received on the websocket
     * @param message
     */
    public onWebSocketMessage(message: any) {
        const data = JSON.parse(message.data);
        const eventName = data.event;
        const eventPayload = data.data;
        this.emit(eventName, eventPayload);
    }

    /**
     * Emit an event to the server
     * @param eventName
     * @param payload
     */
    public sendEvent(eventName: string, payload: any): void {
        if (! this.webSocket) {
            return;
        }
        this.webSocket.send(JSON.stringify({
            event: eventName,
            data: payload
        }));
    }

    /**
     * Send a message to the server
     * @param message
     */
    public sendMessage(message: string): void {
        this.sendEvent('message', message);
    }

    /**
     * Set typing state
     * @param typing
     */
    public setTyping(typing: boolean): void {
        this.sendMessage('/t ' + (typing ? 'on' : 'off'));
    }

    /**
     * Login
     * @param username
     * @param password
     */
    public login(username: string, password: string): void {
        this.sendEvent('login', {username, password});
    }

    /**
     * Register
     * @param username
     * @param password
     */
    public register(username: string, password: string): void {
        this.sendEvent('register', {username, password});
    }

    /**
     *
     * @param token auth token
     */
    private onAuthToken(token: any): void {
        localStorage.setItem(SkyChatClient.LOCAL_STORAGE_TOKEN_KEY, JSON.stringify(token));
    }

    /**
     *
     * @param message
     */
    private onMessage(message: SanitizedMessage): void {
        this.store.commit('NEW_MESSAGE', message);
    }

    /**
     *
     * @param user
     */
    private onSetUser(user: SanitizedUser): void {
        this.store.commit('SET_USER', user);
    }

    /**
     *
     * @param users
     */
    private onConnectedList(users: SanitizedUser[]): void {
        this.store.commit('SET_CONNECTED_LIST', users);
    }

    /**
     *
     * @param video
     */
    private onYtSync(video: SanitizedYoutubeVideo): void {
        this.store.commit('SET_CURRENT_VIDEO', video);
    }

    /**
     *
     * @param users
     */
    private onTypingList(users: SanitizedUser[]): void {
        this.store.commit('SET_TYPING_LIST', users);
    }
}
