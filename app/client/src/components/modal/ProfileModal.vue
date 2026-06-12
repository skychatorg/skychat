<script setup>
import { watch, ref, computed, onUnmounted } from 'vue';
import hark from 'hark';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import SectionSubTitle from '@/components/util/SectionSubTitle.vue';

const app = useAppStore();
const client = useClientStore();

// Voice input mode options
const voiceModes = [
    { value: 'open', label: 'Open mic' },
    { value: 'vad', label: 'Voice activity' },
    { value: 'ptt', label: 'Push-to-talk' },
];

// Live mic-level meter (preview), so the threshold can be set by eye. Self-contained: its own
// getUserMedia + hark, independent of being in a call. dB (~ -100..0) -> 0..1 bar position.
const MIC_TEST_CONSTRAINTS = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 },
    video: false,
};
const micLevel = ref(0); // 0..1
const micTesting = ref(false);
let previewStream = null;
let previewHark = null;
const dbToPos = (db) => Math.max(0, Math.min(1, (db + 100) / 100));
const thresholdPos = computed(() => dbToPos(app.voiceSettings.vadThreshold));
const aboveThreshold = computed(() => micLevel.value >= thresholdPos.value);

const stopMicTest = () => {
    previewHark?.stop();
    previewStream?.getTracks().forEach((t) => t.stop());
    previewHark = null;
    previewStream = null;
    micLevel.value = 0;
    micTesting.value = false;
};
const startMicTest = async () => {
    if (micTesting.value) return;
    try {
        previewStream = await navigator.mediaDevices.getUserMedia(MIC_TEST_CONSTRAINTS);
        previewHark = hark(previewStream, { interval: 80, threshold: app.voiceSettings.vadThreshold });
        previewHark.on('volume_change', (db) => (micLevel.value = dbToPos(db)));
        micTesting.value = true;
    } catch {
        stopMicTest();
    }
};
const toggleMicTest = () => (micTesting.value ? stopMicTest() : startMicTest());

// Stop the preview when the drawer closes or the component unmounts.
watch(
    () => app.modals.profile,
    (open) => {
        if (!open) stopMicTest();
    },
);
onUnmounted(stopMicTest);

// Avatar
const uploadAvatar = async (event) => {
    for (const file of event.target.files) {
        const fullUrl = await app.upload(file);
        client.sendMessage(`/avatar ${fullUrl}`);
    }
    event.target.value = '';
};

// Motto
const newMotto = ref(client.state.user.data.plugins.motto);
const saveNewMotto = () => {
    client.sendMessage(`/motto ${newMotto.value}`);
};
watch(
    () => app.modals.profile,
    () => {
        if (app.modals.profile) {
            newMotto.value = client.state.user.data.plugins.motto;
        }
    },
);
</script>

<template>
    <ModalTemplate id="profile" title="Preferences">
        <!-- Avatar -->
        <SectionSubTitle class="mt-2">Avatar</SectionSubTitle>
        <div class="flex justify-center gap-4">
            <input @change="uploadAvatar" type="file" class="grow form-control" placeholder="Avatar" accept="image/png, image/jpeg" />
        </div>

        <!-- Motto -->
        <SectionSubTitle class="mt-6">Motto</SectionSubTitle>
        <div class="flex justify-center gap-4">
            <input v-model="newMotto" class="grow form-control" placeholder="What drives you?" />
            <button @click="saveNewMotto" class="form-control">Save</button>
        </div>

        <!-- Color -->
        <SectionSubTitle class="mt-6">Custom color</SectionSubTitle>
        <div class="mt-2 w-full md:w-2/3 lg:w-[120px] mx-auto flex flex-wrap gap-2 justify-center">
            <div
                v-for="(color, index) in client.state.custom.color"
                :key="index"
                class="w-6 h-6 lg:w-4 lg:h-4 cursor-pointer transition-all hover:rounded"
                :style="{
                    backgroundColor: color.value,
                }"
                :title="color.name"
                @click="client.sendMessage(`/custom use color:${color.id}`)"
            ></div>
        </div>

        <!-- Voice input mode -->
        <SectionSubTitle class="mt-6">Voice input mode</SectionSubTitle>
        <div class="flex gap-2">
            <button
                v-for="m in voiceModes"
                :key="m.value"
                class="form-control grow"
                :class="app.voiceSettings.inputMode === m.value ? 'ring-1 ring-primary text-white' : 'text-white/50'"
                @click="app.setVoiceInputMode(m.value)"
            >
                {{ m.label }}
            </button>
        </div>

        <!-- Mic sensitivity / VAD threshold (irrelevant in push-to-talk) -->
        <template v-if="app.voiceSettings.inputMode !== 'ptt'">
            <SectionSubTitle class="mt-6">Mic sensitivity ({{ app.voiceSettings.vadThreshold }} dB)</SectionSubTitle>
            <input
                type="range"
                min="-80"
                max="-30"
                step="1"
                :value="app.voiceSettings.vadThreshold"
                @input="app.setVoiceVadThreshold(Number($event.target.value))"
                class="w-full"
            />
            <p class="text-xs text-white/40 mt-1">
                Lower = more sensitive. In “Voice activity” mode your mic only transmits above this level.
            </p>

            <!-- Live input-level meter: watch your level vs the threshold marker while you talk -->
            <div class="mt-2 flex items-center gap-2">
                <button class="form-control text-xs shrink-0" @click="toggleMicTest">
                    {{ micTesting ? 'Stop test' : 'Test mic' }}
                </button>
                <div class="relative grow h-2.5 rounded bg-white/10 overflow-hidden">
                    <div
                        class="h-full transition-[width] duration-75"
                        :class="aboveThreshold ? 'bg-emerald-400' : 'bg-white/30'"
                        :style="{ width: micLevel * 100 + '%' }"
                    />
                    <div class="absolute top-0 bottom-0 w-[2px] bg-white" :style="{ left: thresholdPos * 100 + '%' }" title="Threshold" />
                </div>
            </div>
            <p v-if="micTesting" class="text-xs text-white/40 mt-1">
                Set the marker just above your background level — the bar turns green (transmitting) only when you speak.
            </p>
        </template>

        <!-- Gate hold time (only meaningful with the noise gate on) -->
        <template v-if="app.voiceSettings.inputMode === 'vad'">
            <SectionSubTitle class="mt-6">Gate hold time ({{ app.voiceSettings.noiseGateHold }} ms)</SectionSubTitle>
            <input
                type="range"
                min="0"
                max="1000"
                step="50"
                :value="app.voiceSettings.noiseGateHold"
                @input="app.setVoiceNoiseGateHold(Number($event.target.value))"
                class="w-full"
            />
            <p class="text-xs text-white/40 mt-1">How long the mic stays open after you stop talking, so word endings aren’t cut off.</p>
        </template>
    </ModalTemplate>
</template>
