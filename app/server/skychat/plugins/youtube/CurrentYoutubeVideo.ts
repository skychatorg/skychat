import {SanitizedUser, User} from "../../User";
import {YoutubeVideoMeta} from "./YoutubeVideoMeta";
import {SanitizedPendingYoutubeVideo} from "./PendingYoutubeVideo";



/**
 * A currently playing video
 */
export interface CurrentYoutubeVideo {

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

    /**
     * Date when the video has been started
     */
    startedDate: Date;
}


/**
 * The sanitized version of the currently playing youtube video
 */
export type SyncPlayerStateObject = {

    /**
     * User that added the video
     */
    user: SanitizedUser,

    /**
     * Shift from the start of the video in seconds
     */
    start: number,

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
    cursor: number,

    /**
     * List of next videos to play
     */
    queue: SanitizedPendingYoutubeVideo[]
}
