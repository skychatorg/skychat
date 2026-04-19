<script setup>
import SkyDropdown from '@/components/common/SkyDropdown.vue';
import SkyDropdownItem from '@/components/common/SkyDropdownItem.vue';
import { useIsBlacklisted } from '@/composables/useIsBlacklisted';
import { useUserRight } from '@/composables/useUserRight';
import { useClientStore } from '@/stores/client';
import { computed, onMounted, onUnmounted, ref } from 'vue';

const client = useClientStore();

const props = defineProps({
    entry: {
        type: Object,
        required: true,
    },
});

const dropdownOpen = ref(false);

const isBlacklisted = useIsBlacklisted(() => props.entry.user);

const isSelf = computed(() => {
    return props.entry.user.username.toLowerCase() === client.state.user?.username.toLowerCase();
});

const canModerate = useUserRight('minRightForUserModeration');

const sendPM = () => {
    client.sendMessage('/pm ' + props.entry.user.username);
};

const blacklistUser = () => {
    client.sendMessage('/blacklist ' + props.entry.user.username);
};

const unblacklistUser = () => {
    client.sendMessage('/unblacklist ' + props.entry.user.username);
};

const kickUser = () => {
    if (confirm(`Kick ${props.entry.user.username}?`)) {
        client.sendMessage('/kick ' + props.entry.user.username);
    }
};

const banUser = () => {
    const duration = prompt(`Ban ${props.entry.user.username} for how long? (duration in seconds)`);
    if (duration) {
        client.sendMessage(`/ban ${props.entry.user.username} access ${duration}`);
    }
};

const copyUsername = () => {
    navigator.clipboard.writeText(props.entry.user.username);
};

const formattedMoney = computed(() => {
    return '$' + Math.floor(props.entry.user.money / 1e2);
});

const nowDate = ref(new Date().getTime() * 0.001);
const nowDateInterval = ref();
onMounted(() => {
    nowDateInterval.value = setInterval(() => {
        nowDate.value = new Date().getTime() * 0.001;
    }, 1000);
});
onUnmounted(() => {
    clearInterval(nowDateInterval.value);
});

const minutesSinceLastMessage = computed(() => {
    const duration = nowDate.value - props.entry.lastInteractionTime;
    return Math.floor(duration / 60);
});

const formattedDurationSinceDead = computed(() => {
    if (!props.entry.deadSinceTime) {
        return '';
    }
    const duration = nowDate.value - props.entry.deadSinceTime;
    if (duration > 60 * 60 * 24) {
        return Math.round(duration / 60 / 60 / 24) + 'd';
    }
    if (duration > 60 * 60) {
        return Math.round(duration / 60 / 60) + 'h';
    }
    if (duration > 60) {
        return Math.round(duration / 60) + 'm';
    }
    return Math.round(duration) + 's';
});

const isInCurrentRoom = computed(() => {
    if (isSelf.value) {
        return true;
    }
    return props.entry.rooms?.includes(client.state.currentRoomId);
});

const isAfk = computed(() => Boolean(props.entry.deadSinceTime));
const isDisconnected = computed(() => props.entry.connectionCount === 0);
</script>

