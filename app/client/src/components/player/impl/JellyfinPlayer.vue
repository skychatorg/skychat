<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useClientStore } from '@/stores/client';
import { roomCursorMs } from '@/lib/player';
import { useJellyfinTracks } from '@/composables/useJellyfinTracks.js';

const client = useClientStore();

const player = ref(null);
const srcOnLoad = ref('');
// Safari: play the playlist through the element itself rather than MSE.
const nativeHlsOnly = ref(false);
const decodeError = ref('');
// How far the local <video> may drift from the room cursor before we correct it. HLS gives us a
// real seekable timeline, so correcting is a cheap `currentTime` assignment rather than restarting
// the stream — no transcode-startup lag to leave headroom for, hence seconds instead of tens.
const SEEK_DRIFT_MS = 2_000;

// How much video hls.js keeps buffered ahead. This is the whole point of using HLS: the previous
// progressive stream was non-seekable with no Content-Length, so the browser held barely two
// seconds no matter the bitrate, and any hiccup (entering fullscreen, say) drained it into a
// visible freeze.
const MAX_BUFFER_SECONDS = 60;

// Per-viewer preferences (persisted). 'off' = no subtitles, 'default' = pick server default/forced.
// Owned by the composable so the picker, which now lives in the control strip, shares them
const { preferredAudioLang, preferredSubLang } = useJellyfinTracks();

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

// The HLS media playlist covers the entire file, so the URL depends only on which media and which
// audio track — never on position. Seeking is `currentTime`, not a new URL.
const streamUrl = computed(() => {
    if (!currentVideo.value || !jf.value || !streamToken.value) return '';
    const params = new URLSearchParams({
        mediaSourceId: jf.value.mediaSourceId,
        t: streamToken.value,
    });
    if (resolvedAudioIndex.value !== null) {
        params.set('audioStreamIndex', String(resolvedAudioIndex.value));
    }
    return `/api/plugin/player/jellyfin/hls/${currentVideo.value.id}/main.m3u8?${params.toString()}`;
});

