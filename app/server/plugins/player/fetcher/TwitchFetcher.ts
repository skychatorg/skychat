import { VideoInfo } from "../PlayerChannel";
import { PlayerPlugin } from "../PlayerPlugin";
import { VideoFetcher } from "./VideoFetcher";


// <iframe src="https://player.twitch.tv/?channel=wintergaming&parent=www.example.com" frameborder="0" allowfullscreen="true" scrolling="no" height="378" width="620"></iframe>

export class TwitchFetcher implements VideoFetcher {


    async get(playerPlugin: PlayerPlugin, channelName: string): Promise<VideoInfo[]> {
        channelName = channelName.toLowerCase();
        if (! channelName.match(/^[a-z0-9-_]+$/)) {
            throw new Error('Invalid channel name');
        }
        const videoInfo: VideoInfo = {
            type: 'twitch',
            id: channelName,
            duration: 0,
            startCursor: 0,
            title: `${channelName}'s twitch`,
            thumb: 'assets/images/icons/twitch.png'
        };
        return [videoInfo];
    }
    
    search(playerPlugin: PlayerPlugin, type: string, search: string, limit: number): Promise<VideoInfo[]> {
        throw new Error("Method not implemented.");
    }
}
