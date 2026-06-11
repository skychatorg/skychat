<script setup>
import SingleVoiceChannel from '@/components/voice/SingleVoiceChannel.vue';
import { useClientStore } from '@/stores/client';

const client = useClientStore();

defineProps({
    compact: { type: Boolean, default: false },
});
</script>

<template>
    <div
        v-if="client.state.voiceChannels.length"
        class="hairline"
        :class="compact ? 'p-1 py-2' : 'p-3 pt-2'"
        :style="{ background: 'var(--surface-2)' }"
    >
        <div v-if="!compact" class="flex items-center justify-between px-1 mb-2">
            <span class="text-xs font-mono uppercase tracking-wider text-white/30">Voice</span>
            <fa icon="microphone" class="text-primary" />
        </div>
        <div class="flex flex-col gap-1">
            <SingleVoiceChannel
                v-for="voiceChannel in client.state.voiceChannels"
                :key="voiceChannel.id"
                :voice-channel="voiceChannel"
                :compact="compact"
            />
        </div>
    </div>
</template>
