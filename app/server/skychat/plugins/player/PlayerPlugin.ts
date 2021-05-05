import { Session } from "../../Session";
import { Config } from "../../Config";
import { Connection } from "../../Connection";
import { GlobalPlugin } from "../../GlobalPlugin";
import { RoomManager } from "../../RoomManager";
import { PlayerChannelManager } from "./PlayerChannelManager";
import { YoutubeHelper } from "./YoutubeHelper";
import {google, youtube_v3} from "googleapis";



/**
 * 
 */
export class PlayerPlugin extends GlobalPlugin {

    static readonly MIN_RIGHT: number = 10;

    static readonly commandName = 'player';

    static readonly commandAliases = ['playerchannelmanage', 'playerchannel', 'playersearch', 'playersync', '+', '++'];

    static readonly defaultDataStorageValue: { channel: null | number; } = { channel: null };

    readonly rules = {
        player: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 10,
            params: [{name: 'action', pattern: /^(replay30|skip30|list|skip|flush)$/}]
        },
        '+': {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 10,
            params: [{name: 'param', pattern: /./}]
        },
        '++': {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 10,
            params: [{name: 'param', pattern: /./}]
        },
        playerchannelmanage: {
            minCount: 1,
            maxCallsPer10Seconds: 14,
            params: [
                {name: 'action', pattern: /^(create|delete|rename)$/},
                {name: 'param', pattern: /./},
            ]
        },
        playerchannel: {
            minCount: 1,
            maxCount: 2,
            maxCallsPer10Seconds: 14,
            params: [
                {name: 'action', pattern: /^(join|leave)$/},
                {name: 'id', pattern: /^([0-9]+)$/},
            ]
        },
        playersearch: {
            minCount: 2,
            coolDown: 500,
            maxCallsPer10Seconds: 5,
            params: [{name: 'type', pattern: /^(video|playlist)$/}, {name: 'search', pattern: /./}]
        },
        playersync: {
            minCount: 0,
            maxCount: 0,
            maxCallsPer10Seconds: 10,
        }
    };

    protected storage: { channels: {id: number; name: string}[] } = {
        channels: []
    };

    public readonly channelManager: PlayerChannelManager;

    private readonly youtube: youtube_v3.Youtube;

    constructor(manager: RoomManager) {
        super(manager);

        // Youtube API object
        this.youtube = google.youtube({version: 'v3', auth: Config.YOUTUBE_API_KEY});

        // Rebuild channels from storage
        this.loadStorage();

        this.channelManager = new PlayerChannelManager(this);
        for (const channel of this.storage.channels) {
            this.channelManager.createChannel(channel.id, channel.name);
        }

        // Bind events
        this.channelManager.on('channels-changed', () => {
            this.storage.channels = this.channelManager.sanitized();
            this.syncStorage();
        });
    }

    /**
     * @hook When a connection is created, send to this connection the list of channels
     * @param connection
     */
    public async onNewConnection(connection: Connection): Promise<void> {
        this.channelManager.sync([connection.session]);
    }

    /**
     * @hook When a connection is closed, cleanup the session if required
     * @param connection
     */
    public async onConnectionClosed(connection: Connection): Promise<void> {
        if (connection.session.connections.length === 0) {
            this.channelManager.leaveChannel(connection.session);
        }
    }

    /**
     * @hook When a connection successfully authenticated, make him join its channel
     * @param connection
     */
    public async onConnectionAuthenticated(connection: Connection): Promise<void> {
        const channelId = this.getUserData(connection.session.user);
        if (typeof channelId === 'number') {
            this.channelManager.joinChannel(connection.session, channelId);
        }
    }

    /**
     * Plugin entry point
     */
    public async run(alias: string, param: string, connection: Connection) {

        switch (alias) {

            case 'playerchannelmanage':
                await this.handlePlayerChannelManage(param, connection);
                break;

            case 'playerchannel':
                await this.handlePlayerChannel(param, connection);
                break;

            case 'playersearch':
                await this.handlePlayerSearch(param, connection);
                break;

            case 'playersync':
                await this.handlePlayerSync(param, connection);
                break;

            case '+':
                await this.handlePlayerAddYoutubeVideo(param, connection);
                break;

            case '++':
                await this.handlePlayerAddYoutubePlaylist(param, connection);
                break;

            case 'player':
                await this.handlePlayer(param, connection);
                break;
            
            default:
                throw new Error('Unsupported action');
        }
    }

    /**
     * Manage channels (Only for OP)
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayerChannelManage(param: string, connection: Connection) {

        if (! Config.isOP(connection.session.identifier)) {
            throw new Error('Command only for OP');
        }

        const action = param.split(' ')[0];
        const value = param.substr(action.length + 1);

        // Create a new channel
        if (action === 'create') {
            const newId = this.channelManager.getNextChannelId();
            this.channelManager.createChannel(newId, `Channel ${newId}`);
            return;
        }

        // Delete a channel
        if (action === 'delete') {
            const channel = this.channelManager.getSessionChannel(connection.session);
            if (! channel) {
                throw new Error('Not in a channel');
            }
            this.channelManager.deleteChannel(channel.id);
            return;
        }

        // Rename a channel
        if (action === 'rename') {
            const channel = this.channelManager.getSessionChannel(connection.session);
            if (! channel) {
                throw new Error('Not in a channel');
            }
            this.channelManager.renameChannel(channel.id, value);
            return;
        }
        
        throw new Error('Unsupported action');
    }

    /**
     * Join or leave channels (For anyone)
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayerChannel(param: string, connection: Connection) {

        const action = param.split(' ')[0];
        const value = param.substr(action.length + 1);

        // Join channel
        if (action === 'join') {
            this.channelManager.joinChannel(connection.session, parseInt(value));
            // If user is logged, save
            if (connection.session.user.id > 0) {
                this.saveUserData(connection.session.user, parseInt(value));
            }
            return;
        }

        // Leave channel
        if (action === 'leave') {
            this.channelManager.leaveChannel(connection.session);
            // If user is logged, save
            if (connection.session.user.id > 0) {
                this.saveUserData(connection.session.user, null);
            }
            return;
        }
        
        throw new Error('Unsupported action');
    }

    /**
     * Search video/playlists from YT
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayerSearch(param: string, connection: Connection) {
        if (connection.session.user.right < PlayerPlugin.MIN_RIGHT) {
            throw new Error('Unable to perform this action');
        }
        const query = param.split(' ').slice(1).join(' ');
        const type = param.split(' ')[0];
        const items = await YoutubeHelper.searchYoutube(this.youtube, query, type, 10);
        connection.send('player-search', { type, items });
    }

    /**
     * Search video/playlists from YT
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayerSync(param: string, connection: Connection) {
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (! channel) {
            return;
        }
        channel.syncSession(connection.session);
    }

    /**
     * Add a video to the queue
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayerAddYoutubeVideo(param: string, connection: Connection) {
        if (connection.session.user.right < PlayerPlugin.MIN_RIGHT) {
            throw new Error('Unable to perform this action');
        }
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (! channel) {
            throw new Error('Join a channel to add videos');
        }
        
        const {videoId, start} = YoutubeHelper.parseYoutubeLink(param);
        
        // Get information about the yt link
        const video = await YoutubeHelper.getVideoInfo(this.youtube, videoId);
        video.startCursor = start * 1000;
        channel.add(video, connection.session.user);
    }

    /**
     * Add an entire playlist to the queue
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayerAddYoutubePlaylist(param: string, connection: Connection) {
        if (connection.session.user.right < PlayerPlugin.MIN_RIGHT) {
            throw new Error('Unable to perform this action');
        }
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (! channel) {
            throw new Error('Join a channel to add videos');
        }
        
        let {playlistId} = YoutubeHelper.parseYoutubeLink(param);
        
        // Adding a playlist
        if (! playlistId) {
            playlistId = param;
        }
        const videos = await YoutubeHelper.getYoutubePlaylistMeta(this.youtube, playlistId);
        channel.add(videos, connection.session.user);
    }

    /**
     * Forward requests to the player
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayer(param: string, connection: Connection) {

        const channel = this.channelManager.getSessionChannel(connection.session);
        if (! channel) {
            throw new Error('Channel does not exist');
        }

        switch (param) {

            case 'replay30':
                channel.moveCursor(- 30 * 1000);
                break;
            
            case 'skip30':
                channel.moveCursor(+ 30 * 1000);
                break;

            case 'skip':
                channel.skip();
                break;

            case 'flush':
                channel.flushQueue();
                break;
        }
    }
}
