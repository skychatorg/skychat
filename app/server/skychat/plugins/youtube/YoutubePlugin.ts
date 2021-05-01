import {Plugin} from "../../Plugin";
import {Room} from "../../Room";
import {User} from "../../User";
import {Session} from "../../Session";
import {Connection} from "../../Connection";
import {PluginCommandRules} from "../../Plugin";
import {google, youtube_v3} from "googleapis";
import {Config} from "../../Config";
import {UserController} from "../../UserController";
import {PendingYoutubeVideo} from "./PendingYoutubeVideo";
import {CurrentYoutubeVideo, SyncPlayerStateObject} from "./CurrentYoutubeVideo";
import {YoutubeHelper} from "./YoutubeHelper";
import {PollPlugin} from "../poll/PollPlugin";
import { RoomPlugin } from "../../RoomPlugin";



type YoutubePluginStorage = {
    queue: PendingYoutubeVideo[],
    currentVideo: CurrentYoutubeVideo | null
}


/**
 * Youtube plugin for the skychat
 */
export class YoutubePlugin extends RoomPlugin {

    static readonly MIN_API_RIGHT: number = 10;

    static readonly commandName = 'yt';

    static readonly commandAliases = ['play', 'playpl', 'ytapi', 'ytapi:search', '~'];

    static readonly defaultDataStorageValue = true;

    /**
     * A list of connections that subscribed to the room where this plugin is instantiated
     */
    static subscribedConnections: {
        rooms: {[roomId: number]: Connection[]},
        connections: Map<Connection, number>,
    } = {rooms: {}, connections: new Map()};

    static getRoomSubscribedConnections(roomId: number): Connection[] {
        if (typeof YoutubePlugin.subscribedConnections.rooms[roomId] === 'undefined') {
            YoutubePlugin.subscribedConnections.rooms[roomId] = [];
        }
        return YoutubePlugin.subscribedConnections.rooms[roomId];
    }

    static subscribeConnectionToRoom(connection: Connection, roomId: number) {
        const subscribedConnections = YoutubePlugin.getRoomSubscribedConnections(roomId);
        // Unsubscribe this connection from other rooms
        const currentlySubscribedRoomId = YoutubePlugin.subscribedConnections.connections.get(connection);
        if (typeof currentlySubscribedRoomId !== 'undefined') {
            YoutubePlugin.unsubscribeConnection(connection);
        }
        // Lock
        if (subscribedConnections.indexOf(connection) !== -1) {
            throw new Error('This room\'s player is already locked');
        }
        // Add connection/room link to mappings
        YoutubePlugin.subscribedConnections.connections.set(connection, roomId);
        subscribedConnections.push(connection);
        // Notify connection
        connection.send('player-lock-room-id', roomId);
    }

    static unsubscribeConnection(connection: Connection) {
        const currentlySubscribedRoomId = YoutubePlugin.getConnectionSubscribedRoomId(connection);
        if (typeof currentlySubscribedRoomId === 'undefined') {
            throw new Error('Can not unlock the room player, it is not locked');
        }
        // Remove the connection from the connection->room map
        YoutubePlugin.subscribedConnections.connections.delete(connection);
        // Remove the room from the room->connections map
        const subscribedConnections = YoutubePlugin.subscribedConnections.rooms[currentlySubscribedRoomId];
        subscribedConnections.splice(subscribedConnections.indexOf(connection), 1);
        // Notify connection
        connection.send('player-lock-room-id', null);
    }

    static isConnectionSubscribed(connection: Connection): boolean {
        return YoutubePlugin.subscribedConnections.connections.has(connection);
    }

    static getConnectionSubscribedRoomId(connection: Connection): number | undefined {
        return YoutubePlugin.subscribedConnections.connections.get(connection);
    }

