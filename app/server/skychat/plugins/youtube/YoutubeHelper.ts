import {YoutubeVideoMeta} from "./YoutubeVideoMeta";
import {youtube_v3} from "googleapis";
import Youtube = youtube_v3.Youtube;


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
}
