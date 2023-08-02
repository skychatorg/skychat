<script setup>
import { useClientStore } from '@/stores/client';
import ModalTemplate from '@/components/modal/ModalTemplate.vue';
import GalleryPannel from '@/components/gallery/GalleryPannel.vue';

const client = useClientStore();
</script>

<template>
    <ModalTemplate id="gallery" title="Gallery">
        <template v-if="client.state.gallery">
            <GalleryPannel />
        </template>
        <template v-else> You do not have the permission to view the gallery. </template>
    </ModalTemplate>
</template>
