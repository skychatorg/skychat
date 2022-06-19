import { Connection } from "../../skychat/Connection";
import { GlobalPlugin } from "../GlobalPlugin";
import { RoomManager } from "../../skychat/RoomManager";
import { PlayerChannelManager } from "./PlayerChannelManager";
import { YoutubeFetcher } from "./fetcher/YoutubeFetcher";
import { PluginCommandRules } from "../Plugin";
import { LinkFetcher } from "./fetcher/LinkFetcher";
import { IFrameFetcher } from "./fetcher/IFrameFetcher";
import { VideoFetcher } from "./fetcher/VideoFetcher";
import { TwitchFetcher } from "./fetcher/TwitchFetcher";
import { PollPlugin } from "../poll/PollPlugin";
import { SanitizedPlayerChannel } from "./PlayerChannel";
import { Session } from "../../skychat/Session";
import { Config } from "../../skychat/Config";



/**
 * 
 */
export class PlayerPlugin extends GlobalPlugin {

    static readonly FETCHERS: {[fetcherName: string]: VideoFetcher} = {
        'yt': new YoutubeFetcher(),
        'twitch': new TwitchFetcher(),
        'embed': new LinkFetcher(),
        'iframe': new IFrameFetcher(),
    };

    static readonly commandName = 'player';

    static readonly commandAliases = [
        'playerchannelmanage',
        'playerchannel',
        'playersync',
        'playersearch',
        'schedule',
        'unschedule',
    ].concat(Object.keys(PlayerPlugin.FETCHERS));

    static readonly defaultDataStorageValue: { channel: null | number; } = { channel: null };

    readonly rules: {[alias: string]: PluginCommandRules} = {
        player: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 10,
            params: [{name: 'action', pattern: /^(replay30|skip30|list|skip|flush)$/}]
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
        playersync: {
            minCount: 0,
            maxCount: 0,
            maxCallsPer10Seconds: 10,
        },
        playersearch: {
            minCount: 2,
            coolDown: 500,
            maxCallsPer10Seconds: 5,
            params: [
                {name: 'param', pattern: new RegExp(`^${Object.keys(PlayerPlugin.FETCHERS).join('|')}$`)},
                {name: 'type', pattern: /./},
                {name: 'search', pattern: /./},
            ]
        },
        schedule: {
            minCount: 2,
            maxCount: 4,
            coolDown: 500,
            maxCallsPer10Seconds: 2,
            params: [
                { name: 'type', pattern: new RegExp(`^${Object.keys(PlayerPlugin.FETCHERS).join('|')}$`) },
                { name: 'param', pattern: /./ },
                { name: 'startDate', pattern: /^([0-9]{4})-([0-9]{2})-([0-9]{2})[T ]([0-9]{2}):([0-9]{2})(:[0-9]{2}(\.[0-9]{3}Z)?)?$/ },
                { name: 'duration', pattern: /^\d+$/ },
            ]
        },
        unschedule: {
            minCount: 1,
            maxCount: 1,
            coolDown: 500,
            maxCallsPer10Seconds: 2,
            params: [
                { name: 'start', pattern: /^\d+$/ },
            ]
        },
    };

    protected storage: { channels: SanitizedPlayerChannel[] } = {
        channels: []
    };

    public readonly channelManager: PlayerChannelManager;

    constructor(manager: RoomManager) {
        super(manager);

        for (const fetcherName of Object.keys(PlayerPlugin.FETCHERS)) {
            this.rules[fetcherName] = {
                minCount: 1,
                maxCallsPer10Seconds: 10,
                params: [
                    {name: 'action', pattern: /./},
                ]
            };
        }

        // Rebuild channels from storage
        this.loadStorage();

        this.channelManager = new PlayerChannelManager(this);
        for (const channelData of this.storage.channels) {
            const channel = this.channelManager.createChannel(channelData.id, channelData.name);
            for (const event of channelData.schedule.events) {
                channel.schedule(event.media, event.start, event.duration);
            }
        }
        
        // Bind events
        this.channelManager.on('channels-changed', () => {
            this.storage.channels = this.channelManager.sanitized();
            this.syncStorage();
        });
    }

    /**
     * Plugin entry point
     */
    public async run(alias: string, param: string, connection: Connection) {

        // If using a fetcher alias to play a video
        if (typeof PlayerPlugin.FETCHERS[alias] !== 'undefined') {
            await this.handlePlayerFetch(alias, param, connection);
            return;
        }

        switch (alias) {

            case 'player':
                await this.handlePlayer(param, connection);
                break;

            case 'playerchannel':
                await this.handlePlayerChannel(param, connection);
                break;

            case 'playerchannelmanage':
                await this.handlePlayerChannelManage(param, connection);
                break;

            case 'playersync':
                await this.handlePlayerSync(param, connection);
                break;

            case 'playersearch':
                await this.handlePlayerSearch(param, connection);
                break;

            case 'schedule':
                await this.handlePlayerSchedule(param, connection);
                break;

            case 'unschedule':
                await this.handlePlayerUnschedule(param, connection);
                break;
            
            default:
                throw new Error('Unsupported action');
        }
    }

