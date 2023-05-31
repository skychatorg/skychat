<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';
import UserBigAvatar from '@/components/user/UserBigAvatar.vue';


const app = useAppStore();
const client = useClientStore();

const props = defineProps({
    entry: {
        type: Object,
        required: true,
    },
});

const isBlacklisted = computed(() => {
    if (! client.state.user) {
        return false;
    }
    const blacklist = client.state.user.data.plugins.blacklist || [];
    return blacklist.includes(props.entry.user.username);
});

// Formatted money
const formattedMoney = computed(() => {
    return '$' + Math.floor(props.entry.user.money / 1e2);
});

// Number of minutes since the last message was sent
const minutesSinceLastMessage = computed(() => {
    const duration = new Date().getTime() * 0.001 - props.entry.lastInteractionTime;
    return Math.floor(duration / 60);
});

// Formatted duration since the session is dead
const formattedDurationSinceDead = computed(() => {
    if (! props.entry.deadSinceTime) {
        return '';
    }
    const duration = new Date().getTime() * 0.001 - props.entry.deadSinceTime;
    if (duration > 60 * 60) {
        return Math.round(duration / 60 / 60) + 'hr';
    }
    if (duration > 60) {
        return Math.round(duration / 60) + 'm';
    }
    return Math.round(duration) + 's';
});
</script>

<template>
    <HoverCard
        :borderColor="props.entry.deadSinceTime ? 'transparent' : 'rgb(var(--color-skygray-lightest))'"
        :useBorderRadius="true"
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
                        <sup
                            v-if="isBlacklisted"
                            title="This user is blacklisted. Click to remove from blacklist."
                            @click.stop="client.sendMessage('/unblacklist ' + entry.user.username)"
                        >
                            <fa icon="ban" class="text-danger" />
                        </sup>
                        <sup v-if="entry.connectionCount > 1">{{ entry.connectionCount }}</sup>
                    </div>
                    <div class="text-xs text-right text-skygray-lighter flex justify-end space-x-4 pt-1">
                        <span v-show="entry.user.money > 0" :title="(entry.user.money / 100).toFixed(2)" class="text-yellow-300">{{ formattedMoney }}</span>
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
                            {{ minutesSinceLastMessage > 30 ? 'afk' : (minutesSinceLastMessage + 'm') }}
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
                    <div class="w-0 grow text-right text-skygray-lighter whitespace-nowrap text-ellipsis overflow-hidden" :title="entry.user.data.plugins.motto">
                        {{ entry.user.data.plugins.motto }}
                    </div>
                </div>
            </div>
        </div>
    </HoverCard>
</template>
