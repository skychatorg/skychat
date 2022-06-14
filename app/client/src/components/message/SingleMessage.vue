<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';
import UserBigAvatar from '@/components/user/UserBigAvatar.vue';
import UserMiniAvatar from '@/components/user/UserMiniAvatar.vue';

const app = useAppStore();
const client = useClientStore();

const props = defineProps({
    message: {
        type: Object,
        required: true,
    },
});

// Shown date
const formattedDate = computed(() => {
    const date = new Date(props.message.createdTimestamp * 1000);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
});

// Users whose last seen message is this message
const lastSeenUsers = computed(() => {
    return (client.state.messageIdToLastSeenUsers[props.message.id] || []).slice(0, 6)
});

</script>

<template>
    <HoverCard
        :borderColor="message.user.data.plugins.color"
        :selectable="true"
        :selected="false"
    >
        <div class="single-message py-1 px-3 flex flex-row">

            <UserBigAvatar
                class="mt-1"
                :user="message.user"
            />

            <div class="grow pl-4">
                <!-- First row -->
                <div class="flex">
                    <div
                        class="grow font-bold"
                        :style="{
                            color: message.user.data.plugins.color,
                        }"
                    >
                        {{ message.user.username }}
                    </div>
                </div>
                <!-- Message content -->
                <div class="text-skygray-white" v-html="message.formatted"></div>
            </div>

            <div class="basis-16 w-16 flex flex-col text-center">
                <span class="text-xs text-skygray-lighter">
                    {{ formattedDate }}
                </span>
                <div class="mt-2 flex justify-center -space-x-1.5">
                    <UserMiniAvatar
                        v-for="user in lastSeenUsers"
                        :key="user.identifier"
                        :user="user"
                        class="transition transition-all hover:-translate-y-0.5 hover:scale-110"
                    />
                </div>
            </div>
        </div>
    </HoverCard>
</template>

<style scoped>
.single-message:not(:hover) .actions {
    /* Hide element */
    display: none;
}
</style>
