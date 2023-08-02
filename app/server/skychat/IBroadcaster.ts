/**
 * A broadcaster is an object that can send events to one or multiple connections
 */
export interface IBroadcaster {
    send(event: string, payload: any): void;
}
