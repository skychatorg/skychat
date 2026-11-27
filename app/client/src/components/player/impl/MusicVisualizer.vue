<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { readBands } from '@/lib/visualizer/audioBands';
import { createBloomWaves } from '@/lib/visualizer/bloomWaves';
import { coverPalette, FALLBACK_PALETTE } from '@/lib/visualizer/coverPalette';

const props = defineProps({
    // Null until the first play creates the audio graph: the rings then rest at their base size
    analyser: { type: Object, default: null },
    playing: { type: Boolean, default: false },
    cover: { type: String, default: null },
    // Element the cover disc is drawn over, so the page layout decides where it sits
    disc: { type: Object, default: null },
});

const canvas = ref(null);
const draw = createBloomWaves();
const bands = new Float32Array(64);
let bins = null;
let image = null;
let palette = FALLBACK_PALETTE;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

watch(
    () => props.cover,
    (url) => {
        image = null;
        palette = FALLBACK_PALETTE;
        if (!url) return render(0);
        const next = new Image();
        next.onload = () => {
            if (props.cover !== url) return;
            image = next;
            palette = coverPalette(next);
            render(0);
        };
        next.src = url;
    },
    { immediate: true },
);

function render(dt) {
    const el = canvas.value;
    if (!el || !props.disc) return;
    const box = el.getBoundingClientRect();
    const slot = props.disc.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (el.width !== Math.round(box.width * dpr) || el.height !== Math.round(box.height * dpr)) {
        el.width = Math.round(box.width * dpr);
        el.height = Math.round(box.height * dpr);
    }
    if (props.analyser) {
        bins ??= new Uint8Array(props.analyser.frequencyBinCount);
        readBands(props.analyser, bins, bands);
    }
    const ctx = el.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, {
        width: box.width,
        height: box.height,
        bands,
        palette,
        cover: image,
        disc: { x: slot.left - box.left + slot.width / 2, y: slot.top - box.top + slot.height / 2, r: slot.width / 2 },
        dt,
    });
}

// Animate only while the music plays, and not at all for reduced motion: then a still frame follows changes
let frame = null;
let last = 0;
function loop(now) {
    render(last ? Math.min(0.05, (now - last) / 1000) : 0);
    last = now;
    frame = requestAnimationFrame(loop);
}
function stop() {
    cancelAnimationFrame(frame);
    frame = null;
    last = 0;
}
watch(
    () => props.playing && !reducedMotion,
    (animate) => {
        stop();
        if (animate) frame = requestAnimationFrame(loop);
        else render(0);
    },
);

// The disc element arrives after this component mounts (parent refs come last)
watch(
    () => props.disc,
    () => !frame && render(0),
);

let resizeObserver = null;
onMounted(() => {
    resizeObserver = new ResizeObserver(() => !frame && render(0));
    resizeObserver.observe(canvas.value);
    if (props.playing && !reducedMotion) frame = requestAnimationFrame(loop);
    else render(0);
});

onBeforeUnmount(() => {
    stop();
    resizeObserver?.disconnect();
});
</script>

<template>
    <canvas ref="canvas" class="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true"></canvas>
</template>
