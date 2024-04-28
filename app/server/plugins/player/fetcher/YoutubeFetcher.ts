import { google, youtube_v3 } from 'googleapis';
import { Config } from '../../../skychat/Config.js';
import { VideoInfo } from '../PlayerChannel.js';
import { PlayerPlugin } from '../PlayerPlugin.js';
import { VideoFetcher } from './VideoFetcher.js';

export class YoutubeFetcher implements VideoFetcher {
    /**
     * Get the duration in seconds from the youtube duration
     * @param durationStr
     */
    public static youtubeDurationToSeconds(durationStr: string): number {
        if (durationStr.substr(0, 2) !== 'PT') {
            return 0;
        }
        durationStr = durationStr.substr(2);
        const all_titles: { [key: string]: number } = {
            h: 3600,
            m: 60,
            s: 1,
        };
        let duration = 0;
        for (const i in all_titles) {
            const match = durationStr.match(new RegExp(`([0-9]+)${i}`, 'i'));
            if (match) {
                duration += all_titles[i] * parseInt(match[1]);
            }
        }
        return duration;
    }

    /**
     * Parse a youtube link
     * @param link
     * @returns
     */
    public static parseYoutubeLink(link: string): { videoId: string; playlistId: string | null; start: number } {
        let match: RegExpMatchArray | null;

        // If the link contains a playlist
        let playlistId: string | null;
        match = link.match(/list=([a-zA-Z0-9-_]+)/);
        if (match) {
            playlistId = match[1];
        } else {
            playlistId = null;
        }

        // If the link contains a video
        let videoId: string;
        match = link.match(/youtu\.be\/([a-zA-Z0-9-_]+)/);
        if (match) {
            videoId = match[1];
        } else {
            match = link.match(/v=([a-zA-Z0-9-_]+)/);
            if (match) {
                videoId = match[1];
            } else {
                videoId = link;
            }
        }

        // If the link contains a time code
        let start: number;
        match = link.match(/(t|time_continue|start)=([0-9hms]+)/);
        if (match) {
            start = parseInt(match[2]) || 0;
        } else {
            start = 0;
        }

        return { videoId, playlistId, start };
    }

    /**
     * Youtube API wrapper
     */
    private readonly youtube: youtube_v3.Youtube;

    constructor() {
        // Youtube API object
        this.youtube = google.youtube({
            version: 'v3',
            auth: Config.YOUTUBE_API_KEY,
        });
    }

    async get(playerPlugin: PlayerPlugin, param: string): Promise<VideoInfo[]> {
        const [link, type] = param.split(' ');

        if (typeof type === 'undefined' || type === 'video') {
            const { videoId, start } = YoutubeFetcher.parseYoutubeLink(link);
            // Get information about the yt link
            const video = await this.getVideoInfo(videoId);
            video.startCursor = start * 1000;
            return [video];
        } else if (type === 'playlist') {
            let { playlistId } = YoutubeFetcher.parseYoutubeLink(link);
            if (!playlistId) {
                playlistId = link;
            }
            return this.getYoutubePlaylistMeta(playlistId);
        } else {
            throw new Error('Invalid video type');
        }
    }

    /**
     *
     * @param param
     * @returns
     */
    async search(playerPlugin: PlayerPlugin, type: string, search: string, limit: number): Promise<VideoInfo[]> {
        const result = await this.youtube.search.list({
            q: search,
            type: [type],
            maxResults: limit,
            part: ['snippet'],
        });
        const items = result?.data?.items;
        if (!items || items.length === 0) {
            throw new Error('No result found');
        }
        return items
            .filter(
                (item) =>
                    item.id &&
                    (item.id.videoId || item.id.playlistId) &&
                    item.snippet &&
                    item.snippet.title &&
                    item.snippet.thumbnails &&
                    item.snippet.thumbnails.default &&
                    item.snippet.thumbnails.default.url,
            )
            .map((item) => {
                return {
                    type: 'youtube',
                    id: (item.id!.videoId || item.id!.playlistId) as string,
                    duration: 0,
                    startCursor: 0,
                    thumb: item.snippet!.thumbnails!.default!.url as string,
                    title: item.snippet!.title as string,
                };
            });
    }

    /**
     * Get a video metadata from its id
     * @param youtube
     * @param id
     */
    public async getVideoInfo(id: string): Promise<VideoInfo> {
        // Fetch youtube api
        const result = await this.youtube.videos.list({
            id: [encodeURIComponent(id)],
            part: ['snippet,contentDetails'],
            fields: 'items(snippet(title,thumbnails),contentDetails,id),pageInfo',
            maxResults: 1,
        });
        // If no result
        if (!result.data.items || result.data.items.length === 0) {
            throw new Error(`Video ${id} not found`);
        }
        // Get item object
        const item = result.data.items[0];
        // If data is missing
        if (
            !item.contentDetails ||
            !item.contentDetails.duration ||
            !item.snippet ||
            !item.snippet.title ||
            !item.snippet.thumbnails ||
            !item.snippet.thumbnails.medium ||
            !item.snippet.thumbnails.medium.url
        ) {
            throw new Error('Unable to load item info');
        }
        // Get important video data & return it
        const duration = YoutubeFetcher.youtubeDurationToSeconds(item.contentDetails.duration) * 1000;
        const title = item.snippet.title;
        const thumb = item.snippet.thumbnails.medium.url;
        return { type: 'youtube', id, duration, title, thumb, startCursor: 0 };
    }

    /**
     * Get a playlist metadata from its id
     * @param youtube
     * @param id
     */
    public async getYoutubePlaylistMeta(id: string): Promise<VideoInfo[]> {
        const result = await this.youtube.playlistItems.list({
            part: ['contentDetails'],
            playlistId: id,
            maxResults: 50,
        });
        if (!result?.data?.items?.length) {
            throw new Error('No result found for ' + id);
        }
        const videoIds: string[] = result.data.items
            .filter((item) => item.contentDetails && item.contentDetails.videoId)
            .map((item) => item.contentDetails!.videoId as string);
        const videos = [];
        for (const videoId of videoIds) {
            videos.push(await this.getVideoInfo(videoId));
        }
        return videos;
    }
}
