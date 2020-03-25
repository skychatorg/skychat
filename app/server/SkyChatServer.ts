import {Server} from "./Server";
import * as WebSocket from "ws";
import * as http from "http";

/**
 * The base server class for the skychat
 */
export class SkyChatServer {

    private readonly server: Server;

    constructor() {
        this.server = new Server({port: 8080});
        this.server.registerEvent('message', this.onMessage.bind(this), 'string');
        this.server.registerEvent('joinRoom', this.onJoinRoom.bind(this), 'number');
    }

    /**
     * When a message is received
     * @param payload
     * @param webSocket
     * @param request
     */
    private async onMessage(payload: string, webSocket: WebSocket, request: http.IncomingMessage) {
        console.log('message', payload);
    }

    /**
     * When an user wants to join a specific room
     * @param payload
     * @param webSocket
     * @param request
     */
    private async onJoinRoom(payload: number, webSocket: WebSocket, request: http.IncomingMessage) {
        console.log('joinRoom', payload);
    }
}
