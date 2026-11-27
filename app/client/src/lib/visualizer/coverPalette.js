// Used until the cover loads, or when it has no vivid color
export const FALLBACK_PALETTE = ['rgb(255, 79, 163)', 'rgb(255, 179, 71)', 'rgb(124, 108, 255)'];

/**
 * The three most vivid colors of a cover, from its most saturated hue families, most present first
 * @param {HTMLImageElement} image A loaded, same-origin image
 * @returns {string[]} Three CSS colors
 */
export function coverPalette(image) {
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    // 12 hue families, each weighted by how vivid its pixels are
    const families = Array.from({ length: 12 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
    for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const vividness = ((max - min) / 255) * (max / 255);
        if (vividness < 0.15) continue;
        const family = families[Math.floor(hue(r, g, b, max, min) / 30) % 12];
        family.weight += vividness;
        family.r += r * vividness;
        family.g += g * vividness;
        family.b += b * vividness;
    }
    const picked = families
        .filter((family) => family.weight > 0)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map(({ weight, r, g, b }) => `rgb(${Math.round(r / weight)}, ${Math.round(g / weight)}, ${Math.round(b / weight)})`);
    return [...picked, ...FALLBACK_PALETTE].slice(0, 3);
}

function hue(r, g, b, max, min) {
    if (max === min) return 0;
    const d = max - min;
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return h * 60;
}
