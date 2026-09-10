import { Connection } from '../../skychat/Connection.js';
import { Session } from '../../skychat/Session.js';
import { SanitizedUser, User } from '../../skychat/User.js';
import { UserController } from '../../skychat/UserController.js';
import { PlayerChannelManager } from './PlayerChannelManager.js';
import { PlayerChannelScheduler, SanitizedScheduler } from './PlayerChannelScheduler.js';
import { issueStreamToken, STREAM_TOKEN_TTL_MS } from './fetcher/JellyfinFetcher.js';

export type QueuedVideoInfo = {
    user: SanitizedUser;
    video: VideoInfo;
};

export type JellyfinAudioTrack = {
    index: number;
    language?: string;
    label: string;
    codec: string;
    isDefault: boolean;
};

export type JellyfinSubtitleTrack = {
    index: number;
    language?: string;
    label: string;
    codec: string;
    isTextBased: boolean;
    isDefault: boolean;
    isForced: boolean;
};

export type JellyfinVideoInfo = {
    mediaSourceId: string;
    container: string;
    videoCodec: string;
    audioTracks: JellyfinAudioTrack[];
    subtitleTracks: JellyfinSubtitleTrack[];
};

export type VideoInfo = {
    /**
     * Video type
     */
    type: 'youtube' | 'twitch' | 'gallery' | 'iframe' | 'jellyfin';

    /**
     * Video data (for youtube, video id; for jellyfin, item id)
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

    /**
     * Jellyfin-specific metadata (only present when type === 'jellyfin')
     */
    jellyfin?: JellyfinVideoInfo;
};

