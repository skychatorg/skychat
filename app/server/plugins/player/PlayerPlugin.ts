import { Config } from '../../skychat/Config.js';
import { Connection } from '../../skychat/Connection.js';
import { Logging } from '../../skychat/Logging.js';
import { RoomManager } from '../../skychat/RoomManager.js';
import { Session } from '../../skychat/Session.js';
import { GlobalPlugin, PluginRoute } from '../GlobalPlugin.js';
import { PollPlugin } from '../core/global/PollPlugin.js';
import { SanitizedPlayerChannel } from './PlayerChannel.js';
import { PlayerChannelManager } from './PlayerChannelManager.js';
import { GalleryFetcher } from './fetcher/GalleryFetcher.js';
import { IFrameFetcher } from './fetcher/IFrameFetcher.js';
import {
    issueStreamToken,
    JELLYFIN_ID_REGEX,
    JellyfinFetcher,
    mapBrowseItem,
    PAGE_SIZE,
    STREAM_TOKEN_TTL_MS,
} from './fetcher/JellyfinFetcher.js';
import { buildJellyfinRoutes } from './fetcher/JellyfinRoutes.js';
import { TwitchFetcher } from './fetcher/TwitchFetcher.js';
import { VideoFetcher } from './fetcher/VideoFetcher.js';
import { YoutubeFetcher } from './fetcher/YoutubeFetcher.js';

/**
 *
 */
export class PlayerPlugin extends GlobalPlugin {
    static readonly FETCHERS: { [fetcherName: string]: VideoFetcher } = {
        yt: new YoutubeFetcher(),
        twitch: new TwitchFetcher(),
        iframe: new IFrameFetcher(),
        galleryadd: new GalleryFetcher(),
        jellyfin: new JellyfinFetcher(),
    };

    static readonly commandName = 'player';

    static readonly commandAliases = [
        'playerchannelmanage',
        'playerchannel',
        'playersync',
        'playersearch',
        'playerremovevideo',
        'playerseek',
        'schedule',
        'unschedule',
        'jellyfinls',
        'jellyfinsearch',
    ].concat(Object.keys(PlayerPlugin.FETCHERS));

    static readonly defaultDataStorageValue: { channel: null | number } = { channel: null };