const subtitleUrl = (index) => {
    const video = currentVideo.value;
    if (!video || !jf.value || !streamToken.value) return '';
    // HLS keeps one monotonic timeline for the whole file, so cues need no rebasing and the URL is
    // stable across seeks — which also means the <track> nodes no longer have to be replaced.
    return `/api/plugin/player/jellyfin/subtitle/${video.id}/${jf.value.mediaSourceId}/${index}.vtt?t=${encodeURIComponent(
        streamToken.value,
    )}`;
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

// Absolute ms position the <video> element is currently showing. With HLS this is simply the
// element's own time, since the playlist starts at the beginning of the file.
const currentAbsoluteMs = () => {
    if (!player.value) return 0;
    return (player.value.currentTime || 0) * 1000;
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

// hls.js owns the media element once attached. Kept in a plain variable, not a ref: it holds
// large internal buffers we never want Vue to make reactive.
let hls = null;
let retriedAfterNetworkError = false;
// What the attached playlist represents. Deliberately NOT the URL: the server mints a fresh stream
// token on every player-sync, so comparing URLs would re-attach several times a minute. Only the
// media and the audio track actually change which playlist we need.
let hlsLoadedKey = '';

// Attach (or re-attach) the playlist. Only needed when the playlist itself changes — a different
// video, or a different audio track, since the audio index is baked into the URL. Position is NOT
// part of it any more.
const attachPlaylist = async (url) => {
    if (!player.value || !url) return;

    // Safari plays HLS natively and does it better than MSE would.
    if (!nativeHlsOnly.value) {
        const { default: Hls } = await import('hls.js');
        if (!Hls.isSupported()) {
            nativeHlsOnly.value = true;
        } else {
            if (!hls) {
                hls = new Hls({
                    maxBufferLength: MAX_BUFFER_SECONDS,
                    backBufferLength: 30,
                    // The production CSP allows blob: workers, but degrade rather than break if a
                    // deployment forgets it.
                    enableWorker: true,
                });
                hls.on(Hls.Events.ERROR, (_event, data) => {
                    if (!data?.fatal) return;
                    // Stream tokens expire after a couple of hours, which a long film can outlive.
                    // The URL is rebuilt from the latest token, so one retry recovers that case.
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !retriedAfterNetworkError) {
                        retriedAfterNetworkError = true;
                        hls.loadSource(streamUrl.value);
                        return;
                    }
                    decodeError.value = 'Playback error. The browser could not play this stream.';
                });
                hls.attachMedia(player.value);
            }
            hls.loadSource(url);
            return;
        }
    }
    srcOnLoad.value = url;
};

// Bring local playback back in line with the room. A plain seek now — the old code had to rebuild
// the stream URL and reload the element, because a live progressive stream has no seekable range.
const syncToRoomCursor = (force = false) => {
    if (!player.value) return;
    const desired = roomCursor();
    if (!force && Math.abs(desired - currentAbsoluteMs()) <= SEEK_DRIFT_MS) return;
    try {
        player.value.currentTime = desired / 1000;
    } catch {
        // Seeking before the manifest is parsed throws; the ManifestParsed handler retries.
    }
};

const applyStream = (force = false) => {
    if (!currentVideo.value) return;
    if (!runCodecProbe()) return;

    const url = streamUrl.value;
    if (!url) return;

    const key = `${currentVideo.value.id}|${resolvedAudioIndex.value}`;
    const isNewPlaylist = key !== hlsLoadedKey;
    if (isNewPlaylist) {
        hlsLoadedKey = key;
        attachPlaylist(url).then(() => {
            // Land at the room position once the media is ready to accept a seek.
            const onReady = () => {
                player.value?.removeEventListener('loadedmetadata', onReady);
                syncToRoomCursor(true);
                applySubtitleSelection();
                if (client.state.player.paused) player.value?.pause();
            };
            player.value?.addEventListener('loadedmetadata', onReady);
        });
        return;
    }

    syncToRoomCursor(force);
};

// Poll room cursor — triggers applyStream which will reload only if drift is big.
let cursorPollTimer = null;

const onVideoError = () => {
    if (decodeError.value) return; // already set by the probe
    decodeError.value = 'Playback error. The browser could not play this stream.';
};

watch(
    () => currentVideo.value && currentVideo.value.id,
    () => applyStream(),
);
watch(resolvedAudioIndex, () => applyStream());
watch(streamToken, () => applyStream());
// Fire on every player-sync. Automatic syncs ignore drift < SEEK_DRIFT_MS; a manual "Synchronize"
// (player.forced) forces a reload at the room cursor.
watch(
    () => client.state.playerLastUpdate,
    () => applyStream(!!client.state.player.forced),
);

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
    // Safari reports 'maybe'/'probably' and handles HLS natively; everything else goes through MSE.
    const el = document.createElement('video');
    nativeHlsOnly.value = !window.MediaSource && !!el.canPlayType('application/vnd.apple.mpegurl');
    applyStream();
    // Also poll periodically — catches cases where local playback pauses or stalls
    // and drifts silently from the room cursor.
    cursorPollTimer = setInterval(applyStream, 5_000);
});

onBeforeUnmount(() => {
    if (cursorPollTimer) clearInterval(cursorPollTimer);
    if (hls) {
        hls.destroy();
        hls = null;
    }
    hlsLoadedKey = '';
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
            :src="nativeHlsOnly ? srcOnLoad : undefined"
            @error="onVideoError"
            @play="onNativePlay"
        >
            <!--
                Subtitle URLs are stable now that HLS keeps one timeline for the whole file, so the
                nodes survive seeks and cues no longer need refetching.
            -->
            <track
                v-for="sub in textSubtitles"
                :id="String(sub.index)"
                :key="sub.index"
                kind="subtitles"
                :src="subtitleUrl(sub.index)"
                :srclang="sub.language || 'und'"
                :label="sub.label"
                :default="sub.index === resolvedSubIndex"
            />
        </video>
    </div>
</template>

<style scoped></style>
