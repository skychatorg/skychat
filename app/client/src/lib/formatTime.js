/**
 * Format a duration in milliseconds as a clock string.
 *   < 1 hour  -> "m:ss"
 *   >= 1 hour -> "h:mm:ss"
 * Negative / non-finite inputs are treated as 0.
 *
 * @param {number} ms
 * @returns {string}
 */
export function formatMs(ms) {
    const totalSeconds = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
