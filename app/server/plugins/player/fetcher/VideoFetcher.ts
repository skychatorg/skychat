import { VideoInfo } from '../PlayerChannel.js';
import { PlayerPlugin } from '../PlayerPlugin.js';

export interface VideoFetcher {
    /**
     * Get a media
     * @param playerPlugin
     * @param param
     */
    get(playerPlugin: PlayerPlugin, param: string): Promise<VideoInfo[]>;

    /**
     * Advanced media search
     * @param playerPlugin
     * @param type
     * @param search
     * @param limit
     */
    search(playerPlugin: PlayerPlugin, type: string, search: string, limit: number): Promise<VideoInfo[]>;
}
