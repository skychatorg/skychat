<script setup>
import { useVoice } from '@/composables/useVoice';
import { useClientStore } from '@/stores/client';
import { VoiceClient } from '@/lib/voice/VoiceClient.js';
import { onMounted, onUnmounted, ref } from 'vue';

const client = useClientStore();
const voice = useVoice();

const devices = ref([]);
const selfId = () => client.state.user.id;

const refreshDevices = async () => {
    try {
        devices.value = await VoiceClient.listInputDevices();
    } catch {
        devices.value = [];
    }
};

// First unmute = first mic gesture. If we have no producer yet, start capture.
const toggleMute = async () => {
    if (voice.muted.value) {
        await client.voiceStartMic(); // idempotent; opens send transport + capture on first call
        client.setVoiceMuted(false);
    } else {
        client.setVoiceMuted(true);
    }
};

// Push-to-talk: hold Space to open the mic.
const PTT_KEY = ' ';
const onKeyDown = (e) => {
    if (voice.pushToTalk.value && e.key === PTT_KEY) {
        client.setVoiceTalkKey(true);
    }
};
const onKeyUp = (e) => {
    if (voice.pushToTalk.value && e.key === PTT_KEY) {
        client.setVoiceTalkKey(false);
    }
};

onMounted(() => {
    refreshDevices();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
});
onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
});
</script>

<template>
    <div class="strip px-3 py-2 hairline" :style="{ background: 'var(--surface-2)' }">
        <!-- Leave -->
        <div class="strip-group hairline">
            <button class="strip-btn text-danger" title="Leave voice" @click="voice.leave()">
                <fa icon="phone-slash" />
                <span class="hidden sm:inline">Leave</span>
            </button>
        </div>

        <!-- Mic + deafen + PTT -->
        <div class="strip-group hairline">
            <button class="strip-btn" :title="voice.muted.value ? 'Unmute' : 'Mute'" @click="toggleMute">
                <fa :icon="voice.muted.value ? 'microphone-slash' : 'microphone'" :class="{ 'text-danger': voice.muted.value }" />
            </button>
            <button
                class="strip-btn"
                :title="voice.deafened.value ? 'Undeafen' : 'Deafen'"
                @click="client.setVoiceDeafened(!voice.deafened.value)"
            >
                <fa icon="headphones" :class="{ 'text-danger': voice.deafened.value }" />
            </button>
            <button
                class="strip-btn"
                :title="voice.pushToTalk.value ? 'Push-to-talk: on (hold Space)' : 'Push-to-talk: off'"
                @click="client.setVoicePushToTalk(!voice.pushToTalk.value)"
            >
                <fa :icon="voice.pushToTalk.value ? 'toggle-on' : 'toggle-off'" />
                <span class="hidden sm:inline">PTT</span>
            </button>
        </div>

        <!-- Local speaking dot -->
        <span
            class="w-2 h-2 rounded-full transition"
            :class="voice.isSpeaking(selfId()) ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'"
            title="Your mic activity"
        />

        <!-- Device picker -->
        <div class="strip-group hairline ml-auto">
            <select
                class="strip-btn bg-transparent outline-none"
                :value="client.voice.inputDeviceId"
                @focus="refreshDevices"
                @change="client.setVoiceInputDevice($event.target.value || null)"
            >
                <option :value="null">Default mic</option>
                <option v-for="d in devices" :key="d.deviceId" :value="d.deviceId">
                    {{ d.label || 'Microphone' }}
                </option>
            </select>
        </div>
    </div>
</template>

<style scoped>
/* Action strip: a single non-wrapping row of segmented control clusters (copied from PlayerPannel). */
.strip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: nowrap;
}

.strip-group {
    display: inline-flex;
    align-items: center;
    border-radius: 0.375rem;
    background: rgba(255, 255, 255, 0.05);
    overflow: hidden;
}

.strip-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: rgba(255, 255, 255, 0.8);
    white-space: nowrap;
    transition:
        background 0.15s ease,
        color 0.15s ease;
}

.strip-btn + .strip-btn {
    box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.07);
}

.strip-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}

.strip-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}
</style>
