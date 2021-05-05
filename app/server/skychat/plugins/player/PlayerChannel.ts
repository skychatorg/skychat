import { Session } from "../../Session";
import { SanitizedUser, User } from "../../User";
import { UserController } from "../../UserController";
import { PlayerChannelManager } from "./PlayerChannelManager";


export type QueuedVideoInfo = {
    user: SanitizedUser;
    video: VideoInfo;
};

export type VideoInfo = {

    /**
     * Video type (currently only youtube supported)
     */
        type: 'youtube';

        /**
         * Video data (for youtube, video id)
         */
        id: string;

        /**
         * Duration in ms
         */
        duration: number;

        /**
         * Video start time if video has started
         */
        startTime?: number;

        /**
         * The video should skip this specified amount of ms
         */
        startCursor: number;

        /**
         * Video title
         */
        title: string;

        /**
         * Video thumbnail image
         */
        thumb?: string;
}


export class PlayerChannel {

    public readonly id: number;

    public name: string;

    public readonly manager: PlayerChannelManager;

    public readonly sessions: Session[] = [];

    public queue: QueuedVideoInfo[] = [];

    public currentVideoInfo: QueuedVideoInfo | null = null;

    public playNextTimeout: NodeJS.Timeout | null = null;

    constructor(manager: PlayerChannelManager, id: number, name: string) {
        this.manager = manager;
        this.id = id;
        this.name = name;
    }

    /**
     * Play next video if possible
     */
    public playNext() {
        // If no video left to play
        if (! this.hasNext()) {
            // Remove current video & sync channel
            this.currentVideoInfo = null;
            this.sync();
            return;
        }
        // Otherwise, play next video
        this.currentVideoInfo = this.queue.shift() as QueuedVideoInfo;
        this.currentVideoInfo.video.startTime = new Date().getTime();
        this.armPlayNextTimeout();
        this.sync();
    }

    /**
     * Return whethers there is or not a next video to play
     */
    public hasNext(): boolean {
        return this.queue.length > 0;
    }

    /**
     * Returns whether there is currently something playing in the player
     */
    public isPlaying(): boolean {
        return !! this.currentVideoInfo;
    }

    /**
     * Arm or re-arm the function that will play the next video (if available)
     */
    public armPlayNextTimeout() {
        if (this.playNextTimeout) {
            clearTimeout(this.playNextTimeout);
        }
        // If currently off, but there is a next video to play
        if (! this.currentVideoInfo) {
            // Play it
            this.playNext();
            return;
        }
        // If currently playing a video, arm the timeout to end the video at the end of it
        const duration = this.currentVideoInfo.video.duration + 2 * 1000; // Add 2 seconds of margin before the next video
        this.playNextTimeout = setTimeout(this.playNext.bind(this), duration);
    }

    /**
     * Move the cursor from the currently playing video
     * @param delta Duration in ms
     */
    public moveCursor(delta: number) {
        if (! this.currentVideoInfo || ! this.currentVideoInfo.video.startTime) {
            throw new Error('No video playing currently');
        }
        this.currentVideoInfo.video.startTime -= delta;
        this.sync();
    }

    /**
     * Empty the queue
     */
    public flushQueue() {
        this.queue = [];
        this.sync();
    }

    /**
     * Skip the currently playing video
     */
    public skip() {
        this.playNext();
    }

    /**
     * Add one or multiple videos to the queue
     * @param video 
     * @param user 
     */
    public add(videoOrVideos: VideoInfo | VideoInfo[], user?: User): any {
        const videos = Array.isArray(videoOrVideos) ? videoOrVideos : [videoOrVideos];
        for (const video of videos) {
            this.queue.push({
                user: user ? user.sanitized() : UserController.getNeutralUser().sanitized(),
                video,
            });
        }
        this.armPlayNextTimeout();
    }

    /**
     * 
     */
    public getPlayerData() {
        let cursor = 0;
        if (this.currentVideoInfo && this.currentVideoInfo.video.startTime) {
            cursor = new Date().getTime() - this.currentVideoInfo.video.startTime;
        }
        return {
            current: this.currentVideoInfo,
            queue: this.queue,
            cursor,
        };
    }

    /**
     * Sync sessions in this channel
     */
    public sync() {
        const data = this.getPlayerData();
        for (const session of this.sessions) {
            session.send('player-sync', data);
        }
        this.manager.sync();
    }

    /**
     * Sync a given session
     * @param session 
     */
    public syncSession(session: Session) {
        session.send('player-sync', this.getPlayerData());
    }

    /**
     * What will be sent to the client
     */
    public sanitized(): {id: number, name: string, playing: boolean} {
        return {
            id: this.id,
            name: this.name,
            playing: this.isPlaying(),
        };
    }
}
