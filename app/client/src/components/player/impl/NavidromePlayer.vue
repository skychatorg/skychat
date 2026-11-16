<script setup>
import { computed, ref, shallowRef, watch, onMounted, onBeforeUnmount } from 'vue';
import { useClientStore } from '@/stores/client';
import { lockedReason as getLockedReason, mediaThumbUrl, roomCursorMs } from '@/lib/player';
import MusicVisualizer from '@/components/player/impl/MusicVisualizer.vue';

const client = useClientStore();

const player = ref(null);
const error = ref('');
// Browsers refuse to start audio before the page got a click. Then we ask for one.
const needsClick = ref(false);

// Tracks are served from a cache with range support, so correcting drift is a cheap seek.
const SEEK_DRIFT_MS = 2_000;

// Per-viewer volume, remembered across songs and visits
const readVolume = () => {
    try {
        const stored = parseFloat(localStorage.getItem('navidrome.volume'));
        return Number.isFinite(stored) ? stored : 1;
    } catch {
        return 1;
    }
};
const volume = ref(readVolume());
watch(volume, (value) => {
    applyGain();
    try {
        localStorage.setItem('navidrome.volume', String(value));
    } catch {
        // Storage blocked: the volume just won't be remembered
    }
});

const video = computed(() => client.state.player.current?.video || null);
const token = computed(() => client.state.player.streamToken || '');
const lockedReason = computed(() => getLockedReason(video.value, token.value, client.state.user));
const cover = computed(() => mediaThumbUrl(video.value, token.value)?.replace('size=300', 'size=600') ?? null);

// The title is "Artist - Song", split back for display
const titleParts = computed(() => {
    const title = video.value?.title ?? '';
    const sep = title.indexOf(' - ');
    return sep > 0 ? { artist: title.slice(0, sep), song: title.slice(sep + 3) } : { artist: '', song: title };
});

const roomCursor = () => roomCursorMs(client.state.player, client.state.playerLastUpdate);

// Loudness is perceived on a log scale: squaring makes the low end of the slider actually quiet
const gainFor = (value) => value * value;

// iOS ignores <audio>.volume, so the volume goes through a Web Audio gain node, created on first play
// (an AudioContext needs a user gesture)
let audioContext = null;
let gainNode = null;
// Read by the visualizer. It sits before the gain, so the visuals don't shrink with the volume
const analyser = shallowRef(null);
const audioPlaying = ref(false);
const disc = ref(null);
const applyGain = () => {
    if (gainNode) gainNode.gain.value = gainFor(volume.value);
};
const ensureAudioGraph = () => {
    if (audioContext || !player.value || !window.AudioContext) return;
    audioContext = new AudioContext();
    gainNode = audioContext.createGain();
    const analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 1024;
    // The default range (-100 dB) reads almost any music as loud everywhere; this leaves room for the beats
    analyserNode.minDecibels = -75;
    analyserNode.maxDecibels = -20;
    audioContext.createMediaElementSource(player.value).connect(analyserNode).connect(gainNode).connect(audioContext.destination);
    analyser.value = analyserNode;
    applyGain();
};

const play = () => {
    ensureAudioGraph();
    audioContext?.resume();
    player.value
        ?.play()
        // The element may be allowed to play while the audio context isn't, which would play silence
        .then(() => (needsClick.value = audioContext?.state === 'suspended'))
        .catch((err) => {
            if (err?.name === 'NotAllowedError') needsClick.value = true;
        });
};

const syncToRoom = (force = false) => {
    // A finished track waits for the next one: play() on an ended element would restart it
    if (!player.value || player.value.readyState < 1 || player.value.ended) return;
    const desired = roomCursor() / 1000;
    if (desired >= player.value.duration) return;
    if (force || Math.abs(desired - player.value.currentTime) * 1000 > SEEK_DRIFT_MS) {
        player.value.currentTime = desired;
    }
    if (client.state.player.paused) {
        player.value.pause();
    } else if (player.value.paused) {
        play();
    }
};

// The src is set by hand, keyed on the song only: the stream token is renewed on every sync, and
// binding it would reload the track each time.
let loadedId = '';
const load = () => {
    if (!player.value || !video.value || !token.value || video.value.id === loadedId) return;
    loadedId = video.value.id;
    error.value = '';
    player.value.src = `/api/plugin/player/navidrome/stream/${encodeURIComponent(loadedId)}?t=${encodeURIComponent(token.value)}`;
};

// One retry per track: a server restart or a slow first download shouldn't cost the whole song
let retriedId = '';
let retryTimer = null;
const onAudioError = () => {
    if (retriedId === loadedId) {
        error.value = 'This track could not be played.';
        return;
    }
    retriedId = loadedId;
    retryTimer = setTimeout(() => {
        loadedId = '';
        load();
    }, 3_000);
};

watch(() => video.value?.id, load);
watch(token, load);
watch(
    () => client.state.playerLastUpdate,
    () => syncToRoom(!!client.state.player.forced),
);
watch(
    () => client.state.player.paused,
    () => syncToRoom(),
);

// Keep this listener from un-pausing locally while the room is paused
const onNativePlay = (event) => {
    if (client.state.player.paused) event.target.pause();
};

let pollTimer = null;
onMounted(() => {
    load();
    pollTimer = setInterval(syncToRoom, 5_000);
});

onBeforeUnmount(() => {
    audioContext?.close();
    clearTimeout(retryTimer);
    clearInterval(pollTimer);
    if (player.value) {
        player.value.removeAttribute('src');
        player.value.load();
    }
});
</script>

<template>
    <div class="relative w-full h-full overflow-hidden bg-black text-white">
        <!-- Blurred cover as the backdrop -->
        <img v-if="cover" :src="cover" alt="" class="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40" />

        <MusicVisualizer :analyser="analyser" :playing="audioPlaying" :cover="cover" :disc="disc" />

        <div class="relative h-full flex items-center justify-center gap-[max(2rem,6%)] p-4">
            <!-- The visualizer draws the cover here as a turning disc, inside its rings -->
            <div ref="disc" class="h-[48%] max-h-[min(13rem,30vw)] aspect-square shrink-0 rounded-full flex items-center justify-center">
                <fa v-if="!cover" icon="music" class="text-2xl opacity-40" />
            </div>
            <div class="min-w-0 max-w-xs flex-1 flex flex-col gap-2">
                <div class="text-lg font-semibold leading-tight line-clamp-2">{{ titleParts.song }}</div>
                <div v-if="titleParts.artist" class="text-sm text-white/70 truncate">{{ titleParts.artist }}</div>
                <div v-if="lockedReason" class="text-sm text-white/80">{{ lockedReason }}</div>
                <div v-else-if="error" class="text-sm text-red-300">{{ error }}</div>
                <button v-else-if="needsClick" class="form-control px-3 py-1 text-sm w-fit" @click="play">
                    <fa icon="play" class="mr-1" /> Listen
                </button>
                <label v-if="!lockedReason" class="flex items-center gap-2 min-w-0 text-white/70" title="Volume">
                    <fa :icon="volume > 0 ? 'volume-high' : 'volume-xmark'" fixed-width />
                    <input
                        v-model.number="volume"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        class="w-full max-w-[7rem] min-w-0 accent-white"
                    />
                </label>
                <audio
                    ref="player"
                    @loadedmetadata="syncToRoom(true)"
                    @play="onNativePlay"
                    @playing="audioPlaying = true"
                    @pause="audioPlaying = false"
                    @ended="audioPlaying = false"
                    @error="onAudioError"
                ></audio>
            </div>
        </div>
    </div>
</template>
