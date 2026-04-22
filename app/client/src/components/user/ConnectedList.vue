<script setup>
import SkyTooltip from '@/components/common/SkyTooltip.vue';
import PresenceRail from '@/components/user/PresenceRail.vue';
import SingleConnectedUser from '@/components/user/SingleConnectedUser.vue';
import { useUserRight } from '@/composables/useUserRight';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed } from 'vue';

const app = useAppStore();
const client = useClientStore();

defineProps({
    compact: {
        type: Boolean,
        default: false,
    },
});

const presence = computed(() => client.state.discordPresence);
const showPresence = computed(() => (presence.value?.onlineCount || 0) > 0);
const hasVoiceActivity = computed(() => (presence.value?.voiceCount || 0) > 0);

const isLoggedIn = computed(() => (client.state.user?.right ?? -1) >= 0);

const guestsBlacklisted = computed(() => {
    const blacklist = client.state.user?.data?.plugins?.blacklist;
    if (!blacklist || Array.isArray(blacklist)) {
        return false;
    }
    return blacklist.guests;
});

const toggleGuestBlacklist = () => {
    client.sendMessage(guestsBlacklisted.value ? '/unblacklistguests' : '/blacklistguests');
};

const activeEntries = computed(() => (client.state.connectedList || []).filter((entry) => !entry.deadSinceTime));
const awayEntries = computed(() => (client.state.connectedList || []).filter((entry) => Boolean(entry.deadSinceTime)));

const canManageStickers = useUserRight('minRightForStickerManagement');
</script>