    readonly rules: {[alias: string]: PluginCommandRules} = {
        yt: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 10,
            params: [{name: 'action', pattern: /^(sync|off|on|replay30|skip30|list|skip|shuffle|flush|lock|unlock)$/}]
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
        },
        'ytapi:search': {
            minCount: 2,
            coolDown: 500,
            maxCallsPer10Seconds: 5,
            params: [{name: 'type', pattern: /^(video|playlist)$/}, {name: 'search', pattern: /./}]
        }
    };

    private skipVoteInProgress: boolean = false;

    protected storage: YoutubePluginStorage = {
        queue: [],
        currentVideo: null
    };

    private readonly youtube: youtube_v3.Youtube;

    constructor(room: Room) {
        super(room);

        this.youtube = google.youtube({version: 'v3', auth: Config.YOUTUBE_API_KEY});

        if (this.room) {
            setInterval(this.tick.bind(this), 1000);
        }
    }

    /**
     * Tell the room whether there is a video currently playing
     * @returns 
     */
    public getRoomSummary(): boolean {
        return !! this.storage.currentVideo;
    }

    async run(alias: string, param: string, connection: Connection, session: Session, user: User, room: Room | null): Promise<void> {

        // Check whether this connection is subscribed to another room
        const roomId = YoutubePlugin.getConnectionSubscribedRoomId(connection);
        if (typeof roomId === 'number' && roomId !== this.room.id) {
            const room = this.room.manager.getRoomById(roomId);
            // Check that the room still exists (should be the case)
            if (room) {
                const otherPlugin = room.getPlugin('yt') as YoutubePlugin;
                await otherPlugin.run(alias, param, connection, session, user, room);
                return;
            }
        }

        switch (alias) {

            case 'yt':
                await this.handleYt(param, connection);
                break;

            case 'play':
                await this.handlePlay(param, connection);
                break;

            case '~':
                await this.handleSearchAndPlay(param, connection);
                break;

            case 'playpl':
                await this.handlePlayPlaylist(param, connection);
                break;

            case 'ytapi:search':
                await this.handleApiSearch(param, connection);
                break;
            
            default:
                throw new Error('Youtube command not found');
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
                this.autosync([connection]);
                break;

            case 'on':
            case 'off':
                const newState = param === 'on';
                await UserController.savePluginData(connection.session.user, this.commandName, newState);
                this.autosync([connection]);
                connection.session.syncUserData();
                break;
            
            case 'replay30':
            case 'skip30':
                if (! this.storage.currentVideo) {
                    return;
                }
                if (connection.session.user.right < YoutubePlugin.MIN_API_RIGHT) {
                    throw new Error('Unable to perform this action');
                }
                if (! Config.isOP(connection.session.identifier)
                    && this.storage.currentVideo.user.id !== connection.session.user.id) {
                    throw new Error('Unable to perform this action');
                }
                const sign = param === 'replay30' ? -1 : +1;
                this.moveCursor(sign * 30 * 1000);
                break;

            case 'skip':
                if (connection.session.user.right < YoutubePlugin.MIN_API_RIGHT) {
                    throw new Error('Unable to perform this action');
                }
                await this.handleYtSkip(connection);
                break;

            case 'shuffle':
                if (connection.session.user.right < YoutubePlugin.MIN_API_RIGHT) {
                    throw new Error('Unable to perform this action');
                }
                this.shuffleQueue();
                break;

            case 'flush':
                if (connection.session.user.right < YoutubePlugin.MIN_API_RIGHT) {
                    throw new Error('Unable to perform this action');
                }
                if (! Config.isOP(connection.session.identifier)) {
                    throw new Error('You need to be OP to flush the youtube queue');
                }
                this.storage.queue.splice(0);
                this.autosync();
                break;

            case 'lock':
                YoutubePlugin.subscribeConnectionToRoom(connection, this.room.id);
                break;
            
            case 'unlock':
                YoutubePlugin.unsubscribeConnection(connection);
                if (connection.roomId !== null) {
                    const room = this.room.manager.getRoomById(connection.roomId);
                    if (room) {
                        const otherYtPlugin = room.getPlugin(YoutubePlugin.commandName) as YoutubePlugin;
                        if (otherYtPlugin) {
                            otherYtPlugin.autosync([connection]);
                        }
                    }
                }
                break;
        }
    }

    /**
     * Move the cursor relative to where it is now
     * @param duration Duration in ms
     * @returns 
     */
    private moveCursor(duration: number): void {
        if (! this.storage.currentVideo) {
            return;
        }
        // Move start date
        let newStartTime = this.storage.currentVideo.startedDate.getTime() - duration;
        if (newStartTime > Date.now()) {
            newStartTime = Date.now();
        }
        this.storage.currentVideo.startedDate = new Date(newStartTime);
        this.autosync();
    }

    /**
     * Play a video
     * @param param
     * @param connection
     */
    private async handlePlay(param: string, connection: Connection): Promise<void> {
        if (connection.session.user.right < YoutubePlugin.MIN_API_RIGHT) {
            throw new Error('Unable to perform this action');
        }
        
        // Get information about the yt link
        const {videoId, start} = YoutubeHelper.parseYoutubeLink(param);
        const video = await YoutubeHelper.getYoutubeVideoMeta(this.youtube, videoId);

        // Add element to the queue and re-organize queue
        this.storage.queue.push({ user: connection.session.user, video, start });
        this.shuffleQueue();
    }

    /**
     * Play a whole playlist
     * @param param
     * @param connection
     */
    private async handlePlayPlaylist(param: string, connection: Connection): Promise<void> {
        if (connection.session.user.right < YoutubePlugin.MIN_API_RIGHT) {
            throw new Error('Unable to perform this action');
        }

        // Get info about the given playlist
        const {videoId, playlistId} = YoutubeHelper.parseYoutubeLink(param);
        const id = playlistId || videoId;
        const videos = await YoutubeHelper.getYoutubePlaylistMeta(this.youtube, id);

        // Add videos then shuffle the queue
        for (const video of videos) {
            this.storage.queue.push({user: connection.session.user, video, start: 0});
        }
        this.shuffleQueue();
    }

    /**
     * Play a whole playlist
     * @param param
     * @param connection
     */
    private async handleApiSearch(param: string, connection: Connection): Promise<void> {
        if (connection.session.user.right < YoutubePlugin.MIN_API_RIGHT) {
            throw new Error('Unable to perform this action');
        }
        const query = param.split(' ').slice(1).join(' ');
        const type = param.split(' ')[0];
        const items = await YoutubeHelper.searchYoutube(this.youtube, query, type, 10);
        connection.send('ytapi:search', { type, items });
    }

    /**
     * Search + play a video
     * @param param
     * @param connection
     */
    private async handleSearchAndPlay(param: string, connection: Connection): Promise<void> {
        if (connection.session.user.right < YoutubePlugin.MIN_API_RIGHT) {
            throw new Error('Unable to perform this action');
        }
        const items = await YoutubeHelper.searchYoutube(this.youtube, param, 'video', 1);
        if (items.length === 0 || ! items[0].id?.videoId) {
            throw new Error('No result found for ' + param);
        }
        const video = await YoutubeHelper.getYoutubeVideoMeta(this.youtube, items[0].id.videoId);
        this.storage.queue.push({user: connection.session.user, video, start: 0});
        this.shuffleQueue();
    }

    /**
     * @param connection
     */
    private async handleYtSkip(connection: Connection): Promise<void> {
        if (connection.session.user.right < YoutubePlugin.MIN_API_RIGHT) {
            throw new Error('Unable to perform this action');
        }
        if (! this.storage.currentVideo) {
            return;
        }
        if (Config.isOP(connection.session.identifier)) {
            this.skip();
            return;
        }
        if (this.storage.currentVideo.user.id === connection.session.user.id) {
            this.skip();
            return;
        }
        if (! this.room.containsUser(this.storage.currentVideo.user.id)) {
            this.skip();
            return;
        }
        const isLive = this.storage.currentVideo.video.duration === 0;
        const timeLeftMs = this.storage.currentVideo.video.duration * 1000 - (new Date().getTime() - this.storage.currentVideo.startedDate.getTime());
        if (! isLive && timeLeftMs < 30 * 1000) {
            throw new Error(`You can't skip this video. It will end soon anyway.`);
        }
        if (this.skipVoteInProgress) {
            throw new Error('A vote to skip the current video is already in progress');
        }
        this.skipVoteInProgress = true;
        const pollPlugin = this.room.getPlugin('poll') as PollPlugin;
        const poll = await pollPlugin.poll('Skip song: ' + this.storage.currentVideo.video.title + '?', connection.session.identifier + ' asks:', {
            timeout: 15 * 1000,
            defaultValue: false,
            minVotes: 2,
        });
        if (poll.getResult()) {
            this.skip();
        }
        this.skipVoteInProgress = false;
    }

    /**
     * Skip the current song
     */
    private skip(): void {
        if (! this.storage.currentVideo) {
            return;
        }
        this.storage.currentVideo = null;
        this.autosync();
    }

    /**
     * Shuffle the queue fairly
     */
    private shuffleQueue(): void {
        // store pending videos by owner
        const entries: {[username: string]: PendingYoutubeVideo[]} = {};
        this.storage.queue.forEach((entry: PendingYoutubeVideo) => {
            if (typeof entries[entry.user.username.toLowerCase()] === 'undefined') {
                entries[entry.user.username.toLowerCase()] = [];
            }
            entries[entry.user.username.toLowerCase()].push(entry);
        });
        // re organise queue
        let remainingCount = this.storage.queue.length;
        this.storage.queue = [];
        while (remainingCount > 0) {
            // for each username
            for (const username of Object.keys(entries)) {
                if (entries[username].length === 0) {
                    continue;
                }
                // add one of his video to the list
                this.storage.queue.push(entries[username].splice(0, 1)[0]);
                remainingCount --;
            }
        }
        this.autosync();
    }

    /**
     * When client join the room, sync their yt player
     * @param connection
     */
    async onConnectionJoinedRoom(connection: Connection): Promise<void> {
        this.autosync([connection]);
    }

    /**
     *
     */
    private async tick(): Promise<void> {

        // Cleanup previously subscribed connections
        const subscribedConnections = YoutubePlugin.getRoomSubscribedConnections(this.room.id);
        for (const connection of subscribedConnections) {
            // If the connection is closed, remove the disconnected connection from the list of subscribed connections
            connection.closed && YoutubePlugin.unsubscribeConnection(connection);
        }

        // If a video is playing currently
        if (this.storage.currentVideo) {

            // If video has finished
            if (this.storage.currentVideo.video.duration > 0 && new Date() > new Date(this.storage.currentVideo.startedDate.getTime() + (this.storage.currentVideo.video.duration - this.storage.currentVideo.start) * 1000 + 2000)) {
                this.storage.currentVideo = null;

                // If there is no more video to play, sync clients (this will deactive the player)
                if (this.storage.queue.length === 0) {
                    this.autosync();
                }
            }
            return; // Wait until next tick
        }
        // Else, if no video is playing currently

        // Get the next video to play
        const nextVideo = this.storage.queue.shift();
        // If there is none
        if (! nextVideo) {
            // Nothing to do. Wait until next tick.
            return;
        }
        // Else, play this video
        this.storage.currentVideo = {...nextVideo, startedDate: new Date()};
        await this.room.sendMessage({
            content: 'Now playing: ' + nextVideo.video.title + ', added by ' + nextVideo.user.username,
            user: UserController.getNeutralUser()
        });
        this.autosync();
    }

    /**
     * Sync a given list of connections or all room and subscribed connections by default.
     * Filters connections subscribed to another room.
     */
    public autosync(target?: Connection[]) {
        
        if (typeof target === 'undefined') {
            // By default, sync room and subscribed connections. Remove duplicates
            const roomConnections = this.room.connections.filter(connection => ! YoutubePlugin.isConnectionSubscribed(connection));
            const subscribedConnections = YoutubePlugin.getRoomSubscribedConnections(this.room.id);
            const connections = roomConnections.concat(subscribedConnections);
            this.syncConnections(Array.from(new Set(connections)));
            return;
        
        }
        
        // If a list of connections is given
        const connections = target.filter(connection => {
            const roomId = YoutubePlugin.getConnectionSubscribedRoomId(connection);
            return !(typeof roomId === 'number' && roomId !== this.room.id);
        });
        this.syncConnections(connections);
    }

    public syncConnections(connections: Connection[]) {

        // If no video is playing
        if (! this.storage.currentVideo) {
            for (const connection of connections) {
                connection.send('yt-sync', null);
            }
            return;
        }

        // Otherwise, build sync object
        const syncObject: SyncPlayerStateObject = {
            enabled: true, // @TODO remove when the ability to disable the yt player is removed
            user: this.storage.currentVideo.user.sanitized(),
            video: this.storage.currentVideo.video,
            start: this.storage.currentVideo.start,
            startedDate: this.storage.currentVideo.startedDate.getTime() * 0.001,
            cursor: this.storage.currentVideo.video.duration > 0 ? Date.now() * 0.001 - this.storage.currentVideo.startedDate.getTime() * 0.001 + this.storage.currentVideo.start : 0,
            queue: this.storage.queue.map(pendingVideo => {
                return {
                    user: pendingVideo.user.sanitized(),
                    start: pendingVideo.start,
                    video: pendingVideo.video
                };
            })
        };
        
        for (const connection of connections) {
            syncObject.enabled = UserController.getPluginData(connection.session.user, this.commandName);
            connection.send('yt-sync', syncObject);
        }
    }
}
