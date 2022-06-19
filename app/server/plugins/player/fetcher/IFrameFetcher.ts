import { VideoInfo } from "../PlayerChannel";
import { PlayerPlugin } from "../PlayerPlugin";
import { VideoFetcher } from "./VideoFetcher";



export class IFrameFetcher implements VideoFetcher {

    /**
     * @override
     */
    async get(playerPlugin: PlayerPlugin, src: string): Promise<VideoInfo[]> {
        return [{
            type: 'iframe',
            id: src,
            startCursor: 0,
            thumb: '',
            duration: 0,
            title: src,
        }];
    }

    /**
     * @override
     */
    search(playerPlugin: PlayerPlugin, type: string, search: string, limit: number): Promise<VideoInfo[]> {
        throw new Error("Method not implemented.");
    }
}
