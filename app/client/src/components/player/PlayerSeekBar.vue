<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useClientStore } from '@/stores/client';
import { roomCursorMs } from '@/lib/player';
import { formatMs } from '@/lib/formatTime';

const client = useClientStore();

const track = ref(null);
// Local ticker so the fill advances smoothly between server syncs.
const now = ref(Date.now());
let timer = null;

// While scrubbing, hold the previewed fraction here (0..1) and only commit the seek on
// release. This gives instant visual feedback without firing a /playerseek per pointermove
// (which would get rate-limited on a drag).
const dragFraction = ref(null);

// Total duration of the current media in ms. Only media with a known duration
// (YouTube, Jellyfin, gallery…) get a seek bar; live/iframe media report 0 and hide it.
const durationMs = computed(() => client.state.player.current?.video?.duration ?? 0);
const visible = computed(() => Boolean(client.state.player.current) && durationMs.value > 0);

// Current room position, clamped to the duration. `now` is a reactive dependency so
// this recomputes on every tick (roomCursorMs itself reads Date.now()).
const positionMs = computed(() => {
    void now.value;
    return Math.min(durationMs.value, roomCursorMs(client.state.player, client.state.playerLastUpdate));
});

// While dragging, the bar reflects the preview position; otherwise the live room position.
const fraction = computed(() => {
    if (dragFraction.value !== null) {
        return dragFraction.value;
    }
    return durationMs.value > 0 ? positionMs.value / durationMs.value : 0;
});
const elapsedLabel = computed(() => formatMs(fraction.value * durationMs.value));
const totalLabel = computed(() => formatMs(durationMs.value));

const fractionFromClientX = (clientX) => {
    const el = track.value;
    if (!el) {
        return null;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) {
        return null;
    }
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
};

const commitSeek = (ratio) => {
    if (ratio === null || durationMs.value <= 0) {
        return;
    }
    const target = Math.floor(ratio * durationMs.value);
    // Server enforces player permission and replies with an error toast if not allowed.
    client.sendMessage(`/playerseek ${target}`);
};

// Click or drag the track: preview locally while held, commit a single seek on release.
const onPointerDown = (event) => {
    dragFraction.value = fractionFromClientX(event.clientX);
    const onMove = (e) => {
        const f = fractionFromClientX(e.clientX);
        if (f !== null) {
            dragFraction.value = f;
        }
    };
    const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        const ratio = dragFraction.value;
        dragFraction.value = null;
        commitSeek(ratio);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
};

onMounted(() => {
    timer = setInterval(() => {
        now.value = Date.now();
    }, 250);
});

onBeforeUnmount(() => {
    if (timer) {
        clearInterval(timer);
    }
});
</script>

<template>
    <div v-if="visible" class="flex items-center gap-2 px-3 py-1.5 hairline" :style="{ background: 'var(--surface-2)' }">
        <span class="text-xs tabular-nums text-white/60 w-12 text-right">{{ elapsedLabel }}</span>
        <div
            ref="track"
            class="group relative grow h-4 flex items-center cursor-pointer select-none"
            title="Seek"
            @pointerdown="onPointerDown"
        >
            <div class="relative w-full h-1 rounded-full bg-white/15 overflow-hidden">
                <div class="absolute inset-y-0 left-0 bg-primary rounded-full" :style="{ width: `${fraction * 100}%` }" />
            </div>
            <div
                class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition"
                :style="{ left: `${fraction * 100}%` }"
            />
        </div>
        <span class="text-xs tabular-nums text-white/60 w-12">{{ totalLabel }}</span>
    </div>
</template>

<style scoped></style>