<template>
    <div class="flex flex-col h-full min-h-0">
        <!-- Collapse toggle (desktop only). Collapse button sits toward the chat (left edge), mirroring the left column. -->
        <div v-if="compact" class="hidden lg:flex shrink-0 px-1 pt-3">
            <button
                class="w-full flex items-center justify-center py-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition"
                title="Expand sidebar"
                @click="app.toggleRightCollapsed()"
            >
                <span class="w-4 text-center text-xs">
                    <fa icon="chevron-left" />
                </span>
            </button>
        </div>
        <div v-else class="hidden lg:flex shrink-0 items-center justify-start px-3 pt-3">
            <button
                class="w-7 h-7 rounded text-white/40 hover:text-white hover:bg-white/5 transition flex items-center justify-center"
                title="Collapse sidebar"
                @click="app.toggleRightCollapsed()"
            >
                <fa icon="chevron-right" class="text-xs" />
            </button>
        </div>

        <!-- Header -->
        <div v-if="!compact" class="p-3 pb-1 flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
                <span class="text-xs font-mono uppercase tracking-wider text-white/30">Active now</span>
                <span class="font-mono text-xs text-white/50 tabular-nums">{{ activeEntries.length }}</span>
            </div>
            <div class="flex items-center gap-1">
                <SkyTooltip v-if="isLoggedIn">
                    <template #trigger>
                        <button
                            class="px-1.5 py-0.5 rounded text-xs transition"
                            :class="guestsBlacklisted ? 'text-danger' : 'text-white/40 hover:text-white/80'"
                            :title="guestsBlacklisted ? 'Guests are hidden. Click to show.' : 'Hide all guests'"
                            @click="toggleGuestBlacklist"
                        >
                            <fa icon="user-slash" />
                        </button>
                    </template>
                    {{ guestsBlacklisted ? 'Guests are hidden. Click to show.' : 'Hide all guest messages' }}
                </SkyTooltip>
            </div>
        </div>

        <!-- Discord presence -->
        <div v-if="showPresence && !compact" class="flex justify-end px-3 mb-2 shrink-0">
            <SkyTooltip v-if="!hasVoiceActivity">
                <template #trigger>
                    <div class="p-1.5 rounded-md bg-indigo-500/15 text-indigo-400 cursor-default">
                        <svg width="14" height="14" viewBox="0 0 71 55" fill="currentColor">
                            <path
                                d="M60.1 4.9A58.5 58.5 0 0045.3.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.3.3a.2.2 0 00-.2-.1 58.3 58.3 0 00-14.8 4.6.2.2 0 00-.1.1A60 60 0 00.4 43.9a.2.2 0 00.1.2 58.7 58.7 0 0017.7 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 010-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.3 36.3 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.2.1 58.5 58.5 0 0017.7-9 .2.2 0 00.1-.1c1.4-14.5-2.4-27.1-10-38.3a.2.2 0 000-.1zM23.7 36c-3.3 0-6-3-6-6.7s2.7-6.7 6-6.7c3.4 0 6.1 3 6 6.7 0 3.7-2.6 6.7-6 6.7zm22.2 0c-3.3 0-6-3-6-6.7s2.7-6.7 6-6.7c3.4 0 6.1 3 6 6.7 0 3.7-2.6 6.7-6 6.7z"
                            />
                        </svg>
                    </div>
                </template>
                {{ presence?.guildName }}: {{ presence?.onlineCount }} online
            </SkyTooltip>
            <div
                v-else
                class="flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                :title="`${presence?.voiceCount} in voice on Discord`"
            >
                <svg width="10" height="10" viewBox="0 0 71 55" fill="currentColor">
                    <path
                        d="M60.1 4.9A58.5 58.5 0 0045.3.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.3 37.3 0 0025.3.3a.2.2 0 00-.2-.1 58.3 58.3 0 00-14.8 4.6.2.2 0 00-.1.1A60 60 0 00.4 43.9a.2.2 0 00.1.2 58.7 58.7 0 0017.7 9 .2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 010-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.3 36.3 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.2.1 58.5 58.5 0 0017.7-9 .2.2 0 00.1-.1c1.4-14.5-2.4-27.1-10-38.3a.2.2 0 000-.1zM23.7 36c-3.3 0-6-3-6-6.7s2.7-6.7 6-6.7c3.4 0 6.1 3 6 6.7 0 3.7-2.6 6.7-6 6.7zm22.2 0c-3.3 0-6-3-6-6.7s2.7-6.7 6-6.7c3.4 0 6.1 3 6 6.7 0 3.7-2.6 6.7-6 6.7z"
                    />
                </svg>
                <span class="tabular-nums">{{ presence?.voiceCount }} in voice</span>
            </div>
        </div>

        <!-- PresenceRail (Now in rooms) — low value at 56px, hidden in the rail -->
        <PresenceRail v-if="!compact" />

        <!-- Active/Away user list -->
        <div class="flex-1 min-h-0 overflow-y-auto scrollbar" :class="compact ? 'px-1' : 'px-2'">
            <SingleConnectedUser v-for="entry in activeEntries" :key="entry.identifier" :entry="entry" :compact="compact" />

            <template v-if="awayEntries.length > 0">
                <div v-if="!compact" class="px-2 pt-3 pb-1 text-xs font-mono uppercase tracking-wider text-white/25">Away</div>
                <div v-else class="h-px bg-white/5 mx-2 my-2" aria-hidden="true" />
                <div class="opacity-50">
                    <SingleConnectedUser v-for="entry in awayEntries" :key="entry.identifier" :entry="entry" :compact="compact" />
                </div>
            </template>
        </div>

        <!-- Action grid -->
        <div
            class="hairline shrink-0"
            :class="compact ? 'p-1 flex flex-col gap-2' : 'p-3 grid grid-cols-2 gap-2'"
            :style="{ background: 'var(--surface-2)' }"
        >
            <button
                v-if="client.state.config.galleryEnabled"
                class="h-10 flex items-center justify-center gap-1.5 rounded-lg hairline bg-white/[.03] hover:bg-white/[.07] text-sm"
                :class="[compact ? 'w-full' : 'col-span-1', { 'text-tertiary': client.state.ongoingConverts.length > 0 }]"
                title="Open gallery"
                @click="app.toggleModal('gallery')"
            >
                <fa icon="folder-tree" />
                <span v-if="!compact">Gallery</span>
            </button>
            <button
                class="h-10 flex items-center justify-center gap-1.5 rounded-lg hairline bg-white/[.03] hover:bg-white/[.07] text-sm"
                :class="compact ? 'w-full' : 'col-span-1'"
                title="Open user settings"
                @click="app.toggleModal('profile')"
            >
                <fa icon="gears" />
                <span v-if="!compact">Settings</span>
            </button>
            <button
                v-if="client.state.config && client.state.config.jellyfinEnabled"
                class="h-10 flex items-center justify-center gap-1.5 rounded-lg hairline bg-white/[.03] hover:bg-white/[.07] text-sm"
                :class="compact ? 'w-full' : 'col-span-2'"
                title="Browse Jellyfin library"
                @click="app.toggleModal('jellyfin')"
            >
                <fa icon="film" />
                <span v-if="!compact">Jellyfin</span>
            </button>
            <button
                v-if="canManageStickers"
                class="h-10 flex items-center justify-center gap-1.5 rounded-lg hairline bg-white/[.03] hover:bg-white/[.07] text-sm"
                :class="compact ? 'w-full' : 'col-span-2'"
                title="Manage stickers"
                @click="app.toggleModal('manageStickers')"
            >
                <fa icon="image" />
                <span v-if="!compact">Manage stickers</span>
            </button>
        </div>
    </div>
</template>
