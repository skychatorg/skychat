const BURST_COUNT = 10;
const BURST_MAX_DURATION_MS = 2600;

const lastBurstPerSticker = new Map();

/**
 * @param {string} stickerUrl
 * @param {HTMLElement} container The message panel, or any positioned ancestor to burst over
 */
export function triggerHighlightBurst(stickerUrl, container, force = false) {
    if (!stickerUrl || !container) {
        return;
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        return;
    }
    const now = Date.now();
    // Forced (click) bursts keep a short window so a tap firing mouseenter + click bursts once
    const debounceMs = force ? 400 : BURST_MAX_DURATION_MS;
    if (now - (lastBurstPerSticker.get(stickerUrl) ?? 0) < debounceMs) {
        return;
    }
    lastBurstPerSticker.set(stickerUrl, now);

    const overlay = document.createElement('div');
    overlay.className = 'skychat-highlight-burst';
    for (let i = 0; i < BURST_COUNT; ++i) {
        const img = document.createElement('img');
        img.src = stickerUrl;
        img.alt = '';
        img.style.left = 5 + Math.random() * 85 + '%';
        img.style.animationDelay = Math.random() * 600 + 'ms';
        img.style.animationDuration = 1400 + Math.random() * 600 + 'ms';
        overlay.appendChild(img);
    }
    container.appendChild(overlay);
    setTimeout(() => overlay.remove(), BURST_MAX_DURATION_MS);
}
