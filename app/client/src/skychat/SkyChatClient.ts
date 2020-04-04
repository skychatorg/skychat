import {EventEmitter} from "events";
import {SanitizedUser} from "../../../server/skychat/User";
import {SanitizedMessage} from "../../../server/skychat/Message";
import {SanitizedYoutubeVideo} from "../../../server/skychat/commands/impl/YoutubePlugin";



export interface SkyChatClientConfig {
    host: string,
    port: number
}


export class SkyChatClient extends EventEmitter {

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
        this.webSocket.addEventListener('message', this.onWebSocketMessage.bind(this));
        this.on('message', this.onMessage.bind(this));
        this.on('set-user', this.onSetUser.bind(this));
        this.on('connected-list', this.onConnectedList.bind(this));
        this.on('yt-sync', this.onYtSync.bind(this));
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
     * Send a message to the server
     * @param message
     */
    public sendMessage(message: string): void {
        if (! this.webSocket) {
            return;
        }
        this.webSocket.send(JSON.stringify({
            event: 'message',
            data: message
        }));
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
}
