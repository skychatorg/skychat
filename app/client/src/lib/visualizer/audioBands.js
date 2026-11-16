/**
 * Read an AnalyserNode into `count` bands from 0 to 1, spaced on a log scale like our hearing:
 * linear FFT bins would give the bass a sliver and the inaudible top half of the spectrum most bands.
 * @param {AnalyserNode} analyser
 * @param {Uint8Array} bins Reused buffer of analyser.frequencyBinCount bytes
 * @param {Float32Array} bands Output, filled in place
 */
export function readBands(analyser, bins, bands) {
    analyser.getByteFrequencyData(bins);
    // Above ~70% of the bins (about 15 kHz at 44.1 kHz) there is little left to show
    const usable = Math.floor(bins.length * 0.7);
    for (let i = 0; i < bands.length; i++) {
        const from = Math.floor(Math.pow(usable, i / bands.length));
        const to = Math.max(from + 1, Math.floor(Math.pow(usable, (i + 1) / bands.length)));
        let sum = 0;
        for (let b = from; b < to; b++) sum += bins[b];
        // Squared, so the peaks stand out from the steady level
        bands[i] = Math.pow(sum / (to - from) / 255, 2);
    }
}
