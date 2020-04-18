import {SanitizedUser, User} from "../../../User";
import {YoutubeVideoMeta} from "./YoutubeVideoMeta";



/**
 * A currently playing video
 */
export interface CurrentYoutubeVideo {

    /**
     * The user that added the youtube video
     */
    user: User;

    /**
     * The video details
     */
    video: YoutubeVideoMeta;

    /**
     * Date when the video has been started
     */
    startedDate: Date;
}


/**
 * The sanitized version of the currently playing youtube video
 */
export type SanitizedCurrentYoutubeVideo = {

    /**
     * Whether this connection has the player enabled
     */
    enabled: boolean;

    /**
     * User that added the video
     */
    user: SanitizedUser,

    /**
     * Video meta
     */
    video: YoutubeVideoMeta,

    /**
     * Date when the video started playing
     */
    startedDate: number,

    /**
     * Current time
     */
    cursor: number
}
