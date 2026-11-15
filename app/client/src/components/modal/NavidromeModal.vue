<script setup>
import { useClientStore } from '@/stores/client';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import NavidromeLibraryPannel from '@/components/navidrome/NavidromeLibraryPannel.vue';

const client = useClientStore();
</script>

<template>
    <ModalTemplate id="navidrome" title="Music" variant="wide">
        <NavidromeLibraryPannel v-if="client.state.config?.navidromeEnabled" />
        <template v-else>The music library is not enabled on this server.</template>
    </ModalTemplate>
</template>
