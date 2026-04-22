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
export const PAUSABLE_TYPES = { gallery: true, jellyfin: true };

/**
 * Whether the given video can be paused from the UI.
 * @param {{ type?: string }|null|undefined} video
 * @returns {boolean}
 */
export function isPausable(video) {
    return !!video && PAUSABLE_TYPES[video.type] === true;
}
