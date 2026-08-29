<script setup>
import { useVoice } from '@/composables/useVoice';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { VoiceClient } from '@/lib/voice/VoiceClient.js';
import { onMounted, onUnmounted, ref } from 'vue';

const client = useClientStore();
const app = useAppStore();
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
        refreshDevices(); // labels/deviceIds only become available once permission is granted
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
    navigator.mediaDevices?.addEventListener('devicechange', refreshDevices);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
});
onUnmounted(() => {
    navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
});
</script>

<template>
    <div class="strip strip-host px-3 py-2 hairline" :style="{ background: 'var(--surface-2)' }">
        <!-- Leave -->
        <div class="strip-group hairline">
            <button class="strip-btn text-danger" title="Leave voice" @click="voice.leave()">
                <fa icon="phone-slash" />
                <span class="strip-label">Leave</span>
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
                :title="app.voiceSettings.inputMode === 'ptt' ? 'Push-to-talk: on (hold Space)' : 'Push-to-talk: off'"
                @click="app.setVoiceInputMode(app.voiceSettings.inputMode === 'ptt' ? 'open' : 'ptt')"
            >
                <fa :icon="app.voiceSettings.inputMode === 'ptt' ? 'toggle-on' : 'toggle-off'" />
                <span class="strip-label">PTT</span>
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
                :value="client.voice.inputDeviceId ?? ''"
                @focus="refreshDevices"
                @change="client.setVoiceInputDevice($event.target.value || null)"
            >
                <option value="">Default mic</option>
                <option v-for="d in devices" :key="d.deviceId" :value="d.deviceId">
                    {{ d.label || 'Microphone' }}
                </option>
            </select>
        </div>
    </div>
</template>

<style scoped></style>
