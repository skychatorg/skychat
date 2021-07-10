import { Connection } from "../../skychat/Connection";
import { GlobalPlugin } from "../../skychat/GlobalPlugin";
import { PlayerPlugin } from "./PlayerPlugin";
import { PluginCommandRules } from "../../skychat/Plugin";
import { YoutubeFetcher } from "./fetcher/YoutubeFetcher";



/**
 * 
 */
export class YoutubeSearchAndPlayPlugin extends GlobalPlugin {

    static readonly commandName = '#';

    readonly rules: {[alias: string]: PluginCommandRules} = {
        '#': {
            minCount: 1,
            maxCallsPer10Seconds: 2,
            params: [{name: 'search', pattern: /./}]
        },
    };
    
    public async run(alias: string, param: string, connection: Connection) {
        
        if (connection.session.user.right < PlayerPlugin.MIN_RIGHT) {
            throw new Error('Unable to perform this action');
        }

        const playerPlugin = this.manager.getPlugin('player') as PlayerPlugin;
        const channelManager = playerPlugin.channelManager;
        const youtubeFetcher = PlayerPlugin.FETCHERS['yt'] as YoutubeFetcher;
        const channel = channelManager.getSessionChannel(connection.session);
        if (! channel) {
            throw new Error('Not in a player channel');
        }

        // Search video
        const items = await youtubeFetcher.search('video', param, 1);
        if (items.length === 0) {
            throw new Error('No result found');
        }
        const videos = await youtubeFetcher.get(items[0].id);
        
        // Play video
        channel.add(videos, connection.session.user, { allowFailure: false });
    }
}
