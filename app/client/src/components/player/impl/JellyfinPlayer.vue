<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useClientStore } from '@/stores/client';
import { roomCursorMs } from '@/lib/player';
import JellyfinTrackPicker from '@/components/player/impl/JellyfinTrackPicker.vue';

const client = useClientStore();

const player = ref(null);
const srcOnLoad = ref('');
const previousVideoHash = ref(null);
const decodeError = ref('');
// Absolute ms offset of where the current stream URL was requested to start.
// The <video> element's currentTime is relative to this — to get absolute file
// position, add `loadedStartMs + currentTime*1000`.
const loadedStartMs = ref(0);
// Threshold: above this much drift between room cursor and local playback,
// we treat the cursor change as a seek and reload the stream at the new position.
// Must stay ABOVE Jellyfin's ffmpeg transcode-startup latency (a few seconds): while
// the stream spins up, the <video> sits at its start while the wall-clock room cursor
// keeps ticking, so a too-low threshold reads that startup lag as a seek and reloads in
// a loop — the media never plays, it just teleports. The only real seeks are skip30/
// replay30 (±30s), so 10s cleanly separates startup lag from an intentional jump.
const SEEK_DRIFT_MS = 10_000;

// Per-viewer preferences (persisted). 'off' = no subtitles, 'default' = pick server default/forced.
const preferredSubLang = ref(localStorage.getItem('jf.subLang') || 'default');
const preferredAudioLang = ref(localStorage.getItem('jf.audLang') || 'default');
watch(preferredSubLang, (v) => localStorage.setItem('jf.subLang', v));
watch(preferredAudioLang, (v) => localStorage.setItem('jf.audLang', v));

const jf = computed(() => client.state.player.current?.video?.jellyfin || null);
const currentVideo = computed(() => client.state.player.current?.video || null);
const streamToken = computed(() => client.state.player.streamToken || '');

// Text-based subtitles are the only ones we can render via <track>.
// Bitmap subs (PGS, VobSub) are shown in the picker but disabled.
const textSubtitles = computed(() => (jf.value?.subtitleTracks || []).filter((s) => s.isTextBased));

// Picker preference values are either 'default', 'off' (subs), or 'idx:N' referencing a stream index.
const parseIdxPref = (value) => {
    if (typeof value !== 'string' || !value.startsWith('idx:')) return null;
    const n = parseInt(value.slice(4), 10);
    return Number.isFinite(n) ? n : null;
};

// Pick the audio stream index to request. We include it in the URL, so changing audio
// requires rebuilding src and reloading the element (HTMLMediaElement has no native
// multi-audio-track selector for a single stream URL).
const resolvedAudioIndex = computed(() => {
    if (!jf.value) return null;
    const tracks = jf.value.audioTracks || [];
    if (tracks.length === 0) return null;
    const explicit = parseIdxPref(preferredAudioLang.value);
    if (explicit !== null) {
        const match = tracks.find((t) => t.index === explicit);
        if (match) return match.index;
    }
    return (tracks.find((t) => t.isDefault) || tracks[0]).index;
});

// For subtitle selection. Skip bitmap tracks (not renderable via <track>).
const resolvedSubIndex = computed(() => {
    if (!jf.value) return null;
    const tracks = textSubtitles.value;
    if (preferredSubLang.value === 'off') return null;
    const explicit = parseIdxPref(preferredSubLang.value);
    if (explicit !== null) {
        const match = tracks.find((t) => t.index === explicit);
        if (match) return match.index;
    }
    // 'default' or invalid pref: forced -> IsDefault-text -> first text track -> null.
    const forced = tracks.find((t) => t.isForced);
    if (forced) return forced.index;
    const def = tracks.find((t) => t.isDefault);
    if (def) return def.index;
    return tracks.length > 0 ? tracks[0].index : null;
});

