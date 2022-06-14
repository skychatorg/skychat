<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';
import SingleConnectedUser from '@/components/user/SingleConnectedUser.vue';

const app = useAppStore();
const client = useClientStore();

</script>

<template>
    <div>

        <p class="pl-4 font-bold text-skygray-casual">Active now</p>
        <div>
            <SingleConnectedUser
                v-for="entry in client.state.connectedList"
                :key="entry.identifier"
                :entry="entry"
            />
        </div>
    </div>
</template>

<style scoped>

</style>
