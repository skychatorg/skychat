<script setup>
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

const isBlacklisted = computed(() => {
    if (!client.state.user) {
        return false;
    }
    const blacklist = client.state.user.data.plugins.blacklist || [];
    return blacklist.includes(props.entry.user.username);
});

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
        v-show="!isBlacklisted"
        :border-color="borderColor"
        :use-border-radius="true"
        :selectable="true"
        :selected="false"
        class="cursor-pointer"
        @click="client.sendMessage('/pm ' + entry.user.username)"
    >
        <div
            class="py-2 px-3 flex flex-row"
            :class="{
                'opacity-50': entry.connectionCount === 0,
            }"
        >
            <UserBigAvatar class="mt-1" :user="entry.user" />

            <!-- Right col -->
            <div class="grow pl-4 pr-1">
                <!-- First row -->
                <div class="flex">
                    <div
                        class="grow font-bold w-0 overflow-hidden text-ellipsis pr-2"
                        :title="entry.user.username"
                        :style="{
                            color: entry.user.data.plugins.custom.color,
                        }"
                    >
                        {{ entry.user.username }}
                        <sup v-if="entry.connectionCount > 1">{{ entry.connectionCount }}</sup>
                    </div>
                    <div class="text-xs text-right text-skygray-lighter flex justify-end space-x-4 pt-1">
                        <span v-show="entry.user.money > 0" :title="(entry.user.money / 100).toFixed(2)" class="text-yellow-300">{{
                            formattedMoney
                        }}</span>
                        <span v-show="entry.user.right > 0" :title="entry.user.right" class="text-primary">{{ entry.user.right }}</span>
                    </div>
                </div>

                <!-- Second row -->
                <div class="flex">
                    <!-- Status icons -->
                    <div class="flex flex-row w-16 basis-16">
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
