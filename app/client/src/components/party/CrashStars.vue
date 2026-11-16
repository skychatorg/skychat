<script setup>
import { onMounted, onUnmounted, ref } from 'vue';

/**
 * Stars rushing the opposite way of the flight: dots when slow, streaks as it speeds up
 */
const props = defineProps({
    /** 0 to 1, how fast the flight feels */
    speed: { type: Number, required: true },
    crashed: { type: Boolean, default: false },
});

// Down and to the left, against the curve
const DIRECTION = { x: -0.8, y: 0.6 };

const canvas = ref(null);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let stars = [];
let width = 0;
let height = 0;
let current = 0;
let frame = null;
let last = 0;
let observer = null;

// New stars come in from the top or right edge, so the field stays full
const spawn = (anywhere) => {
    const depth = 0.25 + Math.random() * 0.75;
    if (anywhere) {
        return { x: Math.random() * width, y: Math.random() * height, depth };
    }
    return Math.random() < width / (width + height)
        ? { x: Math.random() * width * 1.2, y: -10, depth }
        : { x: width + 10, y: Math.random() * height - height * 0.2, depth };
};

const resize = () => {
    const box = canvas.value.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    width = box.width;
    height = box.height;
    canvas.value.width = Math.round(width * ratio);
    canvas.value.height = Math.round(height * ratio);
    canvas.value.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
    // One star for every few thousand pixels, so small players are not crowded
    const count = Math.max(25, Math.min(160, Math.round((width * height) / 3500)));
    stars = Array.from({ length: count }, () => spawn(true));
};

const draw = (time) => {
    const dt = Math.min(50, time - (last || time)) / 16.7;
    last = time;
    // Eased, so a crash slows the field down instead of freezing it
    const target = reducedMotion ? 0 : props.speed;
    current += (target - current) * (props.crashed ? 0.12 : 0.05) * dt;

    const ctx = canvas.value.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    const color = props.crashed ? '255 143 163' : '226 232 255';
    for (const star of stars) {
        const pace = (0.15 + current ** 1.5 * 38) * star.depth;
        star.x += DIRECTION.x * pace * dt;
        star.y += DIRECTION.y * pace * dt;
        if (star.x < -40 || star.y > height + 40) {
            Object.assign(star, spawn(false));
            continue;
        }
        const alpha = 0.25 + star.depth * 0.6;
        const tail = pace * 2.5;
        if (tail < 2) {
            ctx.fillStyle = `rgb(${color} / ${alpha})`;
            ctx.fillRect(star.x, star.y, 1.4 * star.depth + 0.4, 1.4 * star.depth + 0.4);
            continue;
        }
        const gradient = ctx.createLinearGradient(star.x, star.y, star.x - DIRECTION.x * tail, star.y - DIRECTION.y * tail);
        gradient.addColorStop(0, `rgb(${color} / ${alpha})`);
        gradient.addColorStop(1, `rgb(${color} / 0)`);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 0.6 + star.depth * 1.2;
        ctx.beginPath();
        ctx.moveTo(star.x, star.y);
        ctx.lineTo(star.x - DIRECTION.x * tail, star.y - DIRECTION.y * tail);
        ctx.stroke();
    }
    frame = requestAnimationFrame(draw);
};

onMounted(() => {
    resize();
    observer = new ResizeObserver(resize);
    observer.observe(canvas.value);
    frame = requestAnimationFrame(draw);
});
onUnmounted(() => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
});
</script>

<template>
    <canvas ref="canvas" class="stars" aria-hidden="true"></canvas>
</template>

<style scoped>
.stars {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}
</style>
