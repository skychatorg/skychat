import {GoogleApis, youtube_v3} from "googleapis";
import Youtube = youtube_v3.Youtube;


/**
 * Describe the relevant information of a youtube video (to be sent to the client)
 */
 export interface YoutubeVideoMeta {
    id: string;
    thumb: string;
    title: string
    duration: number;
}


export class YoutubeHelper {

    /**
     * Get the duration in seconds from the youtube duration
     * @param durationStr
     */
    public static youtubeDurationToSeconds(durationStr: string): number {
        if (durationStr.substr(0, 2) !== "PT") {
            return 0;
        }
        durationStr = durationStr.substr(2);
        const all_titles: {[key: string]: number} = {
            "h": 3600,
            "m": 60,
            "s": 1
        };
        let duration = 0;
        for (const i in all_titles) {
            const match = durationStr.match(new RegExp(`([0-9]+)${i}`, "i"))
            if (match) {
                duration += all_titles[i] * parseInt(match[1]);
            }
        }
        return duration;
    }

    /**
     * Get a video metadata from its id
     * @param youtube
     * @param id
     */
    public static async getYoutubeVideoMeta(youtube: Youtube, id: string): Promise<YoutubeVideoMeta> {
        // Fetch youtube api
        const result = await youtube.videos.list({
            id: encodeURIComponent(id),
            part: 'snippet,contentDetails',
            maxResults: 1,
            fields: 'items(snippet(title,thumbnails),contentDetails,id),pageInfo',
        });
        // If no result
        if (! result.data.items || result.data.items.length === 0) {
            throw new Error('Video not found');
        }
        // Get item object
        const item = result.data.items[0];
        // If data is missing
        if (! item.contentDetails || ! item.contentDetails.duration || ! item.snippet || ! item.snippet.title || ! item.snippet.thumbnails || ! item.snippet.thumbnails.medium || ! item.snippet.thumbnails.medium.url) {
            throw new Error('Unable to load item info');
        }
        // Get important video data & return it
        const duration = YoutubeHelper.youtubeDurationToSeconds(item.contentDetails.duration);
        const title = item.snippet.title;
        const thumb = item.snippet.thumbnails.medium.url;
        return {id, duration, title, thumb};
    }

    /**
     * Get a playlist metadata from its id
     * @param youtube
     * @param id
     */
    public static async getYoutubePlaylistMeta(youtube: Youtube, id: string): Promise<YoutubeVideoMeta[]> {
        const result = await youtube.playlistItems.list({part: 'contentDetails', playlistId: id, maxResults: 50});
        if (! result?.data?.items?.length) {
            throw new Error('No result found for ' + id);
        }
        const videoIds: string[] = result
            .data.items
            .filter(item => item.contentDetails && item.contentDetails.videoId)
            .map(item => item.contentDetails!.videoId as string);
        const videos = [];
        for (const videoId of videoIds) {
            videos.push(await YoutubeHelper.getYoutubeVideoMeta(youtube, videoId))
        }
        return videos;
    }

    /**
     * Get a playlist metadata from its id
     * @param query
     * @param type
     */
    public static async searchYoutube(youtube: Youtube, query: string, type: string, maxResults: number) {
        const result = await youtube.search.list({ part: 'snippet', q: query, type: type, maxResults });
        const items = result?.data?.items;
        if (! items) {
            throw new Error('No result found');
        }
        return items;
    }

    /**
     * Parse a youtube link
     * @param link 
     * @returns 
     */
    public static parseYoutubeLink(link: string): {videoId: string, playlistId: string | null, start: number} {
        let match: RegExpMatchArray | null;

        // If the link contains a playlist
        let playlistId: string | null;
        if (match = link.match(/list=([a-zA-Z0-9-_]+)/)) {
            playlistId = match[1];
        } else {
            playlistId = null;
        }

        // If the link contains a video
        let videoId: string;
        if (match = link.match(/v=([a-zA-Z0-9-_]+)/)) {
            videoId = match[1];
        } else {
            videoId = link;
        }

        // If the link contains a time code
        let start: number;
        if (match = link.match(/(t|time_continue|start)=([0-9hms]+)/)) {
            start = parseInt(match[2]) || 0;
        } else {
            start = 0;
        }

        return {videoId, playlistId, start};
    }
}
