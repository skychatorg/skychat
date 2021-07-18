import { VideoInfo } from "../PlayerChannel";
import { PlayerPlugin } from "../PlayerPlugin";

export interface VideoFetcher {
    
    get(playerPlugin: PlayerPlugin, param: string): Promise<VideoInfo[]>;

    search(playerPlugin: PlayerPlugin, type: string, search: string, limit: number): Promise<VideoInfo[]>;
}
