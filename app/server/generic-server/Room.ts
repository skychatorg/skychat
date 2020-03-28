import {Session} from "./Session";


export class Room {

    /**
     * Sessions that are within this room
     */
    public sessions: Session[] = [];

    /**
     * Detach a session from this room
     * @param session
     */
    public detachSession(session: Session) {
        this.sessions = this.sessions.filter(s => s !== session);
    }

    /**
     * Attach a session to this room
     * @param session
     */
    public attachSession(session: Session) {
        if (session.room === this) {
            return;
        }
        if (session.room) {
            session.room.detachSession(session);
        }
        session.room = this;
        this.sessions.push(session);
    }

    /**
     * Send to all sessions
     * @param event
     * @param payload
     */
    public send(event: string, payload: any): void {
        this.sessions.forEach(session => session.send(event, payload));
    }
}
