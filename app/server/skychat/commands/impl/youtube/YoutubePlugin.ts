import {Plugin} from "../../Plugin";
import {Room} from "../../../Room";
import {User} from "../../../User";
import {Session} from "../../../Session";
import {Connection} from "../../../Connection";
import {CommandEntryPointRule} from "../../Command";
import {google, youtube_v3} from "googleapis";
import {Config} from "../../../Config";
import {Message} from "../../../Message";
import {UserController} from "../../../UserController";
import {PendingYoutubeVideo} from "./PendingYoutubeVideo";
import {YoutubeVideoMeta} from "./YoutubeVideoMeta";
import {CurrentYoutubeVideo, SanitizedCurrentYoutubeVideo} from "./CurrentYoutubeVideo";
import {YoutubeHelper} from "./YoutubeHelper";



/**
 * Youtube plugin for the skychat
 */
export class YoutubePlugin extends Plugin {

    readonly defaultDataStorageValue = true;

    readonly name = 'yt';

    readonly aliases = ['play', 'playpl', '~'];

    readonly rules: {[alias: string]: CommandEntryPointRule} = {
        yt: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 10,
            params: [{name: 'action', pattern: /^(sync|off|on|list|skip|shuffle|flush)$/}]
        },
        play: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 5,
            params: [{name: 'video id', pattern: /./}]
        },
        playpl: {
            minCount: 1,
            maxCount: 1,
            coolDown: 1000,
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
        } else if (alias === '~') {
            await this.handleSearchAndPlay(param, connection);
        } else if (alias === 'playpl') {
            await this.handlePlayPlaylist(param, connection);
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
                this.sync(connection);
                connection.session.syncUserData();
                break;

            case 'list':
                await this.handleYtList(connection);
                break;

            case 'skip':
                await this.handleYtSkip(connection);
                break;

            case 'shuffle':
                this.shuffleQueue();
                break;

            case 'flush':
                if (! Config.isOP(connection.session.identifier)) {
                    throw new Error('You need to be OP to flush the youtube queue');
                }
                this.queue.splice(0);
                break;
        }
    }

    /**
     * Play a video
     * @param param
     * @param connection
     */
    private async handlePlay(param: string, connection: Connection): Promise<void> {
        let id;
        let match;
        if (match = param.match(/v=([a-zA-Z0-9-_]+)/)) {
            id = match[1];
        } else {
            id = param;
        }
        const video = await YoutubeHelper.getYoutubeVideoMeta(this.youtube, id);
        this.queue.push({user: connection.session.user, video});
        this.shuffleQueue();
    }

    /**
     * Play a whole playlist
     * @param param
     * @param connection
     */
    private async handlePlayPlaylist(param: string, connection: Connection): Promise<void> {
        let id;
        let match;
        if (match = param.match(/list=([a-zA-Z0-9-_]+)/)) {
            id = match[1];
        } else {
            id = param;
        }
        const result = await this.youtube.playlistItems.list({part: 'contentDetails', playlistId: id, maxResults: 50});
        if (! result || ! result.data || ! result.data.items || result.data.items.length === 0) {
            throw new Error('No result found for ' + param);
        }
        const videoIds: string[] = result.data.items
            .filter(item => item.contentDetails && item.contentDetails.videoId)
            .map(item => item.contentDetails!.videoId as string);
        for (const videoId of videoIds) {
            const video = await YoutubeHelper.getYoutubeVideoMeta(this.youtube, videoId);
            this.queue.push({user: connection.session.user, video});
        }
        this.shuffleQueue();
    }

    /**
     * Search + play a video
     * @param param
     * @param connection
     */
    private async handleSearchAndPlay(param: string, connection: Connection): Promise<void> {
        const result = await this.youtube.search.list({
            'part': 'snippet',
            'q': param,
            'type': 'video'
        });
        if (! result || ! result.data || ! result.data.items || result.data.items.length === 0 || ! result.data.items[0].id || ! result.data.items[0].id.videoId) {
            throw new Error('No result found for ' + param);
        }
        const videoId = result.data.items[0].id.videoId;
        const video = await YoutubeHelper.getYoutubeVideoMeta(this.youtube, videoId);
        this.queue.push({user: connection.session.user, video});
        this.shuffleQueue();
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
     * @param connection
     */
    private async handleYtSkip(connection: Connection): Promise<void> {
        if (! this.currentVideo) {
            return;
        }
        if (! Config.isOP(connection.session.identifier)
            && this.currentVideo.user.id !== connection.session.user.id
            && this.room.containsUser(this.currentVideo.user.id)) {
            throw new Error('You do not have the right to skip this song');
        }
        this.currentVideo.startedDate = new Date(0);
    }

    /**
     * Shuffle the queue fairly
     */
    private shuffleQueue(): void {
        // store pending videos by owner
        const entries: {[username: string]: PendingYoutubeVideo[]} = {};
        this.queue.forEach((entry: PendingYoutubeVideo) => {
            if (typeof entries[entry.user.username.toLowerCase()] === 'undefined') {
                entries[entry.user.username.toLowerCase()] = [];
            }
            entries[entry.user.username.toLowerCase()].push(entry);
        });
        // re organise queue
        let remainingCount = this.queue.length;
        this.queue = [];
        while (remainingCount > 0) {
            // for each username
            for (const username of Object.keys(entries)) {
                if (entries[username].length === 0) {
                    continue;
                }
                // add one of his video to the list
                this.queue.push(entries[username].splice(0, 1)[0]);
                remainingCount --;
            }
        }
    }

    /**
     * When client join the room, sync their yt player
     * @param connection
     */
    async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        this.sync(connection);
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
        await this.room.sendMessage('Now playing: ' + nextVideo.video.title + ', added by ' + nextVideo.user.username, null, UserController.getNeutralUser(), null);
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
        // If no video is playing
        if (! this.currentVideo) {
            // Abort
            broadcaster.send('yt-sync', null);
            return;
        }
        const syncObject: SanitizedCurrentYoutubeVideo = {
            enabled: UserController.getPluginData(broadcaster.session.user, this.name),
            user: this.currentVideo.user.sanitized(),
            video: this.currentVideo.video,
            startedDate: this.currentVideo.startedDate.getTime() * 0.001,
            cursor: Date.now() * 0.001 - this.currentVideo.startedDate.getTime() * 0.001
        };
        broadcaster.send('yt-sync', syncObject);
    }
}
