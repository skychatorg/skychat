<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';

const app = useAppStore();
const client = useClientStore();

</script>

<template>
    <div>

        <p class="pl-4 font-bold text-skygray-casual">Active now</p>
        <div>
            <HoverCard
                v-for="entry in client.state.connectedList"
                :key="entry.identifier"
                :useBorderRadius="true"
                :selectable="true"
                :selected="false"
            >
                <div class="py-4 px-3 select-none">{{ entry.user.username }}</div>
            </HoverCard>
        </div>
    </div>
</template>

<style scoped>

</style>
