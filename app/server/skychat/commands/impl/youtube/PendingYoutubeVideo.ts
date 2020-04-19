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
     * The video details
     */
    video: YoutubeVideoMeta;
}
