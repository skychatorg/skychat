<script setup>
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import { useIsBlacklisted } from '@/composables/useIsBlacklisted';
import { useUserProfile } from '@/composables/useUserProfile';
import { useUserRight } from '@/composables/useUserRight';
import { roomName } from '@/lib/roomName.js';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { formatMoney } from '../../../../api/money.ts';

const app = useAppStore();
const client = useClientStore();
const route = useRoute();
const { closeProfile } = useUserProfile();

const username = computed(() => (typeof route.query.user === 'string' && route.query.user ? route.query.user : null));
// Kept while the dialog animates out, after the URL already dropped the name
const shownName = ref(null);
watch(username, (name) => name && (shownName.value = name), { immediate: true });
const sameName = (user) => user.username.toLowerCase() === shownName.value?.toLowerCase();

// Before the first room, the user list is not there yet: "not found" would be a lie
const loading = computed(() => client.state.currentRoomId === null);
const entry = computed(() => client.state.connectedList.find((entry) => sameName(entry.user)) ?? null);
// Someone who left the list can still be known from their messages, but their numbers are from back then
const user = computed(() => entry.value?.user ?? client.messages.findLast((message) => sameName(message.user))?.user ?? null);
const isSelf = computed(() => user.value && sameName(client.state.user));
const isGuest = computed(() => user.value?.id === 0);
const isBlacklisted = useIsBlacklisted(() => user.value ?? { username: '', id: -1 });
const canMessage = useUserRight('minRightForPrivateMessages', -1);
const canGiveMoney = computed(() => client.state.user.id > 0);

// Same words as the user list: Away is the list's section for those with no connection left
const status = computed(() => {
    if (!entry.value) {
        return { label: 'Not around right now', dot: 'bg-white/20' };
    }
    if (entry.value.deadSinceTime) {
        return { label: `Away for ${elapsed(entry.value.deadSinceTime)}`, dot: 'bg-amber-400' };
    }
    return { label: 'Online', dot: 'bg-emerald-400' };
});

// Rounded like the user list. deadSinceTime is in seconds
const elapsed = (sinceSeconds) => {
    const seconds = Date.now() / 1000 - sinceSeconds;
    if (seconds > 86400) return Math.round(seconds / 86400) + 'd';
    if (seconds > 3600) return Math.round(seconds / 3600) + 'h';
    if (seconds > 60) return Math.round(seconds / 60) + 'm';
    return Math.round(seconds) + 's';
};

// Only the rooms you can see yourself
const rooms = computed(() =>
    (entry.value?.rooms ?? [])
        .map((id) => client.state.rooms.find((room) => room.id === id))
        .filter((room) => room && !room.isPrivate)
        .map((room) => roomName(room, client.state.user.username)),
);

// XP is one point per minute spent here
const timeHere = computed(() => {
    const minutes = user.value?.xp ?? 0;
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    if (days > 0) {
        return `${days}d ${hours}h`;
    }
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
});

// The server confirms in the chat, behind this dialog: close once their money went up. A refused amount keeps it open, with the server's error
let giving = false;
const giveMoney = () => (giving = client.giveMoney(user.value.username));
watch(username, () => (giving = false));
watch(
    () => user.value?.money,
    (money, before) => {
        if (giving && money > before) {
            giving = false;
            closeProfile();
        }
    },
);

const sendPM = () => {
    client.sendMessage('/pm ' + user.value.username);
    app.mobileSetView('middle');
};

const unblock = () => client.sendMessage('/unblacklist ' + user.value.username);

const editOwnProfile = () => {
    closeProfile();
    app.toggleModal('profile');
};
</script>