// Stream URL is a function of (itemId, mediaSourceId, audioStreamIndex, startTimeMs, token).
// Jellyfin transcodes the live ffmpeg output starting at startTimeTicks, so every URL rebuild
// is effectively a seek (cheap — video stream is copied, only audio is re-encoded).
const streamUrl = computed(() => {
    if (!currentVideo.value || !jf.value || !streamToken.value) return '';
    const params = new URLSearchParams({
        mediaSourceId: jf.value.mediaSourceId,
        t: streamToken.value,
    });
    if (resolvedAudioIndex.value !== null) {
        params.set('audioStreamIndex', String(resolvedAudioIndex.value));
    }
    if (loadedStartMs.value > 0) {
        params.set('startTimeMs', String(loadedStartMs.value));
    }
    return `/api/plugin/player/jellyfin/stream/${currentVideo.value.id}?${params.toString()}`;
});

const subtitleUrl = (index) => {
    const video = currentVideo.value;
    if (!video || !jf.value || !streamToken.value) return '';
    // Cues are rebased to startTimeMs on the server, so subtitles must request the SAME offset as
    // the video stream (loadedStartMs) or they drift from the picture after a seek. Match streamUrl:
    // only append when > 0.
    let url = `/api/plugin/player/jellyfin/subtitle/${video.id}/${jf.value.mediaSourceId}/${index}.vtt?t=${encodeURIComponent(
        streamToken.value,
    )}`;
    if (loadedStartMs.value > 0) {
        url += `&startTimeMs=${loadedStartMs.value}`;
    }
    return url;
};

// HEVC pre-flight. If codec is hevc and <video> can't decode it, bail out with a clear message.
const runCodecProbe = () => {
    decodeError.value = '';
    if (!jf.value || !player.value) return true;
    const codec = (jf.value.videoCodec || '').toLowerCase();
    if (codec === 'hevc' || codec === 'h265') {
        // A rough HEVC-in-MP4 probe. canPlayType returns '' (no), 'maybe', or 'probably'.
        const canPlay = player.value.canPlayType('video/mp4; codecs="hev1.1.6.L150.B0"');
        if (!canPlay) {
            decodeError.value =
                "Your browser can't decode this video (HEVC). Try Chrome/Edge with hardware decoding, Safari, or ask the queuer to pick an H.264 file.";
            return false;
        }
    }
    return true;
};

// Room cursor (absolute ms since the video's start). Shared helper freezes it while paused.
const roomCursor = () => roomCursorMs(client.state.player, client.state.playerLastUpdate);

// Absolute ms position the <video> element is currently showing.
const currentAbsoluteMs = () => {
    if (!player.value) return loadedStartMs.value;
    return loadedStartMs.value + (player.value.currentTime || 0) * 1000;
};

// Apply selected subtitle track without reloading the <video>.
const applySubtitleSelection = () => {
    if (!player.value) return;
    const target = resolvedSubIndex.value;
    const tracks = player.value.textTracks;
    for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        const idx = parseInt(t.id, 10);
        t.mode = idx === target ? 'showing' : 'disabled';
    }
};
watch(resolvedSubIndex, () => nextTick(applySubtitleSelection));

// Decide when to reload the <video>:
//   - new video queued: reload at room cursor
//   - audio track changed: reload at CURRENT position (don't restart the movie)
//   - room cursor jumped far from local playback (skip30 / replay30 from another viewer,
//     or big drift after pause/refresh): reload at new room cursor
//   - otherwise: continuous playback, do nothing
//
// The <video> element's native seek bar will not work (no known duration on a live ffmpeg
// stream). Seeking is a room-level operation via /player skip30 / /player replay30.
const applyStream = () => {
    if (!currentVideo.value) return;
    if (!runCodecProbe()) return;

    const newVideoId = currentVideo.value.id;
    const hash = `${newVideoId}|${resolvedAudioIndex.value}|${streamToken.value.slice(0, 16)}`;
    const prevHash = previousVideoHash.value;
    const isNewVideo = !prevHash || !prevHash.startsWith(newVideoId + '|');

    const desiredCursor = roomCursor();
    const localAbs = currentAbsoluteMs();
    const seekDetected = hash === prevHash && Math.abs(desiredCursor - localAbs) > SEEK_DRIFT_MS;

    if (hash === prevHash && !seekDetected) {
        return; // continuous playback
    }

    // Pick the ms we want Jellyfin to start ffmpeg at.
    //   - new video or big room-cursor drift (seek) -> use room cursor
    //   - same video, audio changed -> keep playing from our current position
    let nextStartMs;
    if (isNewVideo || seekDetected) {
        nextStartMs = desiredCursor;
    } else {
        nextStartMs = Math.max(0, Math.floor(localAbs));
    }

    previousVideoHash.value = hash;
    loadedStartMs.value = Math.max(0, Math.floor(nextStartMs));

    // streamUrl computed updates via loadedStartMs reactivity.
    nextTick(() => {
        if (!player.value) return;
        srcOnLoad.value = streamUrl.value;
        nextTick(() => {
            if (!player.value) return;
            player.value.load();
            const onReady = () => {
                player.value.removeEventListener('loadedmetadata', onReady);
                applySubtitleSelection();
                // A reload (e.g. seek-while-paused) autoplays; re-assert the room's paused state.
                if (client.state.player.paused) {
                    player.value.pause();
                }
            };
            player.value.addEventListener('loadedmetadata', onReady);
        });
    });
};

