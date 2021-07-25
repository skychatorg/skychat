import { PlayerChannel, VideoInfo } from "./PlayerChannel";


export type SchedulerEvent = {
    start: number;
    duration: number;
    media: VideoInfo;
};


export type SanitizedScheduler = {
    events: SchedulerEvent[];
};


export class PlayerChannelScheduler {

    /**
     * Default added media duration when none is provided (i.e. for twitch streams)
     */
    static readonly DEFAULT_DURATION = 2 * 60 * 60 * 1000;

    /**
     * List of past events.
     * An event is considered in the past if its end timestamp is inferior than the current timestamp.
     * Past events are sorted from oldest to less-old.
     */
    private pastEvents: SchedulerEvent[] = [];

    /**
     * List of future events. This includes event that already started and are still in progress.
     * Once an event is finished, it is taken away from this list and put in pastEvents.
     * There may be a delay when past events are still in this list due to the current implementation of the scheduler.
     * Future events are sorted from nearest to farest.
     */
    private futureEvents: SchedulerEvent[] = [];

    /**
     * Reference to the linked player channel
     */
    public readonly playerChannel: PlayerChannel;

    constructor(playerChannel: PlayerChannel) {
        this.playerChannel = playerChannel;

        setInterval(this.tick.bind(this), 5 * 1000);
    }

    /**
     * Get the list of all events
     */
    get events(): SchedulerEvent[] {
        return this.pastEvents.concat(this.futureEvents);
    }

    /**
     * 
     * @param start Start timestamp in ms
     * @param media Media information
     * @param duration Duration in ms
     */
    add(media: VideoInfo, start: number, duration?: number) {
        // Check that the duration is ok & build the event object
        duration = duration || media.duration || PlayerChannelScheduler.DEFAULT_DURATION;
        const event: SchedulerEvent = { start, duration, media };
        // Check that the start time is after now
        if (event.start + event.duration < new Date().getTime()) {
            throw new Error('Can not schedule media in the past');
        }
        // Insert the event
        this.insertEvent(event);
    }

    /**
     * Insert an event. Internally put it in the correct list, and already sorted
     * @param newEvent 
     */
    insertEvent(newEvent: SchedulerEvent) {
        // Check that the time slot is available
        if (! this.isTimeSlotFree(newEvent.start, newEvent.start + newEvent.duration)) {
            throw new Error('Time slot is not free');
        }
        // Find the list in which to add this event
        const eventList = newEvent.start + newEvent.duration < new Date().getTime() ? this.pastEvents : this.futureEvents;
        // Find sorted index in the list where to add this event
        let index = 0;
        while (eventList[index] && eventList[index].start + eventList[index].duration < newEvent.start) {
            ++ index;
        }
        eventList.splice(index, 0, newEvent);
    }

    /**
     * Remove a scheduled event
     * @param start 
     */
    remove(start: number) {
        this.pastEvents = this.pastEvents.filter(event => event.start !== start);
        this.futureEvents = this.futureEvents.filter(event => event.start !== start);
    }

    /**
     * @param start Start timestamp in ms
     * @param end End timestamp in ms
     * @returns whether a time slot is free or not
     */
    isTimeSlotFree(start: number, end: number): boolean {
        const conflictingEvent = this.events.find(event => {
            // start < e.start < end
            //      [    ]  : existing event
            //   [    ]     : new slot
            if (start < event.start && event.start < end) {
                return true;
            }
            // start < e.end < end
            // [    ]       : existing event
            //    [    ]    : new slot
            if (start < event.start + event.duration && event.start + event.duration < end) {
                return true;
            }
            // e.start < start < end < e.end
            // [       ]    : existing event
            //   [  ]       : new slot
            if (event.start < start && end < event.start + event.duration) {
                return true;
            }
            return false;
        });
        return ! conflictingEvent;
    }

    /**
     * Tick method
     */
    tick(): void {
        // Build the current state of the channel
        let currentEvent: SchedulerEvent | null = null;
        // Get next event in list
        const nextEvent = this.futureEvents[0] || null;
        // If there is no event currently on, wait for the next tick
        if (! nextEvent) {
            // If there is no event to play next

        } else if (nextEvent.start > new Date().getTime()) {
            // If the event to play next as not yet started

        } else if (nextEvent.start + nextEvent.duration < new Date().getTime()) {
            // If current event has just finished, move the finished event in the list of past events
            this.pastEvents.push(this.futureEvents.shift() as SchedulerEvent);
        
        } else {
            // An event is currently in progress
            currentEvent = nextEvent;

        }

        // If there is an event in progress, but the channel is not playing it
        if (currentEvent && (! this.playerChannel.currentVideoInfo || this.playerChannel.currentVideoInfo.video.id !== currentEvent.media.id)) {
            // Empty the channel queue
            this.playerChannel.locked = true;
            this.playerChannel.flushQueue();
            this.playerChannel.add(currentEvent.media);
        }

        // If there is not event in progress but the channel is still locked
        if (! currentEvent && this.playerChannel.locked) {
            this.playerChannel.flushQueue();
            this.playerChannel.skip();
            this.playerChannel.locked = false;
        }
    }

    /**
     * Returns all the past and future events, sorted by date
     * @returns 
     */
    sanitized(): SanitizedScheduler {
        return {
            events: this.events,
        }
    }
}
