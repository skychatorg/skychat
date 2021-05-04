import { Session } from "../../Session";
import { PlayerChannelManager } from "./PlayerChannelManager";



export class PlayerChannel {

    public readonly id: number;

    public name: string;

    public readonly manager: PlayerChannelManager;

    public readonly sessions: Session[] = [];

    constructor(manager: PlayerChannelManager, id: number, name: string) {
        this.manager = manager;
        this.id = id;
        this.name = name;
    }

    /**
     * Move the cursor from the currently playing video
     * @param delta Duration in ms
     */
    public moveCursor(delta: number) {
        throw new Error('Not implemented');
    }

    /**
     * Empty the queue
     */
    public flushQueue() {
        throw new Error('Not implemented');
    }

    /**
     * Skip the currently playing video
     */
    public skip() {
        throw new Error('Not implemented');
    }

    /**
     * 
     * @returns 
     */
    public getPlayerData(): any {
        return {};
    }

    /**
     * Sync sessions in this channel
     */
    public sync() {
        const data = this.getPlayerData();
        for (const session of this.sessions) {
            session.send('player', data);
        }
    }

    /**
     * Sync a given session
     * @param session 
     */
    public syncSession(session: Session) {
        session.send('player', this.getPlayerData());
    }

    /**
     * What will be sent to the client
     */
    public sanitized(): {id: number, name: string} {
        return { id: this.id, name: this.name, };
    }
}
