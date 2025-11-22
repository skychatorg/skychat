<script setup>
import SkyDropdown from '@/components/common/SkyDropdown.vue';
import SkyDropdownItem from '@/components/common/SkyDropdownItem.vue';
import SkyTooltip from '@/components/common/SkyTooltip.vue';
import UserBigAvatar from '@/components/user/UserBigAvatar.vue';
import HoverCard from '@/components/util/HoverCard.vue';
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

const isBlacklisted = computed(() => {
    if (!client.state.user) {
        return false;
    }
    const blacklist = client.state.user.data.plugins.blacklist || [];
    return blacklist.includes(props.entry.user.username.toLowerCase());
});

const isSelf = computed(() => {
    return props.entry.user.username.toLowerCase() === client.state.user?.username.toLowerCase();
});

// Check if current user can moderate
const canModerate = computed(() => {
    const threshold = client.state.config?.minRightForUserModeration ?? 'op';
    if (threshold === 'op') {
        return client.state.op;
    }
    const userRight = client.state.user?.right ?? -1;
    return client.state.op || userRight >= threshold;
});

// Actions
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

// Formatted money
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

// Number of minutes since the last message was sent
const minutesSinceLastMessage = computed(() => {
    const duration = nowDate.value - props.entry.lastInteractionTime;
    return Math.floor(duration / 60);
});

// Formatted duration since the session is dead
const formattedDurationSinceDead = computed(() => {
    if (!props.entry.deadSinceTime) {
        return '';
    }
    const duration = nowDate.value - props.entry.deadSinceTime;
    if (duration > 60 * 60 * 24) {
        return Math.round(duration / 60 / 60 / 24) + 'd';
    }
    if (duration > 60 * 60) {
        return Math.round(duration / 60 / 60) + 'hr';
    }
    if (duration > 60) {
        return Math.round(duration / 60) + 'm';
    }
    return Math.round(duration) + 's';
});

const borderColor = computed(() => {
    const sameRoom =
        props.entry.user.username.toLowerCase() === client.state.user.username.toLowerCase() ||
        props.entry.rooms.includes(client.state.currentRoomId);

    if (props.entry.deadSinceTime) {
        return 'transparent';
    } else if (sameRoom) {
        return 'rgb(var(--color-primary))';
    } else {
        return 'rgb(var(--color-skygray-light))';
    }
});
</script>

<template>
    <HoverCard
        :border-color="borderColor"
        :use-border-radius="true"
        :selectable="true"
        :selected="false"
        class="group"
        :class="{
            'opacity-40': isBlacklisted,
        }"
    >
        <div
            class="py-2 px-3 flex flex-row"
            :class="{
                'opacity-50': entry.connectionCount === 0,
            }"
        >
            <UserBigAvatar class="mt-1 cursor-pointer" :user="entry.user" @click="sendPM" />

            <!-- Right col -->
            <div class="grow pl-4 pr-1">
                <!-- First row -->
                <div class="flex">
                    <div
                        class="grow font-bold w-0 overflow-hidden text-ellipsis pr-2 cursor-pointer hover:underline"
                        :title="entry.user.username"
                        :style="{
                            color: entry.user.data.plugins.custom.color,
                        }"
                        @click="sendPM"
                    >
                        {{ entry.user.username }}
                        <sup v-if="entry.connectionCount > 1">{{ entry.connectionCount }}</sup>
                        <span v-if="isBlacklisted" class="text-xs text-danger ml-1">(blocked)</span>
                    </div>
                    <div class="text-xs text-right text-skygray-lighter flex justify-end items-center space-x-4 pt-1">
                        <!-- User actions dropdown -->
                        <SkyDropdown v-if="!isSelf" v-model:open="dropdownOpen">
                            <template #trigger>
                                <button
                                    class="px-1.5 py-0.5 rounded border border-transparent transition text-xs"
                                    :class="[
                                        dropdownOpen
                                            ? 'bg-primary/20 text-primary border-primary/50'
                                            : 'text-skygray-lightest hover:bg-skygray-dark/50 hover:border-skygray-light/30',
                                        dropdownOpen ? '' : 'opacity-0 group-hover:opacity-100',
                                    ]"
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
                                    <fa icon="power-off" class="w-4 mr-2 text-warning" />
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

                        <span v-show="entry.user.money > 0" :title="(entry.user.money / 100).toFixed(2)" class="text-yellow-300">{{
                            formattedMoney
                        }}</span>
                        <span v-show="entry.user.right > 0" :title="entry.user.right" class="text-primary">{{ entry.user.right }}</span>
                    </div>
                </div>

                <!-- Second row -->
                <div class="flex">
                    <!-- Status icons -->
                    <div class="flex flex-row w-20 basis-20 space-x-2">
                        <!-- Discord online -->
                        <span
                            v-if="client.state.discordPresence?.onlineUserIds?.includes(entry.user.id)"
                            title="Online on Discord"
                            class="text-[#5865F2]"
                        >
                            <fa :icon="['fab', 'discord']" />
                        </span>

                        <!-- Last activity -->
                        <span
                            v-if="entry.connectionCount > 0 && minutesSinceLastMessage > 0"
                            :title="'Last message sent ' + minutesSinceLastMessage + ' minutes ago'"
                            class="text-primary whitespace-nowrap"
                        >
                            <fa icon="clock" />
                            {{ minutesSinceLastMessage > 30 ? 'afk' : minutesSinceLastMessage + 'm' }}
                        </span>

                        <!-- Disconnected -->
                        <span
                            v-if="entry.connectionCount === 0"
                            :title="'User has disconnected ' + formattedDurationSinceDead + ' ago'"
                            class="text-danger whitespace-nowrap"
                        >
                            <fa icon="link-slash" />
                            {{ formattedDurationSinceDead }}
                        </span>
                    </div>

                    <!-- Motto -->
                    <div v-if="entry.user.data.plugins.motto" class="w-0 grow flex justify-end">
                        <SkyTooltip trigger-class="w-0 grow">
                            <template #trigger>
                                <div
                                    class="text-right text-skygray-lighter whitespace-nowrap text-ellipsis overflow-hidden"
                                    :title="entry.user.data.plugins.motto"
                                >
                                    {{ entry.user.data.plugins.motto }}
                                </div>
                            </template>

                            <p>{{ entry.user.data.plugins.motto }}</p>
                        </SkyTooltip>
                    </div>
                </div>
            </div>
        </div>
    </HoverCard>
</template>
