import { Connection } from '../../skychat/Connection';
import { Session } from '../../skychat/Session';
import { SanitizedUser, User } from '../../skychat/User';
import { UserController } from '../../skychat/UserController';
import { PlayerChannelManager } from './PlayerChannelManager';
import { PlayerChannelScheduler, SanitizedScheduler } from './PlayerChannelScheduler';

export type QueuedVideoInfo = {
    user: SanitizedUser;
    video: VideoInfo;
};

export type VideoInfo = {
    /**
     * Video type (currently only youtube supported)
     */
    type: 'youtube' | 'twitch' | 'gallery' | 'iframe';

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
};

export type SanitizedPlayerChannel = {
    id: number;
    name: string;
    playing: boolean;
    currentMedia:
        | {
              owner: string;
              title: string;
          }
        | undefined;
    schedule: SanitizedScheduler;
};

export class PlayerChannel {
    public static readonly HISTORY_LENGTH = 200;

    public readonly id: number;

    public name: string;

    public readonly manager: PlayerChannelManager;

    public readonly scheduler: PlayerChannelScheduler;

    public readonly sessions: Session[] = [];

    public queue: QueuedVideoInfo[] = [];

    public history: QueuedVideoInfo[] = [];

    /**
     * Whether this channel is locked (= only OP can interact with it)
     */
    public locked = false;

    /**
     * Keeps track of the dates when user last played a media
     */
    public lastPlayedDates: { [userid: string]: Date } = {};

    public currentVideoInfo: QueuedVideoInfo | null = null;

    public playNextTimeout: any = null;

    constructor(manager: PlayerChannelManager, id: number, name: string) {
        this.manager = manager;
        this.id = id;
        this.name = name;
        this.scheduler = new PlayerChannelScheduler(this);
    }

    /**
     * Schedule a media
     * @param media
     * @param start
     * @param duration
     */
    public schedule(media: VideoInfo, start: number, duration?: number) {
        this.scheduler.add(media, start, duration);
        this.manager.emit('channels-changed', this.manager.channels);
    }

    /**
     * Unschedule a media
     * @param start
     */
    public unschedule(start: number) {
        this.scheduler.remove(start);
        this.manager.emit('channels-changed', this.manager.channels);
    }

    /**
     * Play next video if possible
     */
    public playNext() {
        // Save current media to history
        if (this.currentVideoInfo) {
            this.history.push(this.currentVideoInfo);
            this.history.splice(0, this.history.length - PlayerChannel.HISTORY_LENGTH);
        }
        // If no video left to play
        if (!this.hasNext()) {
            // Remove current video & sync channel
            this.currentVideoInfo = null;
            this.sync();
            return;
        }
        // Otherwise, play next video
        this.currentVideoInfo = this.queue.shift() as QueuedVideoInfo;
        this.currentVideoInfo.video.startTime = new Date().getTime();
        this.lastPlayedDates[this.currentVideoInfo.user.id] = new Date();
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
        return !!this.currentVideoInfo;
    }

    /**
     * Get current cursor in ms
     */
    public getCursor(): number {
        if (this.currentVideoInfo && this.currentVideoInfo.video.startTime) {
            return new Date().getTime() - this.currentVideoInfo.video.startTime;
        }
        return 0;
    }

    /**
     * Arm or re-arm the function that will play the next video (if available)
     */
    public armPlayNextTimeout() {
        if (this.playNextTimeout) {
            clearTimeout(this.playNextTimeout);
        }
        // If currently off, but there is a next video to play
        if (!this.currentVideoInfo) {
            // Play it on next tick
            this.playNextTimeout = setTimeout(this.playNext.bind(this), 0);
            return;
        }
        // If currently playing a video which has no duration (plays indefinitively)
        if (this.currentVideoInfo.video.duration === 0) {
            return;
        }
        // If currently playing a video with a duration, arm the timeout to end the video at the end of it
        const duration = this.currentVideoInfo.video.duration - this.getCursor() + 2 * 1000; // Add 2 seconds of margin before the next video
        this.playNextTimeout = setTimeout(this.playNext.bind(this), duration);
    }

