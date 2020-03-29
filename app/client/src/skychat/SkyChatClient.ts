import {EventEmitter} from "events";


export interface SkyChatClientConfig {
    host: string,
    port: number
}


export class SkyChatClient extends EventEmitter {

    public readonly config: SkyChatClientConfig;

    private webSocket: WebSocket | null;

    constructor(config: SkyChatClientConfig) {
        super();
        this.config = config;
        this.webSocket = null;
    }

    /**
     * Connect to the server
     */
    public connect() {
        this.webSocket = new WebSocket('ws://localhost:8080?debug');
        this.webSocket.addEventListener('message', this.onWebSocketMessage.bind(this));
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
}
