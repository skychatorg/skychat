<script setup>
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';

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

</script>

<template>
    <HoverCard
        :borderColor="message.user.data.plugins.color"
        :selectable="true"
        :selected="false"
    >
        <div class="py-1 px-3 flex flex-row">

            <!-- Avatar bubble -->
            <div
                class="left-col rounded-2xl border border-2 overflow-hidden mt-1"
                :style="{
                    borderColor: message.user.data.plugins.color,
                }"
            >
                <img :src="message.user.data.plugins.avatar" class="object-cover h-full" alt="" />
            </div>

            <!-- Right col -->
            <div class="right-col grow pl-4">

                <!-- First row (user + date) -->
                <div class="flex">
                    <div
                        class="grow font-bold"
                        :style="{
                            color: message.user.data.plugins.color,
                        }"
                    >
                        {{ message.user.username }}
                    </div>
                    <div class="basis-16 text-xs text-right text-skygray-lighter">{{ formattedDate }}</div>
                </div>

                <!-- Message content -->
                <div class="text-skygray-white" v-html="message.formatted"></div>
            </div>
        </div>
    </HoverCard>
</template>

<style scoped>
.left-col {
    min-width: 40px;
    width: 40px;
    min-height: 40px;
    height: 40px;
}
</style>
