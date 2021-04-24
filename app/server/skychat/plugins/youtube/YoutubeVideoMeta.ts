

/**
 * Describe the relevant information of a youtube video (to be sent to the client)
 */
export interface YoutubeVideoMeta {

    /**
     * Youtube video id
     */
    id: string;

    /**
     * Preview image url
     */
    thumb: string;

    /**
     * Description name
     */
    title: string

    /**
     * Duration in seconds
     */
    duration: number;
}
