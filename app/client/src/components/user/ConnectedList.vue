<script setup>
import { useAppStore } from '@/stores/app';
import { useClientStore } from '@/stores/client';
import HoverCard from '@/components/util/HoverCard.vue';
import SingleConnectedUser from '@/components/user/SingleConnectedUser.vue';
import SectionTitle from '@/components/util/SectionTitle.vue';

const app = useAppStore();
const client = useClientStore();

</script>

<template>
    <div>
        <SectionTitle>Active now</SectionTitle>
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
