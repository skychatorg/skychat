/**
 * Interpolate the room's current playback cursor (in ms) between server syncs.
 *
 * The server sends an authoritative `cursor` on every player-sync; between syncs we
 * advance it locally by the wall-clock time elapsed since the last update so the UI
 * stays smooth. Returns 0 before the first sync (no media / no `playerLastUpdate`).
 *
 * @param {{ current: unknown, cursor: number }} player client.state.player
 * @param {Date|null} playerLastUpdate client.state.playerLastUpdate
 * @returns {number} interpolated room cursor in ms
 */
export function roomCursorMs(player, playerLastUpdate) {
    if (!player?.current || !playerLastUpdate) {
        return 0;
    }
    // While paused the server freezes the cursor, so don't advance it locally.
    if (player.paused) {
        return Math.max(0, player.cursor);
    }
    return Math.max(0, player.cursor + (Date.now() - playerLastUpdate.getTime()));
}

/**
 * Media types whose impl component owns a controllable <video>/JS handle and can be paused.
 * Adding a type here is the ONLY change needed to enable pause for it client-side (plus the
 * actual pause/play wiring in that type's impl component). The server stays media-type-agnostic.
 */
const PAUSABLE_TYPES = { gallery: true, jellyfin: true, navidrome: true };

/**
 * Media types served by SkyChat's own proxy, whose stream and thumbnail URLs need the viewer's stream token.
 */
const PROXIED_TYPES = { jellyfin: true, navidrome: true };

/**
 * Thumbnail URL of a media as the viewer can load it: proxied thumbs get the stream token appended
 * (their URL always carries a query already), others pass through unchanged.
 * @param {{ type: string, thumb?: string }} video
 * @param {string|undefined} token client.state.player.streamToken
 * @returns {string|null}
 */
export function mediaThumbUrl(video, token) {
    if (!video?.thumb) {
        return null;
    }
    if (PROXIED_TYPES[video.type]) {
        return token ? `${video.thumb}&t=${encodeURIComponent(token)}` : null;
    }
    return video.thumb;
}

/**
 * Why this viewer gets no stream for a proxied media (the server only sends a token to those
 * allowed to play it), or null when they can play it.
 * @param {{ type: string }|null|undefined} video
 * @param {string|undefined} token client.state.player.streamToken
 * @param {{ id?: number }} user client.state.user
 * @returns {string|null}
 */
export function lockedReason(video, token, user) {
    if (!video || !PROXIED_TYPES[video.type] || token) {
        return null;
    }
    if (video.type === 'navidrome') {
        return user?.id ? "Your account can't play the music library yet." : 'Guests cannot hear the music. Log in to listen along.';
    }
    return user?.id ? "Your account can't play Jellyfin videos yet." : 'Guests cannot see this video. Log in to watch along.';
}

/**
 * Whether the given video can be paused from the UI.
 * @param {{ type?: string }|null|undefined} video
 * @returns {boolean}
 */
export function isPausable(video) {
    return !!video && PAUSABLE_TYPES[video.type] === true;
}