    /**
     * Move the cursor from the currently playing video
     * @param delta Duration in ms
     */
    public moveCursor(delta: number) {
        if (!this.currentVideoInfo || !this.currentVideoInfo.video.startTime) {
            throw new Error('No video playing currently');
        }
        this.currentVideoInfo.video.startTime -= delta;
        this.armPlayNextTimeout();
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
     * Whether the given video is already in the list or currently playing
     * @param video
     * @returns
     */
    public isVideoPlayingOrInQueue(video: VideoInfo): boolean {
        if (this.queue.find((q) => q.video.type === video.type && q.video.id === video.id)) {
            return true;
        }
        if (this.currentVideoInfo && this.currentVideoInfo.video.type === video.type && this.currentVideoInfo.video.id === video.id) {
            return true;
        }
        return false;
    }

    /**
     * Add one or multiple videos to the queue
     * @param video
     * @param user
     * @param options
     */
    public add(videoOrVideos: VideoInfo | VideoInfo[], user?: User, options?: { allowFailure: boolean }): number {
        const videos = Array.isArray(videoOrVideos) ? videoOrVideos : [videoOrVideos];
        options = options || { allowFailure: false };
        let addedCount = 0;
        for (const video of videos) {
            // If video is already in the queue
            if (this.isVideoPlayingOrInQueue(video)) {
                if (!options.allowFailure) {
                    throw new Error(`Media ${video.id} is already in the list`);
                }
                continue;
            }
            // Add video to the queue
            this.queue.push({
                user: user ? user.sanitized() : UserController.getNeutralUser().sanitized(),
                video,
            });
            ++addedCount;
        }
        if (addedCount > 0) {
            this.fairShuffle();
            this.sync();
            this.armPlayNextTimeout();
        }
        return addedCount;
    }

    /**
     * Retrieve an entry in the queue if it exists. If not, returns null.
     */
    public getQueueEntry(type: string, id: VideoInfo['id']): QueuedVideoInfo | null {
        return this.queue.find((q) => q.video.type === type && q.video.id === id) || null;
    }

    /**
     * Remove a specific video from the queue
     * @param video
     */
    public remove(video: VideoInfo) {
        this.queue = this.queue.filter((q) => q.video.type !== video.type || q.video.id !== video.id);
        this.sync();
    }

    /**
     * Return whether a identifier is authorized to manage the player right now
     * @param identifier
     */
    public hasPlayerPermission(session: Session) {
        // If session is OP
        if (session.isOP()) {
            return true;
        }
        // If player is locked, no one but OP can modify it
        if (this.locked) {
            return false;
        }
        // If a media is currently playing
        if (this.currentVideoInfo) {
            // Current media owner
            const owner = this.currentVideoInfo.user.username.toLowerCase();
            // If media owner is session
            if (owner === session.identifier) {
                return true;
            }
            // If media owner left
            const ownerSession = Session.getSessionByIdentifier(owner);
            if (!ownerSession || !ownerSession.isAlive()) {
                return true;
            }
        }
        return false;
    }

    /**
     *
     */
    public getPlayerData() {
        return {
            current: this.currentVideoInfo,
            queue: this.queue,
            cursor: this.getCursor(),
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
     * Shuffle the queued videos fairly, ensuring a round-robin among users
     */
    public fairShuffle() {
        // Build a separate queue for each user
        const users: { [id: number]: QueuedVideoInfo[] } = {};
        for (const queuedVideo of this.queue) {
            if (typeof users[queuedVideo.user.id] === 'undefined') {
                users[queuedVideo.user.id] = [];
            }
            users[queuedVideo.user.id].push(queuedVideo);
        }
        // Sort users fairly
        const userIds: number[] = Object.keys(users).map((k) => parseInt(k));
        userIds.sort((id1, id2) => {
            const getDate = (id: number) => (this.lastPlayedDates[id] ? this.lastPlayedDates[id].getTime() : 0);
            return getDate(id1) - getDate(id2);
        });
        // Re-build the new queue
        const queue: QueuedVideoInfo[] = [];
        let addedCount = Infinity;
        while (addedCount !== 0) {
            // For each user, add at most one media in the queue
            // If there is no media left to add, addedCount will be 0 at the end of the for
            addedCount = 0;
            for (const userId of userIds) {
                const queuedVideo = users[userId].shift();
                if (!queuedVideo) {
                    continue;
                }
                queue.push(queuedVideo);
                ++addedCount;
            }
        }
        this.queue = queue;
    }

    /**
     * Sync a given list of connections
     * @param connections
     */
    public syncConnections(connections: Connection[]) {
        for (const connection of connections) {
            connection.send('player-sync', this.getPlayerData());
        }
    }

    /**
     * What will be sent to the client in the list of channels (All users have this info, even the one not in it)
     * This object is also saved in the plugin storage
     */
    public sanitized(): SanitizedPlayerChannel {
        return {
            id: this.id,
            name: this.name,
            playing: this.isPlaying(),
            currentMedia: this.currentVideoInfo
                ? {
                    owner: this.currentVideoInfo.user.username,
                    title: this.currentVideoInfo.video.title,
                }
                : undefined,
            schedule: this.scheduler.sanitized(),
        };
    }
}
