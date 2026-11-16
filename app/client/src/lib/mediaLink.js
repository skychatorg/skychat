/**
 * What the player command for a pasted link is: YouTube, a Twitch channel, or another site played in a frame.
 * Null when it isn't a link
 */
export function mediaFromLink(link) {
    const url = link.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
        return null;
    }
    if (/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
        return { fetcher: 'yt', param: url, label: 'a YouTube video' };
    }
    const twitch = url.match(/^https?:\/\/(www\.)?twitch\.tv\/([a-z0-9_-]+)\/?$/i);
    if (twitch) {
        return { fetcher: 'twitch', param: twitch[2].toLowerCase(), label: `${twitch[2]}'s Twitch stream` };
    }
    return { fetcher: 'iframe', param: url, label: 'a web page' };
}