    readonly rules = {
        player: {
            minCount: 1,
            maxCount: 1,
            maxCallsPer10Seconds: 10,
            params: [{ name: 'action', pattern: /^(replay30|skip30|list|skip|flush|pause|resume)$/ }],
        },
        playerchannelmanage: {
            minCount: 1,
            maxCallsPer10Seconds: 14,
            params: [
                { name: 'action', pattern: /^(create|delete|rename)$/ },
                { name: 'param', pattern: /./ },
            ],
        },
        playerchannel: {
            minCount: 1,
            maxCount: 2,
            maxCallsPer10Seconds: 14,
            params: [
                { name: 'action', pattern: /^(join|leave)$/ },
                { name: 'id', pattern: /^([0-9]+)$/ },
            ],
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
                { name: 'param', pattern: new RegExp(`^${Object.keys(PlayerPlugin.FETCHERS).join('|')}$`) },
                { name: 'type', pattern: /./ },
                { name: 'search', pattern: /./ },
            ],
        },
        playerremovevideo: {
            minCount: 2,
            maxCount: 2,
            coolDown: 100,
            maxCallsPer10Seconds: 10,
            params: [
                { name: 'type', pattern: /./ },
                { name: 'id', pattern: /./ },
            ],
        },
        playerseek: {
            minCount: 1,
            maxCount: 1,
            coolDown: 100,
            maxCallsPer10Seconds: 20,
            params: [{ name: 'positionMs', pattern: /^\d{1,10}$/ }],
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
            ],
        },
        unschedule: {
            minCount: 1,
            maxCount: 1,
            coolDown: 500,
            maxCallsPer10Seconds: 2,
            params: [{ name: 'start', pattern: /^\d+$/ }],
        },
        jellyfinls: {
            // Optional trailing startIndex (page offset) is validated in the handler, not here:
            // the engine only pattern-checks param 0, so a second numeric token just needs maxCount room.
            minCount: 0,
            maxCount: 2,
            coolDown: 200,
            maxCallsPer10Seconds: 30,
            params: [{ name: 'parentId', pattern: JELLYFIN_ID_REGEX }],
        },
        jellyfinsearch: {
            // Free-text term carries spaces, so no params/maxCount (those split on single spaces).
            // The client always prepends a numeric startIndex, so the first token is unambiguous.
            minCount: 1,
            coolDown: 300,
            maxCallsPer10Seconds: 30,
        },
    };

    protected storage: { channels: SanitizedPlayerChannel[] } = {
        channels: [],
    };

    public readonly channelManager: PlayerChannelManager;

    constructor(manager: RoomManager) {
        super(manager);

        for (const fetcherName of Object.keys(PlayerPlugin.FETCHERS)) {
            (this.rules as any)[fetcherName] = {
                minCount: 1,
                maxCallsPer10Seconds: 10,
                params: [{ name: 'action', pattern: /./ }],
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
            if (alias === 'jellyfin' && !this.canBrowseJellyfin(connection.session)) {
                throw new Error('You do not have the permission to play Jellyfin content');
            }
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

            case 'playerremovevideo':
                await this.handlePlayerRemoveVideo(param, connection);
                break;

            case 'playerseek':
                await this.handlePlayerSeek(param, connection);
                break;

            case 'schedule':
                await this.handlePlayerSchedule(param, connection);
                break;

            case 'unschedule':
                await this.handlePlayerUnschedule(param, connection);
                break;

            case 'jellyfinls':
                await this.handleJellyfinLs(param, connection);
                break;

            case 'jellyfinsearch':
                await this.handleJellyfinSearch(param, connection);
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
        const expectedRight =
            Config.PREFERENCES.minRightForPlayerAddMedia === 'op' ? Infinity : Config.PREFERENCES.minRightForPlayerAddMedia;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    /**
     * Return whether a session has the right to manage the schedule
     * @param session
     * @returns
     */
    public canSchedule(session: Session) {
        const expectedRight =
            Config.PREFERENCES.minRightForPlayerManageSchedule === 'op' ? Infinity : Config.PREFERENCES.minRightForPlayerManageSchedule;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    /**
     * Return whether a session has the right to browse or play Jellyfin content
     */
    public canBrowseJellyfin(session: Session) {
        const expectedRight =
            Config.PREFERENCES.minRightForJellyfinBrowse === 'op' ? Infinity : Config.PREFERENCES.minRightForJellyfinBrowse;
        const actualRight = session.isOP() ? Infinity : session.user.right;
        return actualRight >= expectedRight;
    }

    /**
     * List Jellyfin libraries or the children of a given parent item.
     */
    private async handleJellyfinLs(param: string, connection: Connection) {
        if (!this.canBrowseJellyfin(connection.session)) {
            throw new Error('You do not have the permission to browse Jellyfin');
        }
        const fetcher = PlayerPlugin.FETCHERS.jellyfin as JellyfinFetcher;
        if (!fetcher || !fetcher.enabled) {
            throw new Error('Jellyfin is not configured on this server');
        }
        // parentId stays the first token (keeps the old single-arg contract); startIndex is an
        // optional trailing numeric for paging.
        const parts = param.trim().split(' ').filter(Boolean);
        const parentId = parts[0] ? parts[0].replace(/-/g, '').toLowerCase() : null;
        const startIndex = parts[1] && /^\d{1,6}$/.test(parts[1]) ? parseInt(parts[1], 10) : 0;
        // Map upstream failures to a clear, "Jellyfin"-tagged message: the raw axios error would
        // leak internals and the client only surfaces (and clears its loading state on) errors
        // mentioning Jellyfin — otherwise the library panel hangs on "Loading…" forever.
        let items, total;
        try {
            await fetcher.client.ensureReady();
            const userId = await fetcher.client.resolveUserId();
            ({ items, total } = await fetcher.client.listChildren(userId, parentId, { startIndex, limit: PAGE_SIZE }));
        } catch (err) {
            Logging.warn(`Jellyfin browse failed (parentId=${parentId ?? 'root'}): ${(err as Error).message}`);
            throw new Error('Could not load the Jellyfin library');
        }
        connection.send('jellyfin-library', {
            mode: 'browse',
            parentId,
            search: null,
            startIndex,
            total,
            streamToken: issueStreamToken(connection.session.user.id, Date.now() + STREAM_TOKEN_TTL_MS),
            items: items.map(mapBrowseItem),
        });
    }

    /**
     * Search the whole Jellyfin library (recursive) and reply on the same library event.
     */
    private async handleJellyfinSearch(param: string, connection: Connection) {
        if (!this.canBrowseJellyfin(connection.session)) {
            throw new Error('You do not have the permission to browse Jellyfin');
        }
        const fetcher = PlayerPlugin.FETCHERS.jellyfin as JellyfinFetcher;
        if (!fetcher || !fetcher.enabled) {
            throw new Error('Jellyfin is not configured on this server');
        }
        // The client always prepends a numeric startIndex, so the first token is the page offset
        // and the rest (which may contain spaces) is the search term.
        const trimmed = param.trim();
        const sp = trimmed.indexOf(' ');
        const startIndex = sp > 0 ? parseInt(trimmed.slice(0, sp), 10) || 0 : 0;
        const term = (sp > 0 ? trimmed.slice(sp + 1) : '').trim();
        if (!term) {
            throw new Error('Empty Jellyfin search term');
        }
        let items, total;
        try {
            await fetcher.client.ensureReady();
            const userId = await fetcher.client.resolveUserId();
            ({ items, total } = await fetcher.client.searchItems(userId, term, ['Movie', 'Series', 'Episode'], {
                startIndex,
                limit: PAGE_SIZE,
            }));
        } catch (err) {
            Logging.warn(`Jellyfin search failed (term=${term}): ${(err as Error).message}`);
            throw new Error('Could not search the Jellyfin library');
        }
        connection.send('jellyfin-library', {
            mode: 'search',
            parentId: null,
            search: term,
            startIndex,
            total,
            streamToken: issueStreamToken(connection.session.user.id, Date.now() + STREAM_TOKEN_TTL_MS),
            items: items.map(mapBrowseItem),
        });
    }

    public getRoutes(): PluginRoute[] {
        const fetcher = PlayerPlugin.FETCHERS.jellyfin as JellyfinFetcher;
        return buildJellyfinRoutes(fetcher);
    }

    /**
     * Manage channels (Only for OP)
     * @param param
     * @param connection
     * @returns
     */
    private async handlePlayerChannelManage(param: string, connection: Connection) {
        if (!connection.session.isOP()) {
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
            if (!channel) {
                throw new Error('Not in a channel');
            }
            this.channelManager.deleteChannel(channel.id);
            return;
        }

        // Rename a channel
        if (action === 'rename') {
            const channel = this.channelManager.getSessionChannel(connection.session);
            if (!channel) {
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
        if (!channel) {
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
        if (!this.canAddMedia(connection.session)) {
            throw new Error('You do not have the permission to add media');
        }
        const fetcherName = param.split(' ')[0];
        if (typeof PlayerPlugin.FETCHERS[fetcherName] === 'undefined') {
            throw new Error('Invalid fetcher specified');
        }
        if (fetcherName === 'jellyfin' && !this.canBrowseJellyfin(connection.session)) {
            throw new Error('You do not have the permission to browse Jellyfin');
        }
        const fetcher = PlayerPlugin.FETCHERS[fetcherName];
        const type = param.split(' ')[1];
        const search = param.substr(fetcherName.length + 1 + type.length + 1);
        const items = await fetcher.search(this, type, search, 10);
        connection.send('player-search', { type, items });
    }

    /**
     * Remove a given media from the list
     * @param param
     * @param connection
     */
    private async handlePlayerRemoveVideo(param: string, connection: Connection) {
        if (!this.canAddMedia(connection.session)) {
            throw new Error('Unable to perform this action');
        }
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (!channel) {
            throw new Error('Join a channel to manage medias');
        }
        const mediaType = param.split(' ')[0];
        const mediaId = param.split(' ')[1];
        const queueEntry = channel.getQueueEntry(mediaType, mediaId);
        if (!queueEntry) {
            throw new Error('No such video in the queue');
        }
        // If user not matching and not OP
        if (queueEntry.user.id !== connection.session.user.id && !connection.session.isOP()) {
            throw new Error('You are not allowed to remove this video');
        }
        channel.remove(queueEntry.video);
    }

    /**
     * Seek the currently playing media to an absolute position
     * @param param Absolute position in ms (validated as 1-10 digits by the command rule)
     * @param connection
     */
    private async handlePlayerSeek(param: string, connection: Connection) {
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (!channel) {
            throw new Error('Channel does not exist');
        }
        if (channel.locked && !connection.session.isOP()) {
            throw new Error('Channel is locked');
        }
        if (!channel.hasPlayerPermission(connection.session)) {
            throw new Error('You are not authorized to modify the player right now');
        }
        channel.seek(parseInt(param.trim(), 10));
    }

    /**
     * Schedule a video to play
     * @param param
     * @param connection
     * @returns
     */
    private async handlePlayerSchedule(param: string, connection: Connection) {
        if (!this.canSchedule(connection.session)) {
            throw new Error('You do not have the permission to schedule medias');
        }
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (!channel) {
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
        if (!this.canSchedule(connection.session)) {
            throw new Error('Unable to perform this action');
        }
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (!channel) {
            throw new Error('Join a channel to add videos');
        }
        // Get & verify params
        const start = parseInt(param.split(' ')[0]);
        if (!start) {
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
        if (!this.canAddMedia(connection.session)) {
            throw new Error('Unable to perform this action');
        }
        const channel = this.channelManager.getSessionChannel(connection.session);
        if (!channel) {
            throw new Error('Join a channel to add videos');
        }
        if (channel.locked && !connection.session.isOP()) {
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
        if (!channel) {
            throw new Error('Channel does not exist');
        }
        if (channel.locked && !connection.session.isOP()) {
            throw new Error('Channel is locked');
        }

        switch (param) {
            case 'replay30':
                if (!channel.hasPlayerPermission(connection.session)) {
                    throw new Error('You are not authorized to modify the player right now');
                }
                channel.moveCursor(-30 * 1000);
                break;

            case 'skip30':
                if (!channel.hasPlayerPermission(connection.session)) {
                    throw new Error('You are not authorized to modify the player right now');
                }
                channel.moveCursor(+30 * 1000);
                break;

            case 'pause':
                if (!channel.hasPlayerPermission(connection.session)) {
                    throw new Error('You are not authorized to modify the player right now');
                }
                channel.pause();
                break;

            case 'resume':
                if (!channel.hasPlayerPermission(connection.session)) {
                    throw new Error('You are not authorized to modify the player right now');
                }
                channel.resume();
                break;

            case 'skip':
                // If user has player permission, skip directly
                if (channel.hasPlayerPermission(connection.session)) {
                    channel.skip();
                    return;
                }
                // Has user permission to voteskip?
                if (!this.canAddMedia(connection.session)) {
                    throw new Error('You are not authorized to perform this action');
                }
                // Vote skip
                if (this.manager.getPlugin('poll') && channel.getPlayerData().current) {
                    const poll = await (this.manager.getPlugin('poll') as PollPlugin).poll(
                        `${channel.name}: Skip media?`,
                        `${connection.session.identifier} wants to skip ${channel.getPlayerData().current?.video.title}. Skip media?`,
                        {
                            audience: channel.sessions,
                            defaultValue: false,
                            timeout: 10 * 1000,
                            minVotes: 2,
                        },
                    );
                    if (poll.getResult()) {
                        channel.skip();
                    }
                    return;
                }
                throw new Error('You are not authorized to modify the player right now');

            case 'flush':
                if (!connection.session.isOP()) {
                    throw new Error('Only OP can flush the queue');
                }
                channel.flushQueue();
                break;
        }
    }

    /**
     * @hook When a connection is created, send to this connection the list of channels
     */
    public async onNewConnection(connection: Connection): Promise<void> {
        this.channelManager.sync([connection]);

        if (connection.session.user.isGuest()) {
            return;
        }

        // Compare the saved channel id to this session
        const currentChannel = this.channelManager.getSessionChannel(connection.session);
        const savedChannelId = this.getUserData<unknown>(connection.session.user);

        if (typeof savedChannelId === 'number' && (!currentChannel || savedChannelId !== currentChannel.id)) {
            // If the user is supposed to be in a channel, but this session aint
            // Make this session join the saved channel
            this.channelManager.joinChannel(connection.session, savedChannelId);
        } else if (currentChannel) {
            // If this session is in a yt channel, synchronize this connection
            connection.send('player-channel', currentChannel.id);
            currentChannel.syncConnections([connection]);
        }
    }

    /**
     * @hook When a connection is closed, cleanup the session if required
     */
    public async onConnectionClosed(connection: Connection): Promise<void> {
        if (connection.session.connections.length === 0) {
            this.channelManager.leaveChannel(connection.session);
        }
    }
}