<template>
    <div
        class="group relative flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition select-none"
        :class="{ 'opacity-40': isBlacklisted }"
    >
        <!-- Avatar -->
        <button class="relative shrink-0" :title="entry.user.username" @click="sendPM">
            <div class="w-8 h-8 rounded overflow-hidden bg-black border-2" :style="{ borderColor: entry.user.data.plugins.custom.color }">
                <img :src="entry.user.data.plugins.avatar" :alt="entry.user.username" class="h-full w-full object-cover" />
            </div>
            <div
                v-if="isInCurrentRoom && !isAfk && !isDisconnected"
                class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400"
                :style="{ boxShadow: '0 0 0 2px var(--surface)' }"
            />
        </button>

        <!-- Middle col -->
        <div class="flex-1 min-w-0">
            <!-- First row -->
            <div class="flex items-center gap-1.5">
                <button
                    class="text-sm font-semibold truncate text-left hover:underline"
                    :title="entry.user.username"
                    :style="{ color: entry.user.data.plugins.custom.color }"
                    @click="sendPM"
                >
                    {{ entry.user.username }}
                </button>
                <sup v-if="entry.connectionCount > 1" class="font-mono text-xs text-white/40">
                    {{ entry.connectionCount }}
                </sup>
                <span v-if="isBlacklisted" class="font-mono text-xs text-danger">blocked</span>
            </div>

            <!-- Second row -->
            <div class="flex items-center gap-2 font-mono text-xs text-white/40">
                <!-- Discord -->
                <span
                    v-if="client.state.discordPresence?.onlineUserIds?.includes(entry.user.id)"
                    title="Online on Discord"
                    class="text-[#5865F2]"
                >
                    <fa :icon="['fab', 'discord']" />
                </span>

                <!-- Status -->
                <template v-if="isDisconnected">
                    <span class="flex items-center gap-1 text-danger" :title="`Disconnected ${formattedDurationSinceDead} ago`">
                        <fa icon="link-slash" />
                        <span>{{ formattedDurationSinceDead }}</span>
                    </span>
                </template>
                <template v-else-if="isAfk">
                    <span class="flex items-center gap-1" :title="`AFK ${formattedDurationSinceDead}`">
                        <fa icon="clock" />
                        <span>{{ formattedDurationSinceDead }}</span>
                    </span>
                </template>
                <template v-else-if="minutesSinceLastMessage > 0">
                    <span class="flex items-center gap-1" :title="`Last message ${minutesSinceLastMessage}m ago`">
                        <fa icon="clock" />
                        <span>{{ minutesSinceLastMessage > 30 ? 'afk' : minutesSinceLastMessage + 'm' }}</span>
                    </span>
                </template>
                <template v-else>
                    <span class="flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>active</span>
                    </span>
                </template>

                <!-- Motto -->
                <span v-if="entry.user.data.plugins.motto" class="truncate text-white/35 italic" :title="entry.user.data.plugins.motto">
                    {{ entry.user.data.plugins.motto }}
                </span>
            </div>
        </div>

        <!-- Right col -->
        <div class="shrink-0 flex items-center gap-2">
            <span
                v-show="entry.user.money > 0"
                :title="(entry.user.money / 100).toFixed(2)"
                class="font-mono text-xs text-amber-300/80 tabular-nums"
            >
                {{ formattedMoney }}
            </span>
            <span v-show="entry.user.right > 0" :title="`Level ${entry.user.right}`" class="font-mono text-xs text-primary tabular-nums">
                {{ entry.user.right }}
            </span>

            <!-- Actions dropdown -->
            <SkyDropdown v-if="!isSelf" v-model:open="dropdownOpen">
                <template #trigger>
                    <button
                        class="px-1 py-0.5 rounded text-xs transition"
                        :class="
                            dropdownOpen
                                ? 'bg-primary/20 text-primary opacity-100'
                                : 'text-white/40 hover:text-white/80 opacity-0 group-hover:opacity-100'
                        "
                    >
                        <fa icon="ellipsis" />
                    </button>
                </template>

                <template #default>
                    <SkyDropdownItem @click="sendPM">
                        <fa icon="paper-plane" class="w-4 mr-2" />
                        Send PM
                    </SkyDropdownItem>
                    <SkyDropdownItem v-if="!isBlacklisted" @click="blacklistUser">
                        <fa icon="ban" class="w-4 mr-2" />
                        Blacklist
                    </SkyDropdownItem>
                    <SkyDropdownItem v-else @click="unblacklistUser">
                        <fa icon="ban" class="w-4 mr-2" />
                        Unblacklist
                    </SkyDropdownItem>
                    <SkyDropdownItem v-if="canModerate" @click="kickUser">
                        <fa icon="power-off" class="w-4 mr-2 text-warn" />
                        Kick
                    </SkyDropdownItem>
                    <SkyDropdownItem v-if="canModerate" @click="banUser">
                        <fa icon="ban" class="w-4 mr-2 text-danger" />
                        Ban
                    </SkyDropdownItem>
                    <SkyDropdownItem @click="copyUsername">
                        <fa icon="copy" class="w-4 mr-2" />
                        Copy username
                    </SkyDropdownItem>
                </template>
            </SkyDropdown>
        </div>
    </div>
</template>
