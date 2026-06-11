<script setup>
import SkyTooltip from '@/components/common/SkyTooltip.vue';
import UserMiniAvatarCollection from '@/components/user/UserMiniAvatarCollection.vue';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const client = useClientStore();

const props = defineProps({
    voiceChannel: { type: Object, required: true },
    compact: { type: Boolean, default: false },
});

const users = computed(() => client.state.voiceChannelUsers[props.voiceChannel.id] || []);
const isCurrent = computed(() => client.state.currentVoiceChannelId === props.voiceChannel.id);
const anySpeaking = computed(() => users.value.some((u) => client.state.voiceSpeaking[u.id]));

const onClick = () => {
    if (isCurrent.value) {
        client.leaveVoice();
    } else {
        client.joinVoice(props.voiceChannel.id);
    }
};
</script>

<template>
    <!-- Compact rail -->
    <SkyTooltip v-if="compact" as-child side="right" :side-offset="12" class="block">
        <template #trigger>
            <button
                class="relative w-full flex items-center justify-center py-2 rounded-lg cursor-pointer transition"
                :class="
                    isCurrent ? 'bg-primary/15 ring-1 ring-primary/40 hover:bg-primary/20' : 'bg-white/[.03] hairline hover:bg-white/[.06]'
                "
                @click="onClick"
            >
                <div v-if="isCurrent" class="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-primary" />
                <div
                    class="w-7 h-7 rounded flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600"
                    :class="{ 'ring-2 ring-emerald-400 animate-pulse': anySpeaking }"
                >
                    <fa icon="microphone" class="text-white" />
                </div>
            </button>
        </template>
        {{ voiceChannel.name }} — {{ users.length }} in voice
    </SkyTooltip>

    <!-- Full -->
    <button
        v-else
        class="relative w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition cursor-pointer"
        :class="isCurrent ? 'bg-primary/15 ring-1 ring-primary/40 hover:bg-primary/20' : 'bg-white/[.03] hairline hover:bg-white/[.06]'"
        @click="onClick"
    >
        <div v-if="isCurrent" class="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-primary" />
        <div
            class="w-7 h-7 rounded shrink-0 flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600"
            :class="{ 'ring-2 ring-emerald-400 animate-pulse': anySpeaking }"
        >
            <fa icon="microphone" class="text-white" />
        </div>
        <div class="flex-1 min-w-0">
            <div class="text-sm truncate">{{ voiceChannel.name }}</div>
            <div class="font-mono text-xs text-white/40 truncate">
                {{ users.length ? users.length + ' in voice' : 'empty' }}
            </div>
        </div>
        <div v-if="users.length > 0" class="flex -space-x-1.5 shrink-0">
            <UserMiniAvatarCollection :users="users" />
        </div>
    </button>
</template>
