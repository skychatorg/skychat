import {SanitizedUser, User} from "../../../User";
import {YoutubeVideoMeta} from "./YoutubeVideoMeta";
import {PendingYoutubeVideo} from "./PendingYoutubeVideo";



/**
 * A currently playing video
 */
export interface CurrentYoutubeVideo extends PendingYoutubeVideo {

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
     * Shift from the start of the video in seconds
     */
    start: number,

    /**
     * Date when the video started playing
     */
    startedDate: number,

    /**
     * Current time
     */
    cursor: number
}