// Poll room cursor — triggers applyStream which will reload only if drift is big.
let cursorPollTimer = null;

const onVideoError = () => {
    if (decodeError.value) return; // already set by the probe
    decodeError.value = 'Playback error. The browser could not play this stream.';
};

watch(() => currentVideo.value && currentVideo.value.id, applyStream);
watch(resolvedAudioIndex, applyStream);
watch(streamToken, applyStream);
// Watch room cursor updates (fire on every player-sync); applyStream ignores drift < SEEK_DRIFT_MS.
watch(() => client.state.playerLastUpdate, applyStream);

// Drive the <video> from the shared paused flag. On resume, applyStream (fired by the same sync's
// playerLastUpdate change) reloads at the room cursor if a seek happened while paused.
watch(
    () => client.state.player.paused,
    (paused) => {
        if (!player.value) return;
        if (paused) {
            player.value.pause();
        } else {
            player.value.play()?.catch(() => {});
        }
    },
);

// Reject native un-pausing while the room is paused, so this viewer can't desync locally.
const onNativePlay = (event) => {
    if (client.state.player.paused) {
        event.target.pause();
    }
};

onMounted(() => {
    applyStream();
    // Also poll periodically — catches cases where local playback pauses or stalls
    // and drifts silently from the room cursor.
    cursorPollTimer = setInterval(applyStream, 5_000);
});

onBeforeUnmount(() => {
    if (cursorPollTimer) clearInterval(cursorPollTimer);
    if (player.value) {
        player.value.removeAttribute('src');
        player.value.load();
    }
});
</script>

<template>
    <div class="relative w-full h-full flex flex-col">
        <div v-if="decodeError" class="flex-1 flex items-center justify-center p-6 text-center text-sm bg-black text-white/80">
            {{ decodeError }}
        </div>
        <!-- playsinline: without it iOS Safari forces an autoplaying <video> into native fullscreen,
             breaking the inline watch-together layout (track picker overlay, chat alongside). -->
        <video
            v-else
            ref="player"
            class="w-full h-full"
            controls
            autoplay
            playsinline
            webkit-playsinline
            crossorigin="anonymous"
            :src="srcOnLoad"
            @error="onVideoError"
            @play="onNativePlay"
        >
            <!--
                Key includes loadedStartMs so a seek replaces the <track> node: changing an existing
                track's src does not reliably refetch cues across browsers. The id stays the stream
                index, so applySubtitleSelection (keyed on track.id) still works after the swap.
            -->
            <track
                v-for="sub in textSubtitles"
                :id="String(sub.index)"
                :key="sub.index + ':' + loadedStartMs"
                kind="subtitles"
                :src="subtitleUrl(sub.index)"
                :srclang="sub.language || 'und'"
                :label="sub.label"
                :default="sub.index === resolvedSubIndex"
            />
        </video>
        <JellyfinTrackPicker
            v-if="jf && !decodeError"
            v-model:audio="preferredAudioLang"
            v-model:sub="preferredSubLang"
            :audio-tracks="jf.audioTracks"
            :subtitle-tracks="jf.subtitleTracks"
        />
    </div>
</template>

<style scoped></style>
