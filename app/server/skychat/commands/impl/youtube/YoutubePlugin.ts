import {Plugin} from "../../Plugin";
import {Room} from "../../../Room";
import {SanitizedUser, User} from "../../../User";
import {Session} from "../../../Session";
import {Connection} from "../../../Connection";
import {CommandEntryPointRule} from "../../Command";
import {google, youtube_v3} from "googleapis";
import * as fs from "fs";
import {IBroadcaster} from "../../../IBroadcaster";
import {Config} from "../../../Config";
import {Message} from "../../../Message";
import {UserController} from "../../../UserController";


/**
 * Something that can be played
 */
interface YoutubeVideoMeta {

    /**
     * Youtube video id
     */
    id: string;

    /**
     * Preview image url
     */
    thumb: string;

    /**
     * Description name
     */
    title: string

    /**
     * Duration in seconds
     */
    duration: number;
}

/**
 * A pending youtube videoin the queue
 */
interface PendingYoutubeVideo {
    user: User;
    video: YoutubeVideoMeta;
}

export type SanitizedYoutubeVideo = {
    user: SanitizedUser,
    video: YoutubeVideoMeta,
    startedDate: number,
    cursor: number
}

/**
 * A currently playing video
 */
interface CurrentYoutubeVideo extends PendingYoutubeVideo {
    /**
     * Date when the video has been started
     */
    startedDate: Date;
}

/**
 * Youtube plugin for the skychat
 */
export class YoutubePlugin extends Plugin {

    /**
     * Get the duration in seconds from the youtube duration
     * @param durationStr
     */
    private static youtubeDurationToSeconds(durationStr: string): number {
        if (durationStr.substr(0, 2) !== "PT") {
            return 0;
        }
        durationStr = durationStr.substr(2);
        const all_titles: {[key: string]: number} = {
            "h": 3600,
            "m": 60,
            "s": 1
        };
        let duration = 0;
        for (const i in all_titles) {
            const match = durationStr.match(new RegExp(`([0-9]+)${i}`, "i"))
            if (match) {
                duration += all_titles[i] * parseInt(match[1]);
            }
        }
        return duration;
    }

    readonly defaultDataStorageValue = true;

    readonly name = 'yt';

    readonly aliases = ['play'];

    readonly rules: {[alias: string]: CommandEntryPointRule} = {
        yt: {
            minCount: 1,
            maxCount: 1,
            params: [{name: 'action', pattern: /^(sync|off|on|list)$/}]
        },
        play: {
            minCount: 1,
            maxCount: 1,
            params: [{name: 'video id', pattern: /./}]
        }
    };

    private queue: PendingYoutubeVideo[] = [];

    private currentVideo: CurrentYoutubeVideo | null = null;

    private readonly youtube: youtube_v3.Youtube;

    constructor(room: Room) {
        super(room);

        this.youtube = google.youtube({version: 'v3', auth: Config.YOUTUBE_API_KEY});

        if (this.room) {
            setInterval(this.tick.bind(this), 1000);
        }
    }

    async run(alias: string, param: string, connection: Connection, session: Session, user: User, room: Room | null): Promise<void> {
        if (alias === 'yt') {
            await this.handleYt(param, connection);
        } else if (alias === 'play') {
            await this.handlePlay(param, connection);
        }
    }

    /**
     * Handle generic actions on the yt plugin (eg sync)
     * @param param
     * @param connection
     */
    private async handleYt(param: string, connection: Connection): Promise<void> {

        switch (param) {

            case 'sync':
                this.sync(connection);
                break;

            case 'on':
            case 'off':
                const newState = param === 'on';
                await UserController.savePluginData(connection.session.user, this.name, newState);
                if (newState) {
                    this.sync(connection);
                } else {
                    connection.send('yt-sync', null);
                }
                break;
            case 'list':
                await this.handleYtList(connection);
                break;
		}
    }

    /**
     * Play a video
     * @param param
     * @param connection
     */
    private async handlePlay(param: string, connection: Connection): Promise<void> {
        const video = await this.getYoutubeVideoMeta(param);
        this.queue.push({
            user: connection.session.user,
            video
        });
    }

    /**
     *
     * @param connection
     */
    private async handleYtList(connection: Connection): Promise<void> {
        const message = new Message('Videos in the queue:', null, UserController.getNeutralUser());
        for (const pending of this.queue) {
            message.append(' - ' + pending.video.title + ', added by ' +pending.user.username);
        }
        connection.send('message', message.sanitized());
    }

    /**
     * When client join the room, sync their yt player
     * @param connection
     */
    async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        this.sync(connection);
    }

    /**
     * Get a video metadata from its id
     * @param id
     */
    private async getYoutubeVideoMeta(id: string): Promise<YoutubeVideoMeta> {
        // Fetch youtube api
        const result = await this.youtube.videos.list({
            id: encodeURIComponent(id),
            part: 'snippet,contentDetails',
            maxResults: 1,
            fields: 'items(snippet(title,thumbnails),contentDetails,id),pageInfo',
        });
        // If no result
        if (! result.data.items || result.data.items.length === 0) {
            throw new Error('Video not found');
        }
        // Get item object
        const item = result.data.items[0];
        // If data is missing
        if (! item.contentDetails || ! item.contentDetails.duration || ! item.snippet || ! item.snippet.title || ! item.snippet.thumbnails || ! item.snippet.thumbnails.medium || ! item.snippet.thumbnails.medium.url) {
            throw new Error('Unable to load item info');
        }
        // Get important video data & return it
        const duration = YoutubePlugin.youtubeDurationToSeconds(item.contentDetails.duration);
        const title = item.snippet.title;
        const thumb = item.snippet.thumbnails.medium.url;
        return {id, duration, title, thumb};
    }

    /**
     *
     */
    private async tick(): Promise<void> {

        // If a video is playing currently
        if (this.currentVideo) {

            // If video has finished
            if (new Date() > new Date(this.currentVideo.startedDate.getTime() + this.currentVideo.video.duration * 1000 + 2000)) {
                this.currentVideo = null;

                // If there is no more video to play, sync clients (this will deactive the player)
                if (this.queue.length === 0) {
                    this.sync(this.room);
                }
            }
            return; // Wait until next tick
        }
        // Else, if no video is playing currently

        // Get the next video to play
        const nextVideo = this.queue.shift();
        // If there is none
        if (! nextVideo) {
            // Nothing to do. Wait until next tick.
            return;
        }
        // Else, play this video
        this.currentVideo = {...nextVideo, startedDate: new Date()};
        await this.room.sendMessage('Now playing: ' + nextVideo.video.title + ', added by ' + nextVideo.user.username, UserController.getNeutralUser(), null);
        this.sync(this.room);
    }

    /**
     * Sync clients in the room
     */
    public sync(broadcaster: Connection | Room) {
        if (broadcaster instanceof Room) {
            for (const connection of broadcaster.connections) {
                this.sync(connection);
            }
            return;
        }
        // If the user has cursors disabled
        if (! this.currentVideo || ! UserController.getPluginData(broadcaster.session.user, this.name)) {
            // Abort
            broadcaster.send('yt-sync', null);
            return;
        }
        broadcaster.send('yt-sync', {
            user: this.currentVideo.user.sanitized(),
            video: this.currentVideo.video,
            startedDate: this.currentVideo.startedDate.getTime() * 0.001,
            cursor: Date.now() * 0.001 - this.currentVideo.startedDate.getTime() * 0.001
        });
    }
}