export type SanitizedPlayerChannel = {
    id: number;
    name: string;
    playing: boolean;
    paused: boolean;
    queueLength: number;
    /**
     * Users currently in the channel (i.e. watching the synced player). Built from the live
     * session list, so it includes guests, unlike the persisted per-user `data.plugins.player`.
     */
    users: SanitizedUser[];
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

    /**
     * When paused, holds the frozen cursor (ms). null means playing.
     * Kept in memory only (never persisted), so a restart can't leave a channel stuck paused.
     */
    public pausedCursor: number | null = null;

    /**
     * While a countdown resync is running, the wall-clock date (ms) at which everyone resumes.
     * Broadcast to clients so they can count down against an absolute instant rather than ticks,
     * which keeps the countdown immune to network latency. In memory only, like `pausedCursor`.
     */
    public resyncAt: number | null = null;

    private resyncTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * Last countdown resync, to rate limit it per channel. The generic command limiter keys on the
     * caller's IP, which does not stop several people from interrupting the same channel in turn.
     */
    private lastResyncDate: Date | null = null;

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
        this.cancelResync();
        // Save current media to history
        if (this.currentVideoInfo) {
            this.history.push(this.currentVideoInfo);
            this.history.splice(0, this.history.length - PlayerChannel.HISTORY_LENGTH);
        }
        // If no video left to play
        if (!this.hasNext()) {
            // Remove current video & sync channel
            this.pausedCursor = null;
            this.currentVideoInfo = null;
            this.sync();
            return;
        }
        // Otherwise, play next video
        this.pausedCursor = null;
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
            if (this.pausedCursor !== null) {
                return this.pausedCursor;
            }
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
        // While paused, never auto-advance: the timeout stays disarmed until resume re-arms it
        if (this.pausedCursor !== null) {
            return;
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
        this.cancelResync();
        this.currentVideoInfo.video.startTime -= delta;
        // When paused, the frozen cursor is authoritative, so move it too. replay30/skip30 reach
        // moveCursor without clamping, so keep the frozen cursor inside [0, duration].
        if (this.pausedCursor !== null) {
            const duration = this.currentVideoInfo.video.duration;
            this.pausedCursor += delta;
            this.pausedCursor = duration > 0 ? Math.min(Math.max(0, this.pausedCursor), duration) : Math.max(0, this.pausedCursor);
        }
        this.armPlayNextTimeout();
        this.sync();
    }

    /**
     * Pause the currently playing media (freezes the cursor for everyone).
     * No-op when nothing is playing, already paused, or the media is live (duration 0).
     */
    public pause() {
        if (!this.currentVideoInfo || this.pausedCursor !== null) {
            return;
        }
        if (this.currentVideoInfo.video.duration === 0) {
            return;
        }
        this.cancelResync();
        this.pausedCursor = this.getCursor();
        this.armPlayNextTimeout();
        this.sync();
    }

    /**
     * Resume a paused media, rebasing startTime so the cursor continues from where it froze.
     * No-op when nothing is playing or not currently paused.
     */
    public resume() {
        if (!this.currentVideoInfo || this.pausedCursor === null) {
            return;
        }
        this.cancelResync();
        this.currentVideoInfo.video.startTime = new Date().getTime() - this.pausedCursor;
        this.pausedCursor = null;
        this.armPlayNextTimeout();
        this.sync();
    }

    /**
     * Abort a pending countdown resync. Called from every path that moves the player itself, so a
     * scheduled resume can never fire after someone has seeked, skipped or paused in the meantime.
     */
    private cancelResync() {
        if (this.resyncTimeout) {
            clearTimeout(this.resyncTimeout);
            this.resyncTimeout = null;
        }
        this.resyncAt = null;
    }

    /**
     * Pause everyone, count down, then resume everyone together.
     *
     * The countdown is the point: it gives every client a window to seek and buffer before playback
     * resumes, which is what makes the resync land. Jellyfin especially needs it, since it cannot
     * seek and has to restart its transcode (see SEEK_DRIFT_MS in JellyfinPlayer.vue).
     *
     * Live media has no cursor to converge on, and `pause()` is a no-op for it, so it just gets an
     * immediate forced sync instead of a countdown that would do nothing.
     *
     * @param durationMs How long to count down for
     */
    public startCountdownResync(durationMs: number) {
        if (!this.currentVideoInfo) {
            throw new Error('Nothing is playing');
        }
        this.lastResyncDate = new Date();

        if (this.currentVideoInfo.video.duration === 0) {
            this.forcedSync();
            return;
        }

        // pause() cancels any running countdown and syncs the frozen cursor
        this.pause();
        this.resyncAt = Date.now() + durationMs;
        this.resyncTimeout = setTimeout(() => {
            this.resyncTimeout = null;
            this.resyncAt = null;
            this.resume();
        }, durationMs);
        // Tell everyone to reload/seek at the frozen cursor now, so they buffer during the countdown
        this.forcedSync();
    }

    /**
     * Whether a countdown resync may start right now
     */
    public canResync(cooldownMs: number): boolean {
        return !this.lastResyncDate || Date.now() - this.lastResyncDate.getTime() >= cooldownMs;
    }

    /**
     * Broadcast a forced sync to every connection in this channel. Goes through `syncConnections`
     * rather than `sync()` because `forced` has to reach every tab, and because the payload is built
     * per session (Jellyfin stream tokens are scoped to a user).
     */
    public forcedSync() {
        this.syncConnections(
            this.sessions.flatMap((session) => session.connections),
            { forced: true },
        );
    }

    /**
     * Release resources held by this channel
     */
    public destroy() {
        this.cancelResync();
        if (this.playNextTimeout) {
            clearTimeout(this.playNextTimeout);
            this.playNextTimeout = null;
        }
        this.scheduler.destroy();
    }

    /**
     * Seek the currently playing video to an absolute position
     * @param targetMs Absolute position in ms (clamped to [0, duration] when the duration is known)
     */
    public seek(targetMs: number) {
        const duration = this.currentVideoInfo?.video.duration ?? 0;
        const clamped = duration > 0 ? Math.min(Math.max(0, targetMs), duration) : Math.max(0, targetMs);
        // moveCursor re-arms the play-next timeout and syncs, and throws if nothing is playing.
        this.moveCursor(clamped - this.getCursor());
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
            paused: this.pausedCursor !== null,
            resyncAt: this.resyncAt,
        };
    }

    /**
     * Build the player-sync payload for a specific session. When the current item is
     * a Jellyfin media, include a signed stream token scoped to that session's user.
     * Returns the bare payload unchanged for non-Jellyfin content.
     */
    private buildSyncPayload(session: Session): ReturnType<PlayerChannel['getPlayerData']> & { streamToken?: string } {
        const data = this.getPlayerData();
        if (data.current?.video.type === 'jellyfin' && this.manager.plugin.canBrowseJellyfin(session)) {
            return { ...data, streamToken: issueStreamToken(session.user.id, Date.now() + STREAM_TOKEN_TTL_MS) };
        }
        return data;
    }

    /**
     * Sync sessions in this channel
     */
    public sync() {
        for (const session of this.sessions) {
            session.send('player-sync', this.buildSyncPayload(session));
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
     * @param options `forced: true` marks the sync as a manual "Synchronize" request, telling the
     *                client to reload at the room cursor regardless of its drift threshold.
     */
    public syncConnections(connections: Connection[], options?: { forced?: boolean }) {
        for (const connection of connections) {
            const payload = this.buildSyncPayload(connection.session);
            connection.send('player-sync', options?.forced ? { ...payload, forced: true } : payload);
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
            paused: this.pausedCursor !== null,
            queueLength: this.queue.length,
            users: this.sessions.map((session) => session.user.sanitized()),
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
