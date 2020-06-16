import {User} from "../../../User";
import {YoutubeVideoMeta} from "./YoutubeVideoMeta";



/**
 * A pending youtube video in the queue
 */
export interface PendingYoutubeVideo {

    /**
     * The user that added the youtube video
     */
    user: User;

    /**
     * Shift from the start of the video, in seconds
     */
    start: number;

    /**
     * The video details
     */
    video: YoutubeVideoMeta;
}
