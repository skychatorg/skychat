import { VideoInfo } from "./PlayerChannel";

export interface VideoFetcher {
    fetch(param: string): Promise<VideoInfo[]>;
    search(type: string, search: string, limit: number): Promise<VideoInfo[]>;
}
