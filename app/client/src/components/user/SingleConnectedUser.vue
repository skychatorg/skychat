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

// Formatted money
const formattedMoneyRef = computed(() => {
    return '$' + Math.floor(props.entry.user.money / 1e2);
});

</script>

<template>
    <HoverCard
        :useBorderRadius="true"
        :selectable="true"
        :selected="false"
    >
        <div class="py-2 px-3 flex flex-row">

            <UserBigAvatar class="mt-1" :user="props.entry.user" />

            <!-- Right col -->
            <div class="grow pl-4 pr-1">

                <!-- First row (user + date) -->
                <div class="flex">
                    <div
                        class="grow font-bold"
                        :style="{
                            color: props.entry.user.data.plugins.color,
                        }"
                    >
                        {{ props.entry.user.username }}
                    </div>
                    <div class="text-xs text-right text-skygray-lighter flex justify-end space-x-4 pt-1">
                        <span class="text-primary">{{ props.entry.user.right }}</span>
                        <span class="text-yellow-300">{{ formattedMoneyRef }}</span>
                    </div>
                </div>

                <!-- Second row -->
                <div class="text-skygray-white flex">
                    
                    <!-- Motto -->
                    <div class="grow text-right text-skygray-lighter" :title="props.entry.user.data.plugins.motto">
                        {{ props.entry.user.data.plugins.motto }}
                    </div>
                </div>
            </div>
        </div>
    </HoverCard>
</template>

<style scoped>
</style>
