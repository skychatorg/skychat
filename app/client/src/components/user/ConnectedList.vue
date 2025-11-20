<script setup>
import { computed } from 'vue';
import SingleConnectedUser from '@/components/user/SingleConnectedUser.vue';
import SectionTitle from '@/components/util/SectionTitle.vue';
import { useClientStore } from '@/stores/client';

const client = useClientStore();

const presence = computed(() => client.state.discordPresence);
const showPresence = computed(() => (presence.value?.onlineCount || 0) > 0);
const hasVoiceActivity = computed(() => (presence.value?.voiceCount || 0) > 0);
</script>

<template>
    <div>
        <SectionTitle>Active now</SectionTitle>
        <div
            v-if="showPresence"
            :class="[
                'flex items-center justify-center gap-1.5 px-3 py-2 mb-2 rounded-md text-xs',
                hasVoiceActivity ? 'bg-emerald-500/15 text-emerald-500' : 'bg-indigo-500/15 text-indigo-400',
            ]"
        >
            <span class="flex items-center">
                <svg width="16" height="16" viewBox="0 0 71 55" fill="currentColor">
                    <path
                        d="M60.1 4.9A58.5 58.5 0 0045.3.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.3.3a.2.2 0 00-.2-.1 58.3 58.3 0 00-14.8 4.6.2.2 0 00-.1.1A60 60 0 00.4 43.9a.2.2 0 00.1.2 58.7 58.7 0 0017.7 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 010-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.3 36.3 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.2.1 58.5 58.5 0 0017.7-9 .2.2 0 00.1-.1c1.4-14.5-2.4-27.1-10-38.3a.2.2 0 000-.1zM23.7 36c-3.3 0-6-3-6-6.7s2.7-6.7 6-6.7c3.4 0 6.1 3 6 6.7 0 3.7-2.6 6.7-6 6.7zm22.2 0c-3.3 0-6-3-6-6.7s2.7-6.7 6-6.7c3.4 0 6.1 3 6 6.7 0 3.7-2.6 6.7-6 6.7z"
                    />
                </svg>
            </span>
            <span class="font-medium">
                {{ presence?.guildName }}: {{ presence?.onlineCount }} online<template v-if="presence?.voiceCount > 0"
                    >, {{ presence?.voiceCount }} in voice</template
                >
            </span>
        </div>
        <div>
            <SingleConnectedUser v-for="entry in client.state.connectedList" :key="entry.identifier" :entry="entry" />
        </div>
    </div>
</template>