<template>
    <ModalTemplate
        id="user-profile"
        title="Profile"
        variant="dialog"
        :open="username !== null && route.name === 'room'"
        @close="closeProfile"
    >
        <!-- The dialog's name for screen readers: the visible title stays short, the big name is right below -->
        <template #title>
            Profile<span v-if="user" class="sr-only">: {{ user.username }}</span>
        </template>
        <div v-if="user" class="flex flex-col items-center gap-5 pb-4 text-center">
            <div class="w-28 h-28 rounded-2xl overflow-hidden bg-black border-4" :style="{ borderColor: user.data.plugins.custom.color }">
                <img :src="user.data.plugins.avatar" :alt="user.username" class="h-full w-full object-cover" />
            </div>

            <div class="flex flex-col items-center gap-1 min-w-0 max-w-full">
                <h2 class="text-2xl font-semibold break-words max-w-full" :style="{ color: user.data.plugins.custom.color }">
                    {{ user.username }}
                </h2>
                <p class="flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-white/60">
                    <span class="w-2 h-2 rounded-full" :class="status.dot" />
                    <span>{{ status.label }}</span>
                    <template v-if="rooms.length">
                        <span class="text-white/30">·</span>
                        <span>in {{ rooms.join(', ') }}</span>
                    </template>
                </p>
                <p class="flex gap-1.5">
                    <span v-if="isGuest" class="px-2 py-0.5 rounded bg-white/10 text-xs text-white/70">Guest</span>
                    <span v-if="isBlacklisted" class="px-2 py-0.5 rounded bg-danger/20 text-xs text-danger">Blocked</span>
                </p>
            </div>

            <p v-if="user.data.plugins.motto" class="italic text-white/70 break-words max-w-full">“{{ user.data.plugins.motto }}”</p>

            <dl v-if="entry && !isGuest" class="grid grid-cols-3 gap-2 w-full">
                <div class="rounded-lg bg-white/5 py-3">
                    <dt class="text-xs uppercase tracking-wide text-white/40">Level</dt>
                    <dd class="font-mono text-lg text-primary">{{ user.right }}</dd>
                </div>
                <div class="rounded-lg bg-white/5 py-3">
                    <dt class="text-xs uppercase tracking-wide text-white/40">Time here</dt>
                    <dd class="font-mono text-lg">{{ timeHere }}</dd>
                </div>
                <div class="rounded-lg bg-white/5 py-3">
                    <dt class="text-xs uppercase tracking-wide text-white/40">Money</dt>
                    <dd class="font-mono text-lg text-amber-300">{{ formatMoney(user.money) }}</dd>
                </div>
            </dl>

            <div class="flex flex-wrap justify-center gap-2">
                <template v-if="isSelf">
                    <button v-if="!isGuest" class="form-control flex items-center gap-2 px-4 py-2 min-h-11" @click="editOwnProfile">
                        <fa icon="user" />
                        Edit my profile
                    </button>
                </template>
                <button v-else-if="isBlacklisted" class="form-control flex items-center gap-2 px-4 py-2 min-h-11" @click="unblock">
                    <fa icon="unlock" />
                    Unblock
                </button>
                <template v-else-if="entry">
                    <button v-if="canMessage" class="form-control flex items-center gap-2 px-4 py-2 min-h-11" @click="sendPM">
                        <fa icon="paper-plane" />
                        Message
                    </button>
                    <button
                        v-if="canGiveMoney && !isGuest"
                        class="form-control flex items-center gap-2 px-4 py-2 min-h-11"
                        @click="giveMoney"
                    >
                        <fa icon="coins" />
                        Give money
                    </button>
                </template>
            </div>
            <p v-if="!isSelf && !isBlacklisted && entry && !isGuest && !canGiveMoney" class="-mt-2 text-sm text-white/50">
                Log in to send money
            </p>
        </div>
        <p v-else-if="loading" class="py-8 text-center text-white/60"><fa icon="spinner" spin class="mr-2" />Loading…</p>
        <p v-else class="py-8 text-center text-white/60 break-words">No one called “{{ shownName }}” is around right now.</p>
    </ModalTemplate>
</template>
