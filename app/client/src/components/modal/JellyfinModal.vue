<script setup>
import { useClientStore } from '@/stores/client';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import JellyfinLibraryPannel from '@/components/jellyfin/JellyfinLibraryPannel.vue';

const client = useClientStore();
</script>

<template>
    <ModalTemplate id="jellyfin" title="Jellyfin" variant="wide">
        <template v-if="client.state.config && client.state.config.jellyfinEnabled">
            <JellyfinLibraryPannel />
        </template>
        <template v-else> Jellyfin is not enabled on this server. </template>
    </ModalTemplate>
</template>