    /**
     * Return whether a session has the right to play a media
     * @param session 
     * @returns 
     */
    public canAddMedia(session: Session) {
        const expectedRight = Config.PREFERENCES.minRightForPlayerAddMedia === 'op' ? Infinity : Config.PREFERENCES.minRightForPlayerAddMedia;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    /**
     * Return whether a session has the right to manage the schedule
     * @param session 
     * @returns 
     */
    public canSchedule(session: Session) {
        const expectedRight = Config.PREFERENCES.minRightForPlayerManageSchedule === 'op' ? Infinity : Config.PREFERENCES.minRightForPlayerManageSchedule;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    /**
     * Manage channels (Only for OP)
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayerChannelManage(param: string, connection: Connection) {

        if (! connection.session.isOP()) {
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
     * Synchronize this connection
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayerSync(param: string, connection: Connection) {
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (! channel) {
            return;
        }
        channel.syncConnections([connection]);
    }

    /**
     * Search video/playlists from YT
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayerSearch(param: string, connection: Connection) {
        if (! this.canAddMedia(connection.session)) {
            throw new Error('Unable to perform this action');
        }
        const fetcherName = param.split(' ')[0];
        if (typeof PlayerPlugin.FETCHERS[fetcherName] === 'undefined') {
            throw new Error('Invalid fetcher specified');
        }
        const fetcher = PlayerPlugin.FETCHERS[fetcherName];
        const type = param.split(' ')[1];
        const search = param.substr(fetcherName.length + 1 + type.length + 1);
        const items = await fetcher.search(this, type, search, 10);
        connection.send('player-search', { type, items });
    }
    
    /**
     * Schedule a video to play
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayerSchedule(param: string, connection: Connection) {
        if (! this.canSchedule(connection.session)) {
            throw new Error('You do not have the permission to schedule medias');
        }
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (! channel) {
            throw new Error('Join a channel to add videos');
        }
        // Get & verify params
        const [fetcherName, id, rawStart, rawDuration] = param.split(' ');
        const fetcher = PlayerPlugin.FETCHERS[fetcherName];
        const start = rawStart ? new Date(rawStart) : new Date();
        const duration: number | null = parseInt(rawDuration) || null;
        if (typeof fetcher === 'undefined') {
            throw new Error('Invalid fetcher specified');
        }
        if (start.toJSON() === null) {
            throw new Error('Invalid date');
        }
        const medias = await fetcher.get(this, id);
        if (medias.length === 0) {
            throw new Error('No media found');
        }
        // Only add the first media
        const media = medias[0];
        channel.schedule(media, start.getTime(), duration || media.duration);
    }
    
    /**
     * Unschedule a media
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayerUnschedule(param: string, connection: Connection) {
        if (! this.canSchedule(connection.session)) {
            throw new Error('Unable to perform this action');
        }
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (! channel) {
            throw new Error('Join a channel to add videos');
        }
        // Get & verify params
        const start = parseInt(param.split(' ')[0]);
        if (! start) {
            throw new Error('Invalid date');
        }
        channel.unschedule(start);
    }

    /**
     * Add a video to the queue
     * @param param 
     * @param connection 
     * @returns 
     */
    private async handlePlayerFetch(fetcherName: string, param: string, connection: Connection) {
        if (! this.canAddMedia(connection.session)) {
            throw new Error('Unable to perform this action');
        }
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (! channel) {
            throw new Error('Join a channel to add videos');
        }
        if (channel.locked && ! connection.session.isOP()) {
            throw new Error('Channel is locked');
        }
        if (typeof PlayerPlugin.FETCHERS[fetcherName] === 'undefined') {
            throw new Error('Invalid fetcher specified');
        }
        const fetcher = PlayerPlugin.FETCHERS[fetcherName];
        const videos = await fetcher.get(this, param);
        if (videos.length === 0) {
            throw new Error('Unable to fetch items');
        }
        channel.add(videos, connection.session.user, { allowFailure: false });
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
        if (channel.locked && ! connection.session.isOP()) {
            throw new Error('Channel is locked');
        }

        switch (param) {

            case 'replay30':
                if (! channel.hasPlayerPermission(connection.session)) {
                    throw new Error('You are not authorized to modify the player right now');
                }
                channel.moveCursor(- 30 * 1000);
                break;
            
            case 'skip30':
                if (! channel.hasPlayerPermission(connection.session)) {
                    throw new Error('You are not authorized to modify the player right now');
                }
                channel.moveCursor(+ 30 * 1000);
                break;

            case 'skip':
                // If user has player permission, skip directly
                if (channel.hasPlayerPermission(connection.session)) {
                    channel.skip();
                    return;
                }
                // If user has no permission, poll to skip
                const pollPlugin = this.manager.getPlugin('poll') as PollPlugin;
                const playerData = channel.getPlayerData();
                if (pollPlugin && playerData.current) {
                    const poll = await pollPlugin.poll(
                        `${channel.name}: Skip media?`,
                        `${connection.session.identifier} wants to skip ${playerData.current.video.title}. Skip media?`,
                        {
                            audience: channel.sessions,
                            defaultValue: false,
                            timeout: 10 * 1000,
                            minVotes: 2,
                        }
                    );
                    if (poll.getResult()) {
                        channel.skip();
                    }
                    return;
                }
                throw new Error('You are not authorized to modify the player right now');

            case 'flush':
                if (! connection.session.isOP()) {
                    throw new Error('Only OP can flush the queue');
                }
                channel.flushQueue();
                break;
        }
    }

    /**
     * @hook When a connection is created, send to this connection the list of channels
     * @param connection
     */
    public async onNewConnection(connection: Connection): Promise<void> {
        this.channelManager.sync([connection]);
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
        // Compare the saved channel id to this session
        const currentChannel = this.channelManager.getSessionChannel(connection.session);
        const savedChannelId = this.getUserData(connection.session.user);

        if (typeof savedChannelId === 'number' && (! currentChannel || savedChannelId !== currentChannel.id)) {
            // If the user is supposed to be in a channel, but this session aint
            // Make this session join the saved channel
            this.channelManager.joinChannel(connection.session, savedChannelId);

        } else if (currentChannel) {
            // If this session is in a yt channel, synchronize this connection
            connection.send('player-channel', currentChannel.id);
            currentChannel.syncConnections([connection]);
        }
    }
}
