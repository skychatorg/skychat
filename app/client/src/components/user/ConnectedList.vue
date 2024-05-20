<script setup>
import SingleConnectedUser from '@/components/user/SingleConnectedUser.vue';
import SectionTitle from '@/components/util/SectionTitle.vue';
import { useClientStore } from '@/stores/client';

const client = useClientStore();
</script>

<template>
    <div>
        <SectionTitle>Active now</SectionTitle>
        <div>
            <SingleConnectedUser v-for="entry in client.state.connectedList" :key="entry.identifier" :entry="entry" />
        </div>
    </div>
</template>
