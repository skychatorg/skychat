import { Connection } from '../../skychat/Connection.js';
import { GlobalPlugin } from '../GlobalPlugin.js';
import { PlayerPlugin } from './PlayerPlugin.js';
import { YoutubeFetcher } from './fetcher/YoutubeFetcher.js';

/**
 *
 */
export class YoutubeSearchAndPlayPlugin extends GlobalPlugin {
    static readonly commandName = '#';

    readonly rules = {
        '#': {
            minCount: 1,
            maxCallsPer10Seconds: 2,
            params: [{ name: 'search', pattern: /./ }],
        },
    };

    public async run(alias: string, param: string, connection: Connection) {
        const plugin = this.manager.getPlugin('player') as PlayerPlugin;
        if (!plugin.canAddMedia(connection.session)) {
            throw new Error('Unable to perform this action');
        }

        const playerPlugin = this.manager.getPlugin('player') as PlayerPlugin;
        const channelManager = playerPlugin.channelManager;
        const youtubeFetcher = PlayerPlugin.FETCHERS['yt'] as YoutubeFetcher;
        const channel = channelManager.getSessionChannel(connection.session);
        if (!channel) {
            throw new Error('Not in a player channel');
        }

        // Search video
        const items = await youtubeFetcher.search(playerPlugin, 'video', param, 1);
        if (items.length === 0) {
            throw new Error('No result found');
        }
        const videos = await youtubeFetcher.get(playerPlugin, items[0].id);

        // Play video
        channel.add(videos, connection.session.user, { allowFailure: false });
    }
}
