import { VideoInfo } from "../PlayerChannel";

export interface VideoFetcher {
    
    get(param: string): Promise<VideoInfo[]>;

    search(type: string, search: string, limit: number): Promise<VideoInfo[]>;
}
